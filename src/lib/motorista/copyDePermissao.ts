/**
 * Copy compartilhada entre os pontos do app que pedem permissão ao motorista
 * (localização, câmera, galeria).
 *
 * POR QUE EXISTE. `oferecerSaidaParaConfiguracoes` (`@/lib/permissoes`) recebe
 * a copy por parâmetro para não precisar de um dialog próprio — mas isso
 * também significa que cada chamador precisaria inventar a própria redação.
 * As três telas de navegação (`NavigationMode`, `NavigationMode.web` e
 * `TurnByTurnNavigation`) pedem localização pelo mesmo motivo (sem GPS não há
 * como navegar até a entrega); `CameraUpload` e `IncidentReportWizard` pedem
 * câmera e galeria pelo mesmo motivo cada uma (sem foto não há comprovante,
 * nem reporte de incidente). Uma constante por permissão evita textos
 * ligeiramente diferentes para o mesmo bloqueio.
 *
 * Assimetria deliberada entre `mensagemNegada` e `mensagemBloqueada` (Ruling 3
 * da Task 3, mantida aqui): o botão "Abrir Configurações" já fica logo abaixo
 * da mensagem nas duas variantes, então só a bloqueada precisa NOMEAR o
 * remédio — a negada apenas descreve a consequência, porque o diálogo do
 * sistema ainda pode voltar a aparecer, e mandar para Configurações ali seria
 * impreciso.
 */
import type { CopyDePermissao } from '@/lib/permissoes';

export const COPY_LOCALIZACAO: CopyDePermissao = {
  titulo: 'Acesso à localização',
  mensagemNegada:
    'Sem acesso à sua localização não é possível navegar até a entrega.',
  mensagemBloqueada:
    'O acesso à localização está bloqueado. Libere em Configurações para navegar até a entrega.',
};

export const COPY_CAMERA: CopyDePermissao = {
  titulo: 'Acesso à câmera',
  mensagemNegada:
    'Sem acesso à câmera não é possível registrar a foto que comprova a entrega.',
  mensagemBloqueada:
    'O acesso à câmera está bloqueado. Libere em Configurações para tirar fotos.',
};

export const COPY_GALERIA: CopyDePermissao = {
  titulo: 'Acesso à galeria',
  mensagemNegada:
    'Sem acesso às fotos não é possível anexar a imagem que comprova a entrega.',
  mensagemBloqueada:
    'O acesso à galeria está bloqueado. Libere em Configurações para escolher fotos.',
};
