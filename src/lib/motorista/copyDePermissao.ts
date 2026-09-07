/**
 * Copy compartilhada entre os pontos do app que pedem permissão de
 * localização ao motorista.
 *
 * POR QUE EXISTE. `oferecerSaidaParaConfiguracoes` (`@/lib/permissoes`) recebe
 * a copy por parâmetro para não precisar de um dialog próprio — mas isso
 * também significa que cada chamador precisaria inventar a própria redação.
 * As três telas de navegação (`NavigationMode`, `NavigationMode.web` e
 * `TurnByTurnNavigation`) pedem a mesma permissão pelo mesmo motivo (sem GPS
 * não há como navegar até a entrega); uma constante evita três textos
 * ligeiramente diferentes para o mesmo bloqueio.
 *
 * Só `COPY_LOCALIZACAO` neste arquivo por enquanto: `COPY_CAMERA` e
 * `COPY_GALERIA` entram aqui quando o call site que as usa for migrado —
 * criá-las sem consumidor deixaria código sem uso no diff.
 */
import type { CopyDePermissao } from '@/lib/permissoes';

export const COPY_LOCALIZACAO: CopyDePermissao = {
  titulo: 'Acesso à localização',
  mensagemNegada:
    'Sem acesso à sua localização não é possível navegar até a entrega.',
  mensagemBloqueada:
    'O acesso à localização está bloqueado. Libere em Configurações para navegar até a entrega.',
};
