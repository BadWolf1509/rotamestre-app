/**
 * ============================================
 * Status Configuration - Centralized
 * ============================================
 *
 * Single source of truth for route/stop status configuration.
 * Used across Badge, StatusBadge, StatusCell, and all screens.
 */

import type { IconName } from '@/types/icons';

/**
 * Route status types used throughout the app
 */
export type RouteStatusType =
  'pendente' | 'em_andamento' | 'concluida' | 'cancelada' | 'nao_executada';

/**
 * Stop status types
 */
export type StopStatusType =
  'pendente' | 'em_andamento' | 'concluida' | 'pulada';

/**
 * Theme color keys for status mapping
 */
export type StatusColorKey =
  'warning' | 'info' | 'success' | 'error' | 'gray600';

/**
 * Status configuration with label, color key, and icon
 */
export interface StatusConfig {
  label: string;
  colorKey: StatusColorKey;
  icon: IconName;
}

/**
 * Route status configuration
 * - pendente: warning (yellow) - waiting to start
 * - em_andamento: info (blue) - in progress
 * - concluida: success (green) - completed
 * - cancelada: error (red) - cancelled
 * - nao_executada: error (red) - not executed (expired)
 */
export const ROUTE_STATUS_CONFIG: Record<RouteStatusType, StatusConfig> = {
  pendente: {
    label: 'Pendente',
    colorKey: 'warning',
    icon: 'hourglass-outline',
  },
  em_andamento: {
    label: 'Em andamento',
    colorKey: 'info',
    icon: 'time-outline',
  },
  concluida: {
    label: 'Concluída',
    colorKey: 'success',
    icon: 'checkmark-circle',
  },
  cancelada: {
    label: 'Cancelada',
    colorKey: 'error',
    icon: 'close-circle',
  },
  nao_executada: {
    label: 'Não executada',
    colorKey: 'error',
    icon: 'alert-circle',
  },
};

/**
 * Stop status configuration
 */
export const STOP_STATUS_CONFIG: Record<StopStatusType, StatusConfig> = {
  pendente: {
    label: 'Pendente',
    colorKey: 'warning',
    icon: 'ellipse-outline',
  },
  em_andamento: {
    label: 'Em andamento',
    colorKey: 'info',
    icon: 'navigate-circle',
  },
  concluida: {
    label: 'Concluída',
    colorKey: 'success',
    icon: 'checkmark-circle',
  },
  pulada: {
    label: 'Pulada',
    colorKey: 'warning',
    icon: 'play-skip-forward',
  },
};

/**
 * Get status label from status type
 */
export function getStatusLabel(
  status: RouteStatusType | StopStatusType,
): string {
  return (
    ROUTE_STATUS_CONFIG[status as RouteStatusType]?.label ||
    STOP_STATUS_CONFIG[status as StopStatusType]?.label ||
    status
  );
}

/**
 * Get status color key from status type
 */
export function getStatusColorKey(
  status: RouteStatusType | StopStatusType,
): StatusColorKey {
  return (
    ROUTE_STATUS_CONFIG[status as RouteStatusType]?.colorKey ||
    STOP_STATUS_CONFIG[status as StopStatusType]?.colorKey ||
    'info'
  );
}

/**
 * Get status icon from status type
 */
export function getStatusIcon(
  status: RouteStatusType | StopStatusType,
): IconName {
  return (
    ROUTE_STATUS_CONFIG[status as RouteStatusType]?.icon ||
    STOP_STATUS_CONFIG[status as StopStatusType]?.icon ||
    'help-circle-outline'
  );
}

/**
 * Get status color hex value from status type.
 * Uses a color resolver function to get actual hex values from theme.
 *
 * @param status - Route or stop status
 * @param colorResolver - Function that maps colorKey to hex value
 * @returns Hex color string
 */
export function getStatusColor(
  status: RouteStatusType | StopStatusType | string | undefined,
  colorResolver: (colorKey: StatusColorKey) => string,
): string {
  if (!status) return colorResolver('warning');

  const colorKey =
    ROUTE_STATUS_CONFIG[status as RouteStatusType]?.colorKey ||
    STOP_STATUS_CONFIG[status as StopStatusType]?.colorKey ||
    'warning';

  return colorResolver(colorKey);
}

/**
 * Rótulo legível de qualquer status de rota ou de parada, tolerante ao que vem
 * do banco: normaliza a caixa e, para valor fora das listas (status novo no
 * CHECK), devolve o texto sem o sublinhado em vez de quebrar.
 * Vazio, null ou undefined viram '-'.
 */
export function rotuloDoStatus(status: string | null | undefined): string {
  if (!status) return '-';
  const chave = status.toLowerCase();
  return (
    ROUTE_STATUS_CONFIG[chave as RouteStatusType]?.label ||
    STOP_STATUS_CONFIG[chave as StopStatusType]?.label ||
    chave.replace(/_/g, ' ')
  );
}

/**
 * Cor de cada status de rota, resolvida pelo chamador (tema). Mantém o
 * statusConfig puro: quem tem o `theme` passa o resolvedor.
 */
export function coresPorStatusDaRota(
  resolver: (colorKey: StatusColorKey) => string,
): Record<RouteStatusType, string> {
  const cores = {} as Record<RouteStatusType, string>;
  (Object.keys(ROUTE_STATUS_CONFIG) as RouteStatusType[]).forEach((status) => {
    cores[status] = resolver(ROUTE_STATUS_CONFIG[status].colorKey);
  });
  return cores;
}
