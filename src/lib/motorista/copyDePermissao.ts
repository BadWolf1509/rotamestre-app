/**
 * Copy compartilhada entre os pontos do app que pedem permissão ao motorista
 * (localização, câmera, galeria).
 *
 * POR QUE EXISTE. `oferecerSaidaParaConfiguracoes` (`@/lib/permissoes`) recebe
 * a copy por parâmetro para não precisar de um dialog próprio — mas isso
 * também significa que cada chamador precisaria inventar a própria redação.
 * As três telas de navegação (`NavigationMode`, `NavigationMode.web` e
 * `TurnByTurnNavigation`) pedem localização pelo mesmo motivo (sem GPS não há
 * como navegar até a entrega) e por isso dividem uma única constante. Uma
 * constante por permissão evita textos ligeiramente diferentes para o mesmo
 * bloqueio.
 *
 * CÂMERA E GALERIA SÃO QUATRO CONSTANTES, NÃO DUAS. `CameraUpload` e
 * `IncidentReportWizard` também pedem câmera e galeria, mas não pelo mesmo
 * motivo: em `CameraUpload` a foto comprova que a entrega aconteceu; em
 * `IncidentReportWizard` a foto documenta por que a entrega NÃO aconteceu
 * como previsto (endereço não localizado, acesso bloqueado, cliente ausente).
 * Uma mensagem que não nomeia a aposta do fluxo em que está não diz nada ao
 * motorista — "sem acesso à câmera não é possível tirar fotos" é tão vago que
 * não ajuda ninguém a decidir se vale liberar a permissão — mas nomear a
 * aposta ERRADA é pior que ser vago: dizer que a foto "comprova a entrega" no
 * wizard de incidente afirma o oposto do que o motorista está fazendo naquela
 * tela (relatando que a entrega falhou). Daí duas constantes por permissão —
 * `_ENTREGA` para `CameraUpload`, `_INCIDENTE` para `IncidentReportWizard` —
 * em vez de uma só compartilhada entre os dois.
 *
 * Assimetria deliberada entre `mensagemNegada` e `mensagemBloqueada` (Ruling 3
 * da Task 3, mantida aqui): o botão "Abrir Configurações" já fica logo abaixo
 * da mensagem nas duas variantes, então só a bloqueada precisa NOMEAR o
 * remédio — a negada apenas descreve a consequência, porque o diálogo do
 * sistema ainda pode voltar a aparecer, e mandar para Configurações ali seria
 * impreciso. Vale para as quatro constantes de câmera/galeria e para
 * `COPY_LOCALIZACAO`.
 */
import type { CopyDePermissao } from '@/lib/permissoes';

export const COPY_LOCALIZACAO: CopyDePermissao = {
  titulo: 'Acesso à localização',
  mensagemNegada:
    'Sem acesso à sua localização não é possível navegar até a entrega.',
  mensagemBloqueada:
    'O acesso à localização está bloqueado. Libere em Configurações para navegar até a entrega.',
};

export const COPY_CAMERA_ENTREGA: CopyDePermissao = {
  titulo: 'Acesso à câmera',
  mensagemNegada:
    'Sem acesso à câmera não é possível registrar a foto que comprova a entrega.',
  mensagemBloqueada:
    'O acesso à câmera está bloqueado. Libere em Configurações para registrar o comprovante.',
};

export const COPY_GALERIA_ENTREGA: CopyDePermissao = {
  titulo: 'Acesso à galeria',
  mensagemNegada:
    'Sem acesso às fotos não é possível anexar a imagem que comprova a entrega.',
  mensagemBloqueada:
    'O acesso às fotos está bloqueado. Libere em Configurações para anexar o comprovante.',
};

export const COPY_CAMERA_INCIDENTE: CopyDePermissao = {
  titulo: 'Acesso à câmera',
  mensagemNegada:
    'Sem acesso à câmera não é possível fotografar o que aconteceu nesta parada.',
  mensagemBloqueada:
    'O acesso à câmera está bloqueado. Libere em Configurações para fotografar o ocorrido.',
};

export const COPY_GALERIA_INCIDENTE: CopyDePermissao = {
  titulo: 'Acesso à galeria',
  mensagemNegada:
    'Sem acesso às fotos não é possível anexar a imagem do que aconteceu nesta parada.',
  mensagemBloqueada:
    'O acesso às fotos está bloqueado. Libere em Configurações para anexar a imagem do ocorrido.',
};

/**
 * O SOS tem aposta própria, e ela não é navegar: é o gestor saber onde a
 * pessoa está numa emergência. Reaproveitar `COPY_LOCALIZACAO` aqui diria
 * "não é possível navegar até a entrega" para quem está pedindo socorro.
 */
export const COPY_LOCALIZACAO_SOS: CopyDePermissao = {
  titulo: 'Acesso à localização',
  mensagemNegada:
    'Sem acesso à sua localização o gestor não vai saber onde você está ao receber o SOS.',
  mensagemBloqueada:
    'O acesso à localização está bloqueado. Libere em Configurações para que o gestor saiba onde você está.',
};
