/**
 * MainCardPending - Content for pending state (route assigned but not started)
 */

import { Ionicons } from '@expo/vector-icons';
import React, { memo } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Text } from '@/design-system';
import { useUnistyles } from '@/utils/styles';

import { ExpirationWarning } from '../ExpirationWarning';
import { styles } from '../MainCard.styles';
import { PreRouteChecklist } from '../PreRouteChecklist';
import { formatEstimatedTime, filterRealStops } from './MainCard.utils';

import type { Parada, Rota } from './MainCard.types';

interface MainCardPendingProps {
  route: Rota | null;
  paradas: Parada[];
  pendingRoutesCount: number;
  firstStopDistance: {
    isLoading: boolean;
    distanceKm: string;
    durationText: string;
  };
  onChecklistChange?: (canStart: boolean, allOk: boolean) => void;
}

export const MainCardPending = memo(function MainCardPending({
  route,
  paradas,
  pendingRoutesCount,
  firstStopDistance,
  onChecklistChange,
}: MainCardPendingProps) {
  const { theme } = useUnistyles();

  const paradasReais = filterRealStops(paradas);
  const pendingFirstStop = paradas.find((p) => p.is_checkpoint !== false);

  // Estimar tempo usando tempo_total quando disponível
  const estimatedMinutes =
    route?.tempo_total && route.tempo_total > 0
      ? route.tempo_total
      : route?.distancia_total
        ? Math.round((route.distancia_total / 30) * 60)
        : null;
  const estimatedTimeText = formatEstimatedTime(estimatedMinutes);

  return (
    <View style={styles.content}>
      {/* Aviso de expiração (a partir das 20:00) */}
      {route?.data && (
        <ExpirationWarning rotaData={route.data} rotaStatus={route.status} />
      )}

      {/* Nome da empresa + badge de rotas pendentes */}
      <View style={styles.empresaRow}>
        <Text style={styles.empresa}>
          {route?.unidade_nome || 'Rota Atribuída'}
        </Text>
        {pendingRoutesCount > 0 && (
          <View
            style={[
              styles.pendingBadge,
              { backgroundColor: theme.colors.secondary },
            ]}
          >
            <Text style={styles.pendingBadgeText}>+{pendingRoutesCount}</Text>
          </View>
        )}
      </View>

      {/* Stats inline */}
      <View style={styles.pendingStatsRow}>
        <View style={styles.pendingStatItem}>
          <Ionicons name="location" size={18} color={theme.colors.primary} />
          <Text style={styles.pendingStatValue}>{paradasReais.length}</Text>
          <Text style={styles.pendingStatLabel}>
            {paradasReais.length === 1 ? 'parada' : 'paradas'}
          </Text>
        </View>
        <View
          style={[
            styles.pendingStatDivider,
            { backgroundColor: theme.colors.gray200 },
          ]}
        />
        <View style={styles.pendingStatItem}>
          <Ionicons name="speedometer" size={18} color={theme.colors.primary} />
          <Text style={styles.pendingStatValue}>
            {route?.distancia_total || 0}
          </Text>
          <Text style={styles.pendingStatLabel}>km</Text>
        </View>
        <View
          style={[
            styles.pendingStatDivider,
            { backgroundColor: theme.colors.gray200 },
          ]}
        />
        <View style={styles.pendingStatItem}>
          <Ionicons name="time" size={18} color={theme.colors.primary} />
          <Text style={styles.pendingStatValue}>{estimatedTimeText}</Text>
          <Text style={styles.pendingStatLabel}>estimado</Text>
        </View>
      </View>

      {/* Primeira parada */}
      {pendingFirstStop && (
        <View style={styles.firstStopSection}>
          <Text style={styles.sectionLabel}>PRIMEIRA PARADA</Text>
          <Text style={styles.addressText} numberOfLines={2}>
            {pendingFirstStop.endereco}
          </Text>
          <View style={styles.distanceRow}>
            {firstStopDistance.isLoading ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <>
                <Ionicons
                  name="navigate"
                  size={14}
                  color={theme.colors.primary}
                />
                <Text
                  style={[styles.distanceText, { color: theme.colors.primary }]}
                >
                  {firstStopDistance.distanceKm} •{' '}
                  {firstStopDistance.durationText}
                </Text>
              </>
            )}
          </View>
        </View>
      )}

      {/* Checklist Pré-Rota */}
      <PreRouteChecklist onStatusChange={onChecklistChange} />
    </View>
  );
});
