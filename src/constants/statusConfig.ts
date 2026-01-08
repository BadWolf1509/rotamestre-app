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
  | 'pendente'
  | 'em_andamento'
  | 'concluida'
  | 'cancelada'
  | 'nao_executada';

/**
 * Stop status types
 */
export type StopStatusType = 'pendente' | 'concluida' | 'pulada';

/**
 * Theme color keys for status mapping
 */
export type StatusColorKey = 'warning' | 'info' | 'success' | 'error' | 'gray600';

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
export function getStatusLabel(status: RouteStatusType | StopStatusType): string {
  return (
    ROUTE_STATUS_CONFIG[status as RouteStatusType]?.label ||
    STOP_STATUS_CONFIG[status as StopStatusType]?.label ||
    status
  );
}

/**
 * Get status color key from status type
 */
export function getStatusColorKey(status: RouteStatusType | StopStatusType): StatusColorKey {
  return (
    ROUTE_STATUS_CONFIG[status as RouteStatusType]?.colorKey ||
    STOP_STATUS_CONFIG[status as StopStatusType]?.colorKey ||
    'info'
  );
}

/**
 * Get status icon from status type
 */
export function getStatusIcon(status: RouteStatusType | StopStatusType): IconName {
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
  colorResolver: (colorKey: StatusColorKey) => string
): string {
  if (!status) return colorResolver('warning');

  const colorKey =
    ROUTE_STATUS_CONFIG[status as RouteStatusType]?.colorKey ||
    STOP_STATUS_CONFIG[status as StopStatusType]?.colorKey ||
    'warning';

  return colorResolver(colorKey);
}
