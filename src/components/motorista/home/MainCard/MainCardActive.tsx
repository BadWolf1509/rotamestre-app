/**
 * MainCardActive - Content for active route states
 *
 * Displays the current stop information with swipe actions for the motorista.
 * Used in both 'active' (route in progress) and 'last-stop' (final delivery) states.
 *
 * Features:
 * - Swipe left to skip stop
 * - Swipe right to complete stop
 * - Shows distance/duration to current stop
 * - Displays next stop preview
 * - Expiration warning for time-sensitive deliveries
 *
 * Performance Optimizations:
 * - Memoized with React.memo for shallow prop comparison
 * - useMemo for computed values (paradasReais, upcomingStop, swipeActions)
 * - Prevents unnecessary SwipeableRow re-renders
 */

import { Ionicons } from '@expo/vector-icons';
import React, { memo, useMemo } from 'react';
import { ActivityIndicator, TouchableOpacity, View } from 'react-native';

import { SwipeableRow } from '@/components/SwipeableRow';
import { RouteStatus } from '@/context/RouteStatusContext';
import { Text } from '@/design-system';
import { useUnistyles } from '@/utils/styles';

import { ExpirationWarning } from '../ExpirationWarning';
import { styles } from '../MainCard.styles';
import { NextStopPreview } from '../NextStopPreview';
import { filterRealStops } from './MainCard.utils';

import type { Location } from './MainCard.types';

interface MainCardActiveProps {
  state: RouteStatus;
  route: any; // Rota | null - kept as any for compatibility
  paradas: any[]; // Parada[] - kept as any for compatibility
  currentStop: any; // Parada - kept as any for compatibility
  nextStop?: any | null; // Parada | null
  location?: Location | null;
  distanceInfo: {
    isLoading: boolean;
    distanceKm: string;
    durationText: string;
  };
  swipeHint: {
    hideCompletely: boolean;
    showFullHint: boolean;
  };
  onSwipeLeft?: () => void | Promise<void>;
  onSwipeRight?: (fotoUrl?: string) => void | Promise<void>;
  onPress?: () => void | Promise<void>;
}

export const MainCardActive = memo(function MainCardActive({
  state,
  route,
  paradas,
  currentStop,
  nextStop,
  location,
  distanceInfo,
  swipeHint,
  onSwipeLeft,
  onSwipeRight,
  onPress,
}: MainCardActiveProps) {
  const { theme } = useUnistyles();

  // Memoize paradas reais para evitar recálculo a cada render
  const paradasReais = useMemo(() => filterRealStops(paradas), [paradas]);

  // Memoize próxima parada
  const upcomingStop = useMemo(() => (
    nextStop || paradas.find(p =>
      p.is_checkpoint !== false &&
      p.status === 'pendente' &&
      p.id !== currentStop?.id
    )
  ), [nextStop, paradas, currentStop?.id]);

  // Memoize swipe actions para evitar re-render do SwipeableRow
  const swipeActions = useMemo(() => ({
    leftActions: [{
      icon: 'checkmark-circle' as const,
      label: 'Concluir',
      color: theme.colors.success,
      onPress: onSwipeRight || (() => {}),
    }],
    rightActions: [{
      icon: 'arrow-forward-circle' as const,
      label: 'Pular',
      color: theme.colors.warning,
      onPress: onSwipeLeft || (() => {}),
    }],
  }), [theme.colors.success, theme.colors.warning, onSwipeRight, onSwipeLeft]);

  return (
    <>
      {/* Aviso de expiração (a partir das 20:00) */}
      {route?.data && (
        <View style={styles.expirationWarningContainer}>
          <ExpirationWarning rotaData={route.data} />
        </View>
      )}
      <SwipeableRow {...swipeActions}>
        <TouchableOpacity style={styles.content} onPress={onPress} activeOpacity={0.9}>
          <View style={styles.header}>
            <View style={[
              styles.badge,
              state === 'last-stop' && { backgroundColor: theme.colors.successDark }
            ]}>
              <Text style={styles.badgeText}>
                {state === 'last-stop' ? 'ÚLTIMA PARADA! 🎯' : `PARADA ${currentStop.ordem}/${paradasReais.length}`}
              </Text>
            </View>
            <View style={styles.timer}>
              {distanceInfo.isLoading ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <>
                  <Ionicons name="time-outline" size={14} color={theme.colors.primary} />
                  <Text style={[styles.timerText, { color: theme.colors.primary, fontFamily: theme.typography.fontSansSemiBold }]}>
                    {distanceInfo.durationText}
                  </Text>
                </>
              )}
            </View>
          </View>

          <Text style={styles.addressMain}>{currentStop.endereco}</Text>

          {currentStop.destinatario && (
            <View style={styles.contactInfo}>
              <Ionicons name="person-outline" size={14} color={theme.colors.gray500} />
              <Text style={styles.contactText}>{currentStop.destinatario}</Text>
            </View>
          )}

          {currentStop.telefone && (
            <View style={styles.contactInfo}>
              <Ionicons name="call-outline" size={14} color={theme.colors.gray500} />
              <Text style={styles.contactText}>{currentStop.telefone}</Text>
            </View>
          )}

          {currentStop.observacoes && (
            <View style={styles.observationBox}>
              <Text style={styles.observationText}>{currentStop.observacoes}</Text>
            </View>
          )}

          <View style={[styles.distanceBar, { backgroundColor: theme.colors.primary }]}>
            {distanceInfo.isLoading ? (
              <ActivityIndicator size="small" color={theme.colors.white} />
            ) : (
              <>
                <Ionicons name="navigate" size={16} color={theme.colors.white} />
                <Text style={[styles.distanceText, { color: theme.colors.white, fontFamily: theme.typography.fontSansSemiBold }]}>
                  {distanceInfo.distanceKm} • {distanceInfo.durationText}
                </Text>
              </>
            )}
          </View>

          {/* Indicador de swipe inteligente */}
          {!swipeHint.hideCompletely && (
            <View style={styles.swipeHint}>
              <Ionicons name="swap-horizontal" size={16} color={theme.colors.gray400} />
              {swipeHint.showFullHint && (
                <Text style={styles.swipeHintText}>Deslize para ações rápidas</Text>
              )}
            </View>
          )}

          {/* Preview da próxima parada */}
          {upcomingStop && state !== 'last-stop' && (
            <NextStopPreview
              nextStop={upcomingStop}
              currentLocation={location}
              totalStops={paradasReais.length}
            />
          )}
        </TouchableOpacity>
      </SwipeableRow>
    </>
  );
});
