/**
 * RouteInfoHeaderCompact - Header compacto com todas informações em 1 linha
 * Padrão: [Motorista] ● Status   Distância   Paradas         [Cancelar]
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

import type { Rota, ResumoParadas } from './types';

interface RouteInfoHeaderCompactProps {
  rota: Rota;
  resumoParadas: ResumoParadas;
  onCancelPress?: () => void;
  onReactivatePress?: () => void;
}

const STATUS_CONFIG = {
  pendente: { label: 'Pendente', color: 'warning' as const, icon: 'time' as const },
  em_andamento: { label: 'Em rota', color: 'info' as const, icon: 'navigate' as const },
  concluida: { label: 'Concluída', color: 'success' as const, icon: 'checkmark-circle' as const },
  cancelada: { label: 'Cancelada', color: 'error' as const, icon: 'close-circle' as const },
  nao_executada: { label: 'Não Executada', color: 'warning' as const, icon: 'alert-circle' as const },
};

export function RouteInfoHeaderCompact({
  rota,
  resumoParadas,
  onCancelPress,
  onReactivatePress,
}: RouteInfoHeaderCompactProps) {
  const { theme } = useUnistyles();

  const statusConfig = useMemo(() => {
    const status = rota.status as keyof typeof STATUS_CONFIG;
    return STATUS_CONFIG[status] || STATUS_CONFIG.pendente;
  }, [rota.status]);

  const statusColor = theme.colors[statusConfig.color];
  const canCancel = rota.status !== 'cancelada' && rota.status !== 'concluida' && rota.status !== 'nao_executada';
  const canReactivate = rota.status === 'nao_executada';

  return (
    <View style={styles.container}>
      {/* Motorista */}
      <View style={styles.driverSection}>
        <Ionicons name="person-circle" size={24} color={theme.colors.primary} />
        <Text style={styles.driverName} numberOfLines={1}>
          {rota.motorista?.nome || 'Sem motorista'}
        </Text>
      </View>

      {/* Separador */}
      <View style={styles.separator} />

      {/* Status Badge */}
      <View style={[styles.statusBadge, { backgroundColor: `${statusColor}15`, borderColor: statusColor }]}>
        <Ionicons name={statusConfig.icon} size={14} color={statusColor} />
        <Text style={[styles.statusText, { color: statusColor }]}>
          {statusConfig.label}
        </Text>
      </View>

      {/* Métricas */}
      <View style={styles.metrics}>
        {/* Distância */}
        {rota.distancia_total && (
          <View style={styles.metric}>
            <Ionicons name="speedometer-outline" size={14} color={theme.colors.gray500} />
            <Text style={styles.metricValue}>{rota.distancia_total.toFixed(1)} km</Text>
          </View>
        )}

        {/* Paradas */}
        <View style={styles.metric}>
          <Ionicons name="flag-outline" size={14} color={theme.colors.gray500} />
          <Text style={styles.metricValue}>
            {resumoParadas.concluidas}/{resumoParadas.total}
          </Text>
          <Text style={styles.metricLabel}>paradas</Text>
        </View>
      </View>

      {/* Spacer */}
      <View style={styles.spacer} />

      {/* Botão Cancelar */}
      {canCancel && onCancelPress && (
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={onCancelPress}
          activeOpacity={0.7}
        >
          <Ionicons name="close-circle-outline" size={16} color={theme.colors.error} />
          <Text style={styles.cancelText}>Cancelar</Text>
        </TouchableOpacity>
      )}

      {/* Botão Reativar (para rotas expiradas) */}
      {canReactivate && onReactivatePress && (
        <TouchableOpacity
          style={styles.reactivateButton}
          onPress={onReactivatePress}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh-circle-outline" size={16} color={theme.colors.success} />
          <Text style={styles.reactivateText}>Reativar</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    paddingVertical: theme.spacing.sm + 2,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.gray100,
    marginBottom: theme.spacing.lg,
    gap: theme.spacing.md,
    flexWrap: 'wrap',
  },
  driverSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  driverName: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.gray900,
    maxWidth: 150,
  },
  separator: {
    width: 1,
    height: 20,
    backgroundColor: theme.colors.gray200,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: theme.spacing.sm + 2,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
  },
  statusText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '600',
  },
  metrics: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.lg,
  },
  metric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricValue: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.gray900,
  },
  metricLabel: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray500,
  },
  spacer: {
    flex: 1,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: theme.spacing.sm + 2,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: `${theme.colors.error}40`,
    backgroundColor: `${theme.colors.error}08`,
  },
  cancelText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '600',
    color: theme.colors.error,
  },
  reactivateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: theme.spacing.sm + 2,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: `${theme.colors.success}40`,
    backgroundColor: `${theme.colors.success}08`,
  },
  reactivateText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '600',
    color: theme.colors.success,
  },
}));
