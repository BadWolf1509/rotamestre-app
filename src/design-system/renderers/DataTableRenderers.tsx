/**
 * ============================================
 * DataTable Column Renderers
 * ============================================
 *
 * Renderers reutilizáveis para colunas do DataTable. Hoje, só o de status:
 *
 * ```tsx
 * import { StatusCell } from '@/design-system';
 *
 * const columns: DataTableColumn<Rota>[] = [
 *   {
 *     key: 'status',
 *     label: 'Status',
 *     render: (item) => <StatusCell status={item.status} />,
 *   },
 * ];
 * ```
 */

import React from 'react';

import { StatusBadge } from '@/components/StatusBadge';
import {
  ROUTE_STATUS_CONFIG,
  STOP_STATUS_CONFIG,
  type RouteStatusType,
  type StatusConfig,
  type StopStatusType,
  corDeTextoDoStatus,
} from '@/constants/statusConfig';
import { useUnistyles } from '@/utils/styles';

// ============================================
// STATUS CELL
// ============================================

type StatusType =
  | 'pendente'
  | 'em_andamento'
  | 'concluida'
  | 'cancelada'
  | 'nao_executada'
  | 'pulada';

interface StatusCellProps {
  /** Status value */
  status: StatusType | string;
  /** Custom label (overrides default) */
  label?: string;
}

/**
 * Rótulo, cor e ícone vêm da config central (ROUTE_STATUS_CONFIG para rota,
 * STOP_STATUS_CONFIG para parada). Status desconhecido cai no texto cru, em
 * cor neutra de informação.
 */
function configDoStatus(status: string): StatusConfig | undefined {
  return (
    ROUTE_STATUS_CONFIG[status as RouteStatusType] ??
    STOP_STATUS_CONFIG[status as StopStatusType]
  );
}

export function StatusCell({ status, label }: StatusCellProps) {
  const { theme } = useUnistyles();
  const config = configDoStatus(status);
  const displayLabel = label || config?.label || status;
  const colorKey = config?.colorKey ?? 'info';

  return (
    <StatusBadge
      label={displayLabel}
      color={theme.colors[colorKey]}
      textColor={corDeTextoDoStatus(colorKey, theme.colors)}
      variant="soft"
      size="sm"
      icon={config?.icon}
    />
  );
}
