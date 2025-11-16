import { View, Text, TouchableOpacity } from 'react-native';

import { StyleSheet, useUnistyles } from '@/utils/styles';

import type { RotaResumo } from '../../dashboard/_hooks/useDashboardData';

interface RotaCardProps {
  rota: RotaResumo;
  onPress?: () => void;
}

function getStatusColor(status: string, theme: any): string {
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

function parseLocalDate(dateStr?: string): Date | null {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function formatDate(dateStr?: string): string {
  const date = parseLocalDate(dateStr);
  return date ? date.toLocaleDateString('pt-BR') : '-';
}

/**
 * Card de rota compartilhado entre mobile e desktop
 */
export function RotaCard({ rota, onPress }: RotaCardProps) {
  const { theme } = useUnistyles();

  const progressPercent = rota.total_paradas > 0
    ? (rota.paradas_concluidas / rota.total_paradas) * 100
    : 0;

  const statusColor = getStatusColor(rota.status, theme);

  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.container}
      activeOpacity={0.7}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.motoristaNome}>
          {rota.motorista_nome}
        </Text>
        <View style={[styles.badge, { backgroundColor: statusColor }]}>
          <Text style={styles.badgeText}>
            {getStatusLabel(rota.status)}
          </Text>
        </View>
      </View>

      {/* Data */}
      <Text style={styles.data}>
        {formatDate(rota.data)}
      </Text>

      {/* Stats */}
      <View style={styles.statsRow}>
        <Text style={styles.statText}>
          📍 {rota.paradas_concluidas}/{rota.total_paradas} paradas
        </Text>
        {rota.distancia_total > 0 && (
          <Text style={styles.statText}>
            🚗 {rota.distancia_total.toFixed(1)} km
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
}

const styles = StyleSheet.create(theme => ({
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
