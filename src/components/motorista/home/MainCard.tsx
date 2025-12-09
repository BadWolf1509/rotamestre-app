import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, Animated, ActivityIndicator } from 'react-native';

import { StreetViewPreview } from '@/components/StreetViewPreview';
import { SwipeableRow } from '@/components/SwipeableRow';
import { RouteStatus } from '@/context/RouteStatusContext';
import { useDistanceToStop } from '@/hooks/useDistanceToStop';
import { useUser } from '@/hooks/useUser';
import { supabase } from '@/lib/supabase';
import { defaultTheme, useUnistyles } from '@/utils/styles';

/**
 * Formata tempo decorrido entre dois timestamps (ou desde start até agora)
 */
function formatElapsedTime(startTime: number, endTime?: number): string {
  const end = endTime || Date.now();
  const elapsed = end - startTime;

  const hours = Math.floor(elapsed / (1000 * 60 * 60));
  const minutes = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}min`;
  }
  return `${minutes} min`;
}

interface MainCardProps {
  state: RouteStatus;
  route: any;
  paradas: any[];
  currentStop?: any | null;
  nextStop?: any | null;
  location?: { latitude: number; longitude: number } | null;
  onSwipeLeft?: () => void | Promise<void>;
  onSwipeRight?: (fotoUrl?: string) => void | Promise<void>;
  onPress?: () => void | Promise<void>;
}

interface MotoristaStats {
  rotasOntem: number;
  paradasOntem: number;
  distanciaOntem: number;
}

export function MainCard({
  state,
  route,
  paradas,
  currentStop,
  nextStop,
  location,
  onSwipeLeft,
  onSwipeRight,
  onPress,
}: MainCardProps) {
  const { theme } = useUnistyles();
  const { userData } = useUser();
  const motoristaId = userData?.id;
  const [stats, setStats] = useState<MotoristaStats>({
    rotasOntem: 0,
    paradasOntem: 0,
    distanciaOntem: 0,
  });

  // Animação de entrada do card
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, [state, fadeAnim, slideAnim]);

  // Calcular distância real até a parada atual ou próxima
  const targetStop = currentStop || nextStop;
  const distanceInfo = useDistanceToStop(
    location,
    targetStop ? { latitude: targetStop.latitude, longitude: targetStop.longitude } : null,
    { enabled: !!targetStop && !!location }
  );

  // Calcular distância até primeira parada (para estado pending)
  const firstStop = paradas.find(p => p.is_checkpoint !== false);
  const firstStopDistance = useDistanceToStop(
    location,
    firstStop ? { latitude: firstStop.latitude, longitude: firstStop.longitude } : null,
    { enabled: state === 'pending' && !!firstStop && !!location }
  );

  // Filtrar apenas paradas reais (sem checkpoints)
  const paradasReais = paradas.filter(p => p.is_checkpoint !== false);

  // Load yesterday's stats when no route
  const loadYesterdayStats = useCallback(async () => {
    if (!motoristaId) return;

    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get yesterday's completed routes
      const { data: rotas, error } = await supabase
        .from('rotas')
        .select('id, distancia_total')
        .eq('motorista_id', motoristaId)
        .eq('status', 'concluida')
        .gte('concluida_em', yesterday.toISOString())
        .lt('concluida_em', today.toISOString());

      if (error) throw error;

      const rotasCount = rotas?.length || 0;
      const distanciaTotal = rotas?.reduce((sum, r) => sum + (r.distancia_total || 0), 0) || 0;

      // Get yesterday's completed stops
      if (rotas && rotas.length > 0) {
        const rotaIds = rotas.map(r => r.id);
        const { data: paradas, error: paradasError } = await supabase
          .from('paradas')
          .select('id')
          .in('rota_id', rotaIds)
          .eq('status', 'concluida');

        if (!paradasError) {
          setStats({
            rotasOntem: rotasCount,
            paradasOntem: paradas?.length || 0,
            distanciaOntem: Math.round(distanciaTotal),
          });
        }
      } else {
        setStats({
          rotasOntem: 0,
          paradasOntem: 0,
          distanciaOntem: 0,
        });
      }
    } catch (error) {
      console.error('Error loading yesterday stats:', error);
    }
  }, [motoristaId]);

  useEffect(() => {
    if (state === 'no-route' && motoristaId) {
      loadYesterdayStats();
    }
  }, [loadYesterdayStats, motoristaId, state]);

  // Renderização baseada no estado
  const renderContent = () => {
    switch (state) {
      case 'no-route':
        return renderNoRoute();
      case 'pending':
        return renderPending();
      case 'active':
      case 'last-stop':
        return renderActive();
      case 'ready-to-complete':
        return renderReadyToComplete();
      case 'completed':
        return renderCompleted();
      default:
        return null;
    }
  };

  const renderNoRoute = () => {
    const hasYesterdayStats = stats.rotasOntem > 0 || stats.paradasOntem > 0;

    return (
      <View style={styles.content}>
        <View style={styles.noRouteHeader}>
          <View style={[styles.noRouteIconContainer, { backgroundColor: theme.colors.gray100 }]}>
            <Ionicons name="cafe-outline" size={32} color={theme.colors.gray500} />
          </View>
          <Text style={styles.title}>Sem rota no momento</Text>
          <Text style={styles.subtitle}>
            {hasYesterdayStats
              ? 'Confira suas estatísticas de ontem'
              : 'Aguardando atribuição de nova rota'}
          </Text>
        </View>

        {hasYesterdayStats ? (
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <View style={[styles.statIconBg, { backgroundColor: theme.colors.primaryLight }]}>
                <Ionicons name="map-outline" size={16} color={theme.colors.primary} />
              </View>
              <Text style={styles.statValue}>
                {stats.rotasOntem} {stats.rotasOntem === 1 ? 'rota' : 'rotas'}
              </Text>
              <Text style={styles.statLabel}>Ontem</Text>
            </View>
            <View style={styles.stat}>
              <View style={[styles.statIconBg, { backgroundColor: theme.colors.successBg }]}>
                <Ionicons name="location-outline" size={16} color={theme.colors.success} />
              </View>
              <Text style={styles.statValue}>{stats.paradasOntem}</Text>
              <Text style={styles.statLabel}>Paradas</Text>
            </View>
            <View style={styles.stat}>
              <View style={[styles.statIconBg, { backgroundColor: theme.colors.infoBg }]}>
                <Ionicons name="speedometer-outline" size={16} color={theme.colors.info} />
              </View>
              <Text style={styles.statValue}>{stats.distanciaOntem} km</Text>
              <Text style={styles.statLabel}>Percorridos</Text>
            </View>
          </View>
        ) : (
          <View style={styles.noStatsContainer}>
            <View style={styles.tipCard}>
              <Ionicons name="bulb-outline" size={20} color={theme.colors.warning} />
              <View style={styles.tipContent}>
                <Text style={styles.tipTitle}>Dica do dia</Text>
                <Text style={styles.tipText}>
                  Verifique se há rotas disponíveis no menu "Minhas Rotas"
                </Text>
              </View>
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderPending = () => {
    const pendingFirstStop = paradas.find(p => p.is_checkpoint !== false);
    // Estimar tempo baseado na distância (média de 30km/h em área urbana)
    const estimatedMinutes = route?.distancia_total
      ? Math.round((route.distancia_total / 30) * 60)
      : 0;
    const estimatedTimeText = estimatedMinutes > 60
      ? `~${Math.floor(estimatedMinutes / 60)}h ${estimatedMinutes % 60}min`
      : `~${estimatedMinutes} min`;

    return (
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={[styles.badge, { backgroundColor: theme.colors.warning }]}>
            <Text style={[styles.badgeText, styles.badgeTextDark]}>ROTA PENDENTE</Text>
          </View>
        </View>

        <Text style={styles.empresa}>{route?.unidade_nome}</Text>

        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <Ionicons name="location-outline" size={16} color={theme.colors.gray500} />
            <Text style={styles.infoValue}>{paradasReais.length} paradas</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="navigate-outline" size={16} color={theme.colors.gray500} />
            <Text style={styles.infoValue}>{route?.distancia_total || '0'} km</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="time-outline" size={16} color={theme.colors.gray500} />
            <Text style={styles.infoValue}>{estimatedTimeText}</Text>
          </View>
        </View>

        {pendingFirstStop && (
          <View style={styles.firstStopSection}>
            <Text style={styles.sectionLabel}>PRIMEIRA PARADA</Text>
            <Text style={styles.addressText}>{pendingFirstStop.endereco}</Text>
            <View style={styles.distanceRow}>
              {firstStopDistance.isLoading ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <>
                  <Ionicons name="navigate" size={14} color={theme.colors.primary} />
                  <Text style={[styles.distanceText, { color: theme.colors.primary }]}>
                    {firstStopDistance.distanceKm} • {firstStopDistance.durationText}
                  </Text>
                </>
              )}
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderActive = () => {
    if (!currentStop) return null;

    const swipeActions = {
      leftActions: [{
        icon: 'checkmark-circle',
        label: 'Concluir',
        color: theme.colors.success,
        onPress: onSwipeRight || (() => {}),
      }],
      rightActions: [{
        icon: 'arrow-forward-circle',
        label: 'Pular',
        color: theme.colors.warning,
        onPress: onSwipeLeft || (() => {}),
      }],
    };

    return (
      <SwipeableRow {...swipeActions}>
        <TouchableOpacity style={styles.content} onPress={onPress} activeOpacity={0.9}>
          <View style={styles.header}>
            <View style={[
              styles.badge,
              state === 'last-stop' && { backgroundColor: theme.colors.success }
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
                  <Text style={[styles.timerText, { color: theme.colors.primary, fontWeight: '600' }]}>
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

          <View style={styles.streetViewContainer}>
            <StreetViewPreview
              latitude={currentStop.latitude}
              longitude={currentStop.longitude}
              address={currentStop.endereco}
              size="large"
            />
          </View>

          <View style={[styles.distanceBar, { backgroundColor: theme.colors.primary }]}>
            {distanceInfo.isLoading ? (
              <ActivityIndicator size="small" color={theme.colors.white} />
            ) : (
              <>
                <Ionicons name="navigate" size={16} color={theme.colors.white} />
                <Text style={[styles.distanceText, { color: theme.colors.white, fontWeight: '600' }]}>
                  {distanceInfo.distanceKm} • {distanceInfo.durationText}
                </Text>
              </>
            )}
          </View>
        </TouchableOpacity>
      </SwipeableRow>
    );
  };

  const renderReadyToComplete = () => {
    // Calcular tempo real baseado em iniciada_em
    const elapsedTime = route?.iniciada_em
      ? formatElapsedTime(new Date(route.iniciada_em).getTime())
      : '--';

    return (
      <View style={styles.content}>
        <Text style={styles.icon}>🎉</Text>
        <Text style={styles.title}>Todas as paradas concluídas!</Text>
        <Text style={styles.subtitle}>Você pode finalizar a rota agora</Text>

        <View style={styles.summaryBox}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Tempo total</Text>
            <Text style={styles.summaryValue}>{elapsedTime}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Distância</Text>
            <Text style={styles.summaryValue}>{route?.distancia_total || 0} km</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderCompleted = () => {
    // Calcular tempo real baseado em iniciada_em e concluida_em
    const totalTime = route?.iniciada_em && route?.concluida_em
      ? formatElapsedTime(
          new Date(route.iniciada_em).getTime(),
          new Date(route.concluida_em).getTime()
        )
      : '--';

    // Calcular economia (estimado - real)
    const estimatedMinutes = route?.tempo_total ? route.tempo_total : 0;
    const actualMinutes = route?.iniciada_em && route?.concluida_em
      ? Math.floor((new Date(route.concluida_em).getTime() - new Date(route.iniciada_em).getTime()) / 60000)
      : 0;
    const savedMinutes = Math.max(0, estimatedMinutes - actualMinutes);
    const savedText = savedMinutes > 0 ? `${savedMinutes} min` : '--';

    return (
      <View style={styles.content}>
        <Text style={styles.icon}>✅</Text>
        <Text style={styles.title}>Rota Concluída</Text>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{totalTime}</Text>
            <Text style={styles.statLabel}>Tempo Total</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{paradasReais.length}</Text>
            <Text style={styles.statLabel}>Paradas</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{route?.distancia_total || 0} km</Text>
            <Text style={styles.statLabel}>Distância</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: theme.colors.success }]}>{savedText}</Text>
            <Text style={styles.statLabel}>Economia</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <Animated.View
      style={[
        styles.card,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      {renderContent()}
    </Animated.View>
  );
}

const colors = defaultTheme.colors;

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 12,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  badge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  badgeTextDark: {
    color: '#78350f', // amber-900 para alto contraste em fundo warning (7:1)
  },
  timer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timerText: {
    fontSize: 12,
    color: colors.gray500,
  },
  icon: {
    fontSize: 48,
    textAlign: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.gray900,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.gray500,
    textAlign: 'center',
    marginBottom: 16,
  },
  empresa: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.gray900,
    marginBottom: 12,
  },
  addressMain: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray900,
    marginBottom: 8,
  },
  noRouteHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  noRouteIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  stat: {
    alignItems: 'center',
    flex: 1,
  },
  statIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  statLabel: {
    fontSize: 11,
    color: colors.gray500,
    marginTop: 2,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.gray900,
  },
  noStatsContainer: {
    marginTop: 8,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: colors.warningBg,
    borderRadius: 8,
    gap: 10,
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray900,
    marginBottom: 2,
  },
  tipText: {
    fontSize: 12,
    color: colors.gray600,
    lineHeight: 16,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  infoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoValue: {
    fontSize: 14,
    color: colors.gray700,
  },
  firstStopSection: {
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
    paddingTop: 12,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.gray500,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  addressText: {
    fontSize: 14,
    color: colors.gray900,
    marginBottom: 4,
  },
  distanceText: {
    fontSize: 12,
    color: colors.gray500,
  },
  contactInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  contactText: {
    fontSize: 14,
    color: colors.gray700,
  },
  observationBox: {
    backgroundColor: colors.warningBg,
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  observationText: {
    fontSize: 12,
    color: colors.secondaryDark,
  },
  streetViewContainer: {
    marginTop: 12,
    marginBottom: 8,
  },
  distanceBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    backgroundColor: colors.gray100,
    borderRadius: 6,
    marginTop: 8,
  },
  summaryBox: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: colors.gray500,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.gray900,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    padding: 12,
    backgroundColor: colors.gray50,
    borderRadius: 8,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.gray900,
    marginBottom: 4,
  },
});



