/**
 * ============================================
 * DataTable Column Renderers
 * ============================================
 *
 * Reusable render functions for common DataTable column types.
 * These can be used directly in column definitions or composed
 * to create custom renderers.
 *
 * Usage:
 * ```tsx
 * import { ProgressCell, StatusCell, UserCell } from '@/design-system';
 *
 * const columns: DataTableColumn<Rota>[] = [
 *   {
 *     key: 'motorista',
 *     label: 'Motorista',
 *     render: (item) => <UserCell name={item.motorista_nome} avatarUrl={item.motorista_foto} />,
 *   },
 *   {
 *     key: 'status',
 *     label: 'Status',
 *     render: (item) => <StatusCell status={item.status} />,
 *   },
 *   {
 *     key: 'progresso',
 *     label: 'Progresso',
 *     render: (item) => <ProgressCell value={item.concluidas} total={item.total} />,
 *   },
 * ];
 * ```
 */

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { StatusBadge } from '@/components/StatusBadge';
import { Text } from '@/components/Text';
import {
  ROUTE_STATUS_CONFIG,
  STOP_STATUS_CONFIG,
  type RouteStatusType,
  type StatusConfig,
  type StopStatusType,
} from '@/constants/statusConfig';
import { formatarDecimal } from '@/lib/formatNumber';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

// ============================================
// PROGRESS CELL
// ============================================

interface ProgressCellProps {
  /** Current value */
  value: number;
  /** Total/max value */
  total: number;
  /** Show percentage text */
  showPercentage?: boolean;
  /** Show fraction text (e.g., "5/10") */
  showFraction?: boolean;
  /** Color of the progress bar (defaults to theme.colors.success) */
  color?: string;
}

export function ProgressCell({
  value,
  total,
  showPercentage = false,
  showFraction = true,
  color,
}: ProgressCellProps) {
  const { theme } = useUnistyles();
  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
  const progressColor = color || theme.colors.success;

  return (
    <View style={styles.progressContainer}>
      <View
        style={[styles.progressBar, { backgroundColor: theme.colors.gray200 }]}
      >
        <View
          style={[
            styles.progressFill,
            {
              width: `${percentage}%`,
              backgroundColor: progressColor,
            },
          ]}
        />
      </View>
      <Text style={styles.progressText}>
        {showFraction && `${value}/${total}`}
        {showPercentage && ` (${percentage}%)`}
      </Text>
    </View>
  );
}

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
  const color = theme.colors[config?.colorKey ?? 'info'];

  return (
    <StatusBadge
      label={displayLabel}
      color={color}
      variant="soft"
      size="sm"
      icon={config?.icon}
    />
  );
}

// ============================================
// USER CELL
// ============================================

interface UserCellProps {
  /** User name */
  name: string;
  /** Avatar image URL */
  avatarUrl?: string | null;
  /** Secondary text (e.g., email, role) */
  subtitle?: string;
  /** Avatar size */
  size?: 'sm' | 'md';
}

export function UserCell({
  name,
  avatarUrl,
  subtitle,
  size = 'sm',
}: UserCellProps) {
  return (
    <View style={styles.userContainer}>
      <Avatar name={name} imageUrl={avatarUrl} size={size} />
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{name}</Text>
        {subtitle && <Text style={styles.userSubtitle}>{subtitle}</Text>}
      </View>
    </View>
  );
}

// ============================================
// DISTANCE CELL
// ============================================

interface DistanceCellProps {
  /** Distance in kilometers */
  km: number | null | undefined;
  /** Show unit label */
  showUnit?: boolean;
  /** Fallback text */
  fallback?: string;
}

export function DistanceCell({
  km,
  showUnit = true,
  fallback = '--',
}: DistanceCellProps) {
  const { theme } = useUnistyles();

  if (km == null) {
    return <Text style={styles.distanceFallback}>{fallback}</Text>;
  }

  return (
    <View style={styles.distanceContainer}>
      <Ionicons
        name="speedometer-outline"
        size={14}
        color={theme.colors.gray500}
      />
      <Text style={styles.distanceText}>
        {formatarDecimal(km)}
        {showUnit && ' km'}
      </Text>
    </View>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create((theme: Theme) => ({
  // Progress Cell
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    minWidth: 120,
  },
  progressBar: {
    flex: 1,
    height: 6,
    borderRadius: theme.borderRadius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: theme.borderRadius.full,
  },
  progressText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray600,
    fontFamily: theme.typography.fontSansMedium,
    minWidth: 40,
  },

  // User Cell
  userContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray900,
    fontFamily: theme.typography.fontSansMedium,
  },
  userSubtitle: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray500,
    fontFamily: theme.typography.fontSans,
    marginTop: 2,
  },

  // Date Cell
  dateText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray700,
    fontFamily: theme.typography.fontSans,
  },
  dateFallback: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray400,
    fontFamily: theme.typography.fontSans,
  },

  // Currency Cell
  currencyText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray900,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  currencyFallback: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray400,
    fontFamily: theme.typography.fontSans,
  },

  // Distance Cell
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  distanceText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray700,
    fontFamily: theme.typography.fontSans,
  },
  distanceFallback: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray400,
    fontFamily: theme.typography.fontSans,
  },

  // Duration Cell
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  durationText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray700,
    fontFamily: theme.typography.fontSans,
  },
  durationFallback: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray400,
    fontFamily: theme.typography.fontSans,
  },

  // Icon Cell
  iconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  iconText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray700,
    fontFamily: theme.typography.fontSans,
  },
}));
