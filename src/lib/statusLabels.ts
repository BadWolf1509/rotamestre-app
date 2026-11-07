/**
 * Status Labels - Portuguese (PT-BR)
 *
 * Centraliza todos os labels de status para garantir consistência
 * de acentuação e capitalização em todo o app.
 *
 * Padrão:
 * - Database: lowercase, sem acentos (concluida, pendente, em_andamento)
 * - Display: inicial maiúscula só na primeira palavra, com acentos
 *   (Concluída, Pendente, Em andamento). Os de rota vêm de ROUTE_STATUS_CONFIG.
 */

import { ROUTE_STATUS_CONFIG } from '@/constants/statusConfig';

// ============================================
// ROTA STATUS LABELS
// ============================================

export type RotaStatus =
  'pendente' | 'em_andamento' | 'concluida' | 'cancelada' | 'nao_executada';

// Grafia única: o mesmo texto do selo de status (ROUTE_STATUS_CONFIG).
export const ROTA_STATUS_LABELS: Record<RotaStatus, string> = {
  pendente: ROUTE_STATUS_CONFIG.pendente.label,
  em_andamento: ROUTE_STATUS_CONFIG.em_andamento.label,
  concluida: ROUTE_STATUS_CONFIG.concluida.label,
  cancelada: ROUTE_STATUS_CONFIG.cancelada.label,
  nao_executada: ROUTE_STATUS_CONFIG.nao_executada.label,
};

export function getRotaStatusLabel(status: RotaStatus | string): string {
  return ROTA_STATUS_LABELS[status as RotaStatus] ?? status;
}

// ============================================
// PARADA STATUS LABELS
// ============================================

export type ParadaStatus = 'pendente' | 'concluida' | 'pulada';

export const PARADA_STATUS_LABELS: Record<ParadaStatus, string> = {
  pendente: 'Pendente',
  concluida: 'Concluída',
  pulada: 'Pulada',
};

/**
 * Labels com ícones para exibição em cards/badges
 */
export const PARADA_STATUS_LABELS_WITH_ICON: Record<ParadaStatus, string> = {
  pendente: 'Pendente',
  concluida: '✓ Concluída',
  pulada: '↷ Pulada',
};

export function getParadaStatusLabel(
  status: ParadaStatus | string,
  withIcon = false,
): string {
  const labels = withIcon
    ? PARADA_STATUS_LABELS_WITH_ICON
    : PARADA_STATUS_LABELS;
  return labels[status as ParadaStatus] ?? status;
}

// ============================================
// PARADA IN-ROUTE LABELS
// ============================================

/**
 * Labels especiais para paradas dentro de uma rota ativa
 * (quando a parada ainda não foi processada mas a rota está em andamento)
 */
export const PARADA_IN_ROUTE_LABEL = 'Em Rota';

export function getParadaContextLabel(
  status: ParadaStatus | string,
  isRouteActive: boolean,
  withIcon = false,
): string {
  // Se a rota está ativa e a parada está pendente, mostra "Em Rota"
  if (isRouteActive && status === 'pendente') {
    return PARADA_IN_ROUTE_LABEL;
  }
  return getParadaStatusLabel(status, withIcon);
}

// ============================================
// FILTRO STATUS LABELS
// ============================================

export type FiltroStatus = 'todas' | RotaStatus;

export const FILTRO_STATUS_OPTIONS: FiltroStatus[] = [
  'todas',
  'pendente',
  'em_andamento',
  'concluida',
  'cancelada',
  'nao_executada',
];

export function getFiltroStatusLabel(status: FiltroStatus): string {
  if (status === 'todas') return 'Todas';
  return ROTA_STATUS_LABELS[status] ?? status;
}
