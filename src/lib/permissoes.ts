/**
 * Pedido de permissão que preserva a informação que os call sites descartavam,
 * e o caminho de volta quando ela é negada.
 *
 * POR QUE EXISTE. `grep canAskAgain` devolvia zero ocorrências no repo: dez
 * call sites faziam `status === 'granted'` e jogavam fora o campo que
 * distingue "negou agora" de "bloqueou para sempre". Depois da segunda
 * negação o Android para de exibir o diálogo e devolve `denied` na hora — sem
 * um caminho para as Configurações, não existe volta. Em `CameraUpload` isso
 * fechava o laço: sem câmera não há comprovante, e sem comprovante não há
 * entrega.
 *
 * `showConfirm` entra por parâmetro, e não por `useAlert` aqui dentro: o
 * `useAlert` devolve um elemento `AlertDialog` que o componente precisa
 * renderizar, então chamar o hook neste módulo criaria um segundo diálogo que
 * ninguém monta.
 */
import { Linking, Platform } from 'react-native';

export interface ResultadoPermissao {
  concedida: boolean;
  /** `canAskAgain`: `false` significa que o diálogo do sistema não aparece mais. */
  podePerguntarDeNovo: boolean;
}

export interface CopyDePermissao {
  titulo: string;
  /** Exibida quando o diálogo do sistema ainda pode voltar a aparecer. */
  mensagemNegada: string;
  /** Exibida quando só as Configurações resolvem. */
  mensagemBloqueada: string;
}

type RespostaDePermissao = { status: string; canAskAgain?: boolean };

type ShowConfirm = (opcoes: {
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  confirmText?: string;
  cancelText?: string;
}) => Promise<boolean>;

export function abrirConfiguracoesDoApp(): void {
  if (Platform.OS === 'ios') {
    Linking.openURL('app-settings:');
  } else if (Platform.OS === 'android') {
    Linking.openSettings();
  }
  // Web: não existem configurações de app para abrir.
}

export async function pedirPermissao(
  solicitar: () => Promise<RespostaDePermissao>,
): Promise<ResultadoPermissao> {
  const resposta = await solicitar();
  return {
    concedida: resposta.status === 'granted',
    // Ausente (mocks antigos, versões de lib) conta como "ainda dá para
    // perguntar": acusar um bloqueio que não existe confunde mais do que a
    // mensagem branda.
    podePerguntarDeNovo: resposta.canAskAgain ?? true,
  };
}

export async function oferecerSaidaParaConfiguracoes(
  resultado: ResultadoPermissao,
  copy: CopyDePermissao,
  showConfirm: ShowConfirm,
): Promise<void> {
  if (resultado.concedida) return;

  const abrir = await showConfirm({
    title: copy.titulo,
    message: resultado.podePerguntarDeNovo
      ? copy.mensagemNegada
      : copy.mensagemBloqueada,
    type: 'warning',
    confirmText: 'Abrir Configurações',
    cancelText: 'Agora não',
  });

  if (abrir) abrirConfiguracoesDoApp();
}
