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
import { formatarDecimal } from '@/lib/formatNumber';
import type { IconName } from '@/types/icons';
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

const statusLabels: Record<StatusType, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
  nao_executada: 'Não executada',
  pulada: 'Pulada',
};

/**
 * Maps status types to theme color keys
 */
const statusColorKeys: Record<
  StatusType,
  'warning' | 'info' | 'success' | 'error'
> = {
  pendente: 'warning',
  em_andamento: 'info',
  concluida: 'success',
  cancelada: 'error',
  nao_executada: 'error',
  pulada: 'warning',
};

export function StatusCell({ status, label }: StatusCellProps) {
  const { theme } = useUnistyles();
  const displayLabel = label || statusLabels[status as StatusType] || status;
  const colorKey = statusColorKeys[status as StatusType] || 'info';
  const color = theme.colors[colorKey];

  return <StatusBadge label={displayLabel} color={color} size="sm" />;
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
// DATE CELL
// ============================================

interface DateCellProps {
  /** Date value (ISO string, Date object, or timestamp) */
  date: string | Date | number | null | undefined;
  /** Format style */
  format?: 'date' | 'time' | 'datetime' | 'relative';
  /** Fallback text when date is null/undefined */
  fallback?: string;
}

export function DateCell({
  date,
  format = 'date',
  fallback = '--',
}: DateCellProps) {
  if (!date) {
    return <Text style={styles.dateFallback}>{fallback}</Text>;
  }

  const dateObj =
    typeof date === 'string' || typeof date === 'number'
      ? new Date(date)
      : date;

  if (Number.isNaN(dateObj.getTime())) {
    return <Text style={styles.dateFallback}>{fallback}</Text>;
  }

  let formattedDate: string;

  if (format === 'relative') {
    const now = new Date();
    const diffMs = now.getTime() - dateObj.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      formattedDate = 'Agora';
    } else if (diffMins < 60) {
      formattedDate = `${diffMins} min atrás`;
    } else if (diffHours < 24) {
      formattedDate = `${diffHours}h atrás`;
    } else if (diffDays < 7) {
      formattedDate = `${diffDays}d atrás`;
    } else {
      formattedDate = dateObj.toLocaleDateString('pt-BR');
    }
  } else {
    const options: Intl.DateTimeFormatOptions = {
      ...(format === 'date' || format === 'datetime'
        ? { dateStyle: 'short' }
        : {}),
      ...(format === 'time' || format === 'datetime'
        ? { timeStyle: 'short' }
        : {}),
    } as Intl.DateTimeFormatOptions;
    formattedDate = new Intl.DateTimeFormat('pt-BR', options).format(dateObj);
  }

  return <Text style={styles.dateText}>{formattedDate}</Text>;
}

// ============================================
// CURRENCY CELL
// ============================================

interface CurrencyCellProps {
  /** Value in cents or as decimal */
  value: number | null | undefined;
  /** Currency code */
  currency?: string;
  /** Whether value is in cents */
  cents?: boolean;
  /** Fallback text */
  fallback?: string;
}

export function CurrencyCell({
  value,
  currency = 'BRL',
  cents = false,
  fallback = '--',
}: CurrencyCellProps) {
  if (value == null) {
    return <Text style={styles.currencyFallback}>{fallback}</Text>;
  }

  const displayValue = cents ? value / 100 : value;
  const formatted = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
  }).format(displayValue);

  return <Text style={styles.currencyText}>{formatted}</Text>;
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
// DURATION CELL
// ============================================

interface DurationCellProps {
  /** Duration in minutes */
  minutes: number | null | undefined;
  /** Fallback text */
  fallback?: string;
}

export function DurationCell({ minutes, fallback = '--' }: DurationCellProps) {
  const { theme } = useUnistyles();

  if (minutes == null) {
    return <Text style={styles.durationFallback}>{fallback}</Text>;
  }

  let displayText: string;
  if (minutes < 60) {
    displayText = `${minutes} min`;
  } else {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    displayText = mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  }

  return (
    <View style={styles.durationContainer}>
      <Ionicons name="time-outline" size={14} color={theme.colors.gray500} />
      <Text style={styles.durationText}>{displayText}</Text>
    </View>
  );
}

// ============================================
// ICON CELL
// ============================================

interface IconCellProps {
  /** Ionicons icon name */
  icon: IconName;
  /** Text to display after icon */
  text?: string;
  /** Icon color */
  color?: string;
  /** Icon size */
  size?: number;
}

export function IconCell({ icon, text, color, size = 16 }: IconCellProps) {
  const { theme } = useUnistyles();
  const iconColor = color || theme.colors.gray600;

  return (
    <View style={styles.iconContainer}>
      <Ionicons name={icon} size={size} color={iconColor} />
      {text && <Text style={styles.iconText}>{text}</Text>}
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
