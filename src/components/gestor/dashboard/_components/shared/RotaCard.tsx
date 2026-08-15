/**
 * RotaCard - Route summary card for dashboard
 *
 * Displays a route's key information: driver name, date, status, and progress.
 * Used in both mobile (card list) and desktop (within RotasTable) views.
 *
 * Features:
 * - Status badge with color coding
 * - Progress bar showing completed/total stops
 * - Distance display
 * - Touch handling for navigation to details
 *
 * Performance Optimizations:
 * - Memoized with custom comparison function
 * - useMemo for computed values (progressPercent, statusColor, statusLabel)
 * - Only re-renders when id, status, or paradas counts change
 */

import { memo, useMemo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

import { formatDateBR } from '@/lib/dateUtils';
import { formatarDecimal } from '@/lib/formatNumber';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

import type { RotaResumo } from '../../_hooks/useDashboardData';

interface RotaCardProps {
  /** Route data to display */
  rota: RotaResumo;
  /** Callback when card is pressed */
  onPress?: () => void;
}

function getStatusColor(status: string, theme: Theme): string {
  switch (status) {
    case 'em_andamento':
      return theme.colors.secondary;
    case 'concluida':
      return theme.colors.success;
    case 'pendente':
      return theme.colors.gray500;
    case 'cancelada':
      return theme.colors.error;
    default:
      return theme.colors.gray500;
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'em_andamento':
      return 'Em Andamento';
    case 'concluida':
      return 'Concluída';
    case 'pendente':
      return 'Pendente';
    case 'cancelada':
      return 'Cancelada';
    default:
      return status;
  }
}

/**
 * Card de rota compartilhado entre mobile e desktop
 * Memoizado para evitar re-renders desnecessários em listas
 */
export const RotaCard = memo(
  function RotaCard({ rota, onPress }: RotaCardProps) {
    const { theme } = useUnistyles();

    // Memoize computed values para evitar recálculo a cada render
    const { progressPercent, statusColor, statusLabel } = useMemo(
      () => ({
        progressPercent:
          rota.total_paradas > 0
            ? (rota.paradas_concluidas / rota.total_paradas) * 100
            : 0,
        statusColor: getStatusColor(rota.status, theme),
        statusLabel: getStatusLabel(rota.status),
      }),
      [rota.total_paradas, rota.paradas_concluidas, rota.status, theme],
    );

    return (
      <TouchableOpacity
        testID={`rota-card-${rota.id}`}
        onPress={onPress}
        style={styles.container}
        activeOpacity={0.7}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.motoristaNome}>{rota.motorista_nome}</Text>
          <View style={[styles.badge, { backgroundColor: statusColor }]}>
            <Text style={styles.badgeText}>{statusLabel}</Text>
          </View>
        </View>

        {/* Data */}
        <Text style={styles.data}>{formatDateBR(rota.data)}</Text>

        {/* Stats */}
        <View style={styles.statsRow}>
          <Text style={styles.statText}>
            📍 {rota.paradas_concluidas}/{rota.total_paradas} paradas
          </Text>
          {rota.distancia_total > 0 && (
            <Text style={styles.statText}>
              🚗 {formatarDecimal(rota.distancia_total)} km
            </Text>
          )}
        </View>

        {/* Progress Bar */}
        {rota.total_paradas > 0 && (
          <View style={styles.progressBarContainer}>
            <View
              style={[
                styles.progressBar,
                {
                  width: `${progressPercent}%`,
                  backgroundColor: statusColor,
                },
              ]}
            />
          </View>
        )}
      </TouchableOpacity>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison - re-render apenas se dados relevantes mudarem
    return (
      prevProps.rota.id === nextProps.rota.id &&
      prevProps.rota.status === nextProps.rota.status &&
      prevProps.rota.paradas_concluidas === nextProps.rota.paradas_concluidas &&
      prevProps.rota.total_paradas === nextProps.rota.total_paradas
    );
  },
);

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    backgroundColor: theme.colors.white,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    ...theme.shadows.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  motoristaNome: {
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
  },
  badge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.md,
  },
  badgeText: {
    fontSize: theme.typography.xs,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.white,
  },
  data: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray500,
    marginBottom: theme.spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    gap: theme.spacing.lg,
  },
  statText: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray700,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: theme.colors.gray200,
    borderRadius: theme.borderRadius.full,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: theme.borderRadius.full,
  },
}));
