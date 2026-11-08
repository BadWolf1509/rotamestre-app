/**
 * ============================================
 * Status Configuration - Centralized
 * ============================================
 *
 * Single source of truth for route/stop status configuration.
 * Used across Badge, StatusBadge, StatusCell, and all screens.
 */

import type { IconName } from '@/types/icons';
import type { StatusParada, StatusRota } from '@/types/rota';
import type { Theme } from '@/utils/styles.types';

/**
 * Route status types used throughout the app
 */
export type RouteStatusType = StatusRota;

/**
 * Stop status types
 */
export type StopStatusType = StatusParada;

/**
 * Theme color keys for status mapping
 */
export type StatusColorKey =
  'warning' | 'info' | 'success' | 'error' | 'gray600';

/**
 * Opacidade do fundo do selo soft (cor do status sobre o cartão). Os tons de
 * `corDeTextoDoStatus` passam de 4,5:1 sobre esse fundo nos dois temas.
 */
export const OPACIDADE_FUNDO_STATUS_SOFT = 0.1;

type CoresDeTextoDoStatus = Pick<
  Theme['colors'],
  'warningText' | 'infoText' | 'successDark' | 'errorText' | 'gray600'
>;

/**
 * Cor do texto (e do ícone) de um status sobre o fundo claro do selo soft.
 * A cor do próprio status sobre ela mesma a 10–15% fica entre 1,9 e 3,1:1;
 * estes tons passam de 4,5:1 no tema claro e no escuro.
 */
export function corDeTextoDoStatus(
  colorKey: StatusColorKey,
  colors: CoresDeTextoDoStatus,
): string {
  switch (colorKey) {
    case 'warning':
      return colors.warningText;
    case 'info':
      return colors.infoText;
    case 'success':
      return colors.successDark;
    case 'error':
      return colors.errorText;
    case 'gray600':
      return colors.gray600;
  }
}

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

type CoresDoSelo = CoresDeTextoDoStatus &
  Pick<Theme['colors'], 'warning' | 'info' | 'success' | 'error'>;

export interface PropsDoStatusBadge {
  color: string;
  textColor: string;
  icon: IconName;
  label: string;
}

function propsDaConfig(config: StatusConfig, colors: CoresDoSelo) {
  return {
    color: colors[config.colorKey],
    textColor: corDeTextoDoStatus(config.colorKey, colors),
    icon: config.icon,
    label: config.label,
  };
}

/**
 * Trio do `StatusBadge` (cor, cor do texto com contraste, ícone) mais o rótulo,
 * de um status de rota — com `pulada` caindo na config da parada. Valor fora
 * das listas (status novo no CHECK) vira o neutro de informação, com o texto
 * sem o sublinhado, em vez de quebrar. Os selos de rota usam isto para não
 * remontar o trio à mão (e esquecer o contraste).
 */
export function propsDoStatusBadge(
  status: string,
  colors: CoresDoSelo,
): PropsDoStatusBadge {
  const chave = status.toLowerCase();
  const config =
    ROUTE_STATUS_CONFIG[chave as RouteStatusType] ??
    STOP_STATUS_CONFIG[chave as StopStatusType];
  if (config) return propsDaConfig(config, colors);
  return {
    color: colors.info,
    textColor: corDeTextoDoStatus('info', colors),
    icon: 'help-circle-outline',
    label: rotuloDoStatus(status),
  };
}

/**
 * O mesmo trio para o status de uma parada (ícones próprios: `pendente` é
 * círculo vazio, não ampulheta). Fora da lista cai em `pendente`.
 */
export function propsDoStatusBadgeDaParada(
  status: string,
  colors: CoresDoSelo,
): PropsDoStatusBadge {
  return propsDaConfig(
    STOP_STATUS_CONFIG[status as StopStatusType] ?? STOP_STATUS_CONFIG.pendente,
    colors,
  );
}
