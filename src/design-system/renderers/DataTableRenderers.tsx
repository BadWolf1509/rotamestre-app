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
import { propsDoStatusBadge } from '@/constants/statusConfig';
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

export function StatusCell({ status, label }: StatusCellProps) {
  const { theme } = useUnistyles();
  // Rótulo, cor, contraste e ícone vêm da config central; status
  // desconhecido cai no neutro de informação, com o texto cru.
  const selo = propsDoStatusBadge(status, theme.colors);

  return (
    <StatusBadge
      label={label || selo.label}
      color={selo.color}
      textColor={selo.textColor}
      variant="soft"
      size="sm"
      icon={selo.icon}
    />
  );
}
