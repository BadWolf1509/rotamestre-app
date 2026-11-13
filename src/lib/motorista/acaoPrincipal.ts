/**
 * Regras puras da Início do motorista, fora do componente para serem testadas
 * sem React: qual é a ação principal em cada estado da rota e o tempo desde
 * que ela começou.
 *
 * Antes eram dois `switch` sobre `routeStatus` na tela (o do botão e o da ação)
 * que precisavam concordar entre si. Aqui o estado define as duas coisas.
 */

import type { RouteStatus } from '@/context/route-status/types';
import type { IconName } from '@/types/icons';

import { formatarDuracao } from './formatarDuracao';

/** O que a ação principal faz; quem chama decide como (rota, diálogo…). */
type DestinoDaAcaoPrincipal =
  | 'iniciar-rota'
  | 'navegar'
  | 'finalizar-rota'
  | 'ver-resumo'
  | 'ver-historico';

export interface AcaoPrincipal {
  rotulo: string;
  icone: IconName;
  /** Chave de cor do tema; a tela resolve para o valor do tema atual. */
  cor: 'success' | 'secondary' | 'primary';
  destino: DestinoDaAcaoPrincipal;
}

export function acaoPrincipal(status: RouteStatus): AcaoPrincipal {
  switch (status) {
    case 'pending':
      return {
        rotulo: 'Iniciar',
        icone: 'play-circle',
        cor: 'success',
        destino: 'iniciar-rota',
      };
    case 'active':
    case 'last-stop':
      return {
        rotulo: 'Navegar',
        icone: 'navigate',
        cor: 'secondary',
        destino: 'navegar',
      };
    case 'ready-to-complete':
      return {
        rotulo: 'Finalizar',
        icone: 'checkmark-circle',
        cor: 'success',
        destino: 'finalizar-rota',
      };
    case 'completed':
      return {
        rotulo: 'Detalhes',
        icone: 'document-text',
        cor: 'primary',
        destino: 'ver-resumo',
      };
    case 'no-route':
    default:
      return {
        rotulo: 'Histórico',
        icone: 'time',
        cor: 'primary',
        destino: 'ver-historico',
      };
  }
}

/**
 * "2h 3min" desde `iniciadaEm` (timestamp com fuso, pode usar `Date`).
 * `agora` entra por parâmetro: a tela o atualiza num intervalo e o teste não
 * depende do relógio.
 */
export function formatarTempoDecorrido(
  iniciadaEm: string | null | undefined,
  agora: Date,
): string | null {
  if (!iniciadaEm) return null;
  return formatarDuracao(agora.getTime() - new Date(iniciadaEm).getTime());
}
