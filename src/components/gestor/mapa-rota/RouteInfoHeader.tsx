/**
 * RouteInfoHeader - Barra de informações da rota (motorista, status, distância)
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

import { formatarDecimal } from '@/lib/formatNumber';
import { useUnistyles, type Theme } from '@/utils/styles';

import { styles } from './styles';

import type { Rota, ResumoParadas } from './types';

interface RouteInfoHeaderProps {
  rota: Rota;
  resumoParadas: ResumoParadas;
  onCancelPress?: () => void;
}

function getStatusBadgeVariant(theme: Theme, status?: string) {
  const palette = {
    pendente: {
      bg: theme.colors.warningBg,
      border: theme.colors.warning,
      text: theme.colors.warning,
    },
    em_andamento: {
      bg: theme.colors.infoBg,
      border: theme.colors.info,
      text: theme.colors.info,
    },
    concluida: {
      bg: theme.colors.successBg,
      border: theme.colors.success,
      text: theme.colors.success,
    },
    cancelada: {
      bg: theme.colors.errorBg,
      border: theme.colors.error,
      text: theme.colors.error,
    },
    nao_executada: {
      bg: theme.colors.yellow100,
      border: theme.colors.warning,
      text: theme.colors.warning,
    },
  };

  if (status && palette[status as keyof typeof palette]) {
    const paletteData = palette[status as keyof typeof palette];
    return {
      container: {
        backgroundColor: paletteData.bg,
        borderColor: paletteData.border,
      },
      text: {
        color: paletteData.text,
      },
    };
  }

  return {
    container: {
      backgroundColor: theme.colors.gray100,
      borderColor: theme.colors.gray200,
    },
    text: {
      color: theme.colors.gray700,
    },
  };
}

function formatStatusLabel(status?: string) {
  if (!status) return '-';
  const normalized = status.toLowerCase();
  const labels: Record<string, string> = {
    pendente: 'pendente',
    em_andamento: 'em andamento',
    concluida: 'concluída',
    cancelada: 'cancelada',
    nao_executada: 'não executada',
  };

  if (labels[normalized]) {
    return labels[normalized];
  }

  return normalized.replace(/_/g, ' ');
}

function formatTempoTotal(minutos: number) {
  if (minutos <= 0) return '-';
  const horas = Math.floor(minutos / 60);
  const mins = Math.round(minutos % 60);
  if (horas === 0) return `${mins} min`;
  return `${horas}h ${mins}min`;
}

export function RouteInfoHeader({
  rota,
  resumoParadas,
  onCancelPress,
}: RouteInfoHeaderProps) {
  const { theme } = useUnistyles();

  const statusBadgeVariant = useMemo(
    () => getStatusBadgeVariant(theme, rota?.status),
    [theme, rota?.status],
  );
  const statusLabel = useMemo(
    () => formatStatusLabel(rota?.status),
    [rota?.status],
  );

  const canCancel =
    rota?.status !== 'cancelada' && rota?.status !== 'concluida';

  return (
    <View style={styles.infoHeaderBar}>
      <View style={styles.infoHeaderRow}>
        {/* Driver Chip */}
        <View style={styles.driverChip}>
          <Ionicons
            name="person-circle-outline"
            size={20}
            color={theme.colors.primary}
          />
          <View>
            <Text style={styles.driverLabel}>Motorista</Text>
            <Text style={styles.driverName}>
              {rota?.motorista?.nome || 'Sem motorista'}
            </Text>
          </View>
        </View>

        {/* Info Chips */}
        <View style={styles.infoHeaderChipGroup}>
          {/* Status */}
          <View
            style={{
              flexDirection: 'row',
              gap: theme.spacing['2'],
              alignItems: 'center',
            }}
          >
            <Text style={styles.infoChipLabel}>Status:</Text>
            <View
              style={[
                styles.statusBadge,
                styles.statusBadgeDesktop,
                statusBadgeVariant.container,
              ]}
            >
              <Text
                style={[
                  styles.statusBadgeText,
                  styles.statusBadgeTextDesktop,
                  statusBadgeVariant.text,
                ]}
              >
                {statusLabel}
              </Text>
            </View>
          </View>

          {/* Distância */}
          {rota.distancia_total && (
            <View
              style={{
                flexDirection: 'row',
                gap: theme.spacing['2'],
                alignItems: 'center',
              }}
            >
              <Text style={styles.infoChipLabel}>Distância Total:</Text>
              <Text style={styles.infoChipValue}>
                {formatarDecimal(rota.distancia_total)} km
              </Text>
            </View>
          )}

          {/* Tempo Estimado */}
          {rota.tempo_total && (
            <View
              style={{
                flexDirection: 'row',
                gap: theme.spacing['2'],
                alignItems: 'center',
              }}
            >
              <Text style={styles.infoChipLabel}>Tempo Estimado:</Text>
              <Text style={styles.infoChipValue}>
                {formatTempoTotal(rota.tempo_total)}
              </Text>
            </View>
          )}

          {/* Paradas */}
          <View
            style={{
              flexDirection: 'row',
              gap: theme.spacing['2'],
              alignItems: 'center',
            }}
          >
            <Text style={styles.infoChipLabel}>Paradas:</Text>
            <Text style={styles.infoChipValue}>
              {resumoParadas.total > 0
                ? `${resumoParadas.concluidas}/${resumoParadas.total} concluídas`
                : 'Sem entregas'}
            </Text>
          </View>
        </View>

        {/* Cancel Button */}
        {canCancel && onCancelPress && (
          <TouchableOpacity
            onPress={onCancelPress}
            style={styles.cancelChip}
            activeOpacity={0.85}
          >
            <Ionicons
              name="close-circle-outline"
              size={16}
              color={theme.colors.error}
            />
            <Text style={styles.cancelChipText}>Cancelar rota</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// Export helpers for use in other places
export { getStatusBadgeVariant, formatStatusLabel };
