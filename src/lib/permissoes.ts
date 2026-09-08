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

/**
 * @returns `true` quando uma ação real foi disparada; `false` quando não há
 * nada para abrir (web: uma aba de navegador não tem tela de Configurações de
 * app). Quem oferece o botão usa o retorno para não prometer, no rótulo, uma
 * ação que este método já sabe de antemão que não vai fazer nada.
 */
/**
 * O remédio real na web, onde não existe tela de Configurações de app para
 * abrir.
 *
 * Mora aqui, e não solta em cada tela, porque a frase estava LITERALMENTE
 * duplicada entre este módulo e o aviso de localização da Início do motorista.
 * Duas cópias de uma instrução divergem no primeiro ajuste de redação, e o
 * motorista passa a receber orientações diferentes para o mesmo bloqueio,
 * dependendo de onde esbarrou nele.
 *
 * Não é hipótese: essa mesma frase, ao ser introduzida no #490, colidiu com o
 * seletor `getByText(/mapa/i).first()` e derrubou quatro testes e2e — texto
 * repetido em telas diferentes tem alcance maior do que parece.
 */
export const REMEDIO_CADEADO_WEB =
  'No navegador, use o cadeado ao lado do endereço do site para liberar o acesso.';

export function abrirConfiguracoesDoApp(): boolean {
  if (Platform.OS === 'ios') {
    Linking.openURL('app-settings:');
    return true;
  } else if (Platform.OS === 'android') {
    Linking.openSettings();
    return true;
  }
  // Web: não existem configurações de app para abrir.
  return false;
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

  const mensagemBase = resultado.podePerguntarDeNovo
    ? copy.mensagemNegada
    : copy.mensagemBloqueada;

  // Na web, abrirConfiguracoesDoApp() não faz nada (uma aba de navegador não
  // tem tela de Configurações de app) - oferecer um botão "Abrir
  // Configurações" que não abre nada é o botão morto que este módulo existe
  // para eliminar. O remédio real (o cadeado da barra de endereço) entra na
  // mensagem, e o botão vira um reconhecimento sincero em vez de uma
  // promessa vazia.
  if (Platform.OS === 'web') {
    await showConfirm({
      title: copy.titulo,
      message: `${mensagemBase} ${REMEDIO_CADEADO_WEB}`,
      type: 'warning',
      confirmText: 'Entendi',
    });
    return;
  }

  const abrir = await showConfirm({
    title: copy.titulo,
    message: mensagemBase,
    type: 'warning',
    confirmText: 'Abrir Configurações',
    cancelText: 'Agora não',
  });

  if (abrir) abrirConfiguracoesDoApp();
}
