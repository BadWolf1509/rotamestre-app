import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, Animated, ActivityIndicator } from 'react-native';

import { StreetViewPreview } from '@/components/StreetViewPreview';
import { SwipeableRow } from '@/components/SwipeableRow';
import { RouteStatus } from '@/context/RouteStatusContext';
import { useDistanceToStop } from '@/hooks/useDistanceToStop';
import { useUser } from '@/hooks/useUser';
import { supabase } from '@/lib/supabase';
import { successHaptic } from '@/utils/haptics';
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
  rotasHoje: number;
  paradasHoje: number;
  distanciaHoje: number;
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
  const router = useRouter();
  const { userData } = useUser();
  const motoristaId = userData?.id;
  const [stats, setStats] = useState<MotoristaStats>({
    rotasOntem: 0,
    paradasOntem: 0,
    distanciaOntem: 0,
    rotasHoje: 0,
    paradasHoje: 0,
    distanciaHoje: 0,
  });
  const [streak, setStreak] = useState(0);
  const [celebrationTriggered, setCelebrationTriggered] = useState(false);

  // Animação de entrada do card
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  // Animação de celebração (checkmark)
  const celebrationScale = useRef(new Animated.Value(0)).current;
  const celebrationOpacity = useRef(new Animated.Value(0)).current;

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
          setStats(prev => ({
            ...prev,
            rotasOntem: rotasCount,
            paradasOntem: paradas?.length || 0,
            distanciaOntem: Math.round(distanciaTotal),
          }));
        }
      } else {
        setStats(prev => ({
          ...prev,
          rotasOntem: 0,
          paradasOntem: 0,
          distanciaOntem: 0,
        }));
      }
    } catch (error) {
      console.error('Error loading yesterday stats:', error);
    }
  }, [motoristaId]);

  // Load today's stats
  const loadTodayStats = useCallback(async () => {
    if (!motoristaId) return;

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get today's completed routes
      const { data: rotas, error } = await supabase
        .from('rotas')
        .select('id, distancia_total')
        .eq('motorista_id', motoristaId)
        .eq('status', 'concluida')
        .gte('concluida_em', today.toISOString());

      if (error) throw error;

      const rotasCount = rotas?.length || 0;
      const distanciaTotal = rotas?.reduce((sum, r) => sum + (r.distancia_total || 0), 0) || 0;

      // Get today's completed stops
      let paradasCount = 0;
      if (rotas && rotas.length > 0) {
        const rotaIds = rotas.map(r => r.id);
        const { data: paradas, error: paradasError } = await supabase
          .from('paradas')
          .select('id')
          .in('rota_id', rotaIds)
          .eq('status', 'concluida');

        if (!paradasError) {
          paradasCount = paradas?.length || 0;
        }
      }

      setStats(prev => ({
        ...prev,
        rotasHoje: rotasCount,
        paradasHoje: paradasCount,
        distanciaHoje: Math.round(distanciaTotal),
      }));
    } catch (error) {
      console.error('Error loading today stats:', error);
    }
  }, [motoristaId]);

  // Load streak (consecutive days with at least 1 completed route)
  const loadStreak = useCallback(async () => {
    if (!motoristaId) return;

    try {
      // Get last 30 days of completed routes
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      thirtyDaysAgo.setHours(0, 0, 0, 0);

      const { data: rotas, error } = await supabase
        .from('rotas')
        .select('concluida_em')
        .eq('motorista_id', motoristaId)
        .eq('status', 'concluida')
        .gte('concluida_em', thirtyDaysAgo.toISOString())
        .order('concluida_em', { ascending: false });

      if (error) throw error;

      // Calculate consecutive days with at least 1 route
      let currentStreak = 0;
      let checkDate = new Date();
      checkDate.setHours(0, 0, 0, 0);

      const routeDates = new Set(
        rotas?.map(r => new Date(r.concluida_em).toDateString()) || []
      );

      while (routeDates.has(checkDate.toDateString())) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      }

      setStreak(currentStreak);
    } catch (error) {
      console.error('Error loading streak:', error);
    }
  }, [motoristaId]);

  // Carregar stats e streak para estados relevantes
  useEffect(() => {
    if (state === 'no-route' && motoristaId) {
      loadYesterdayStats();
      loadTodayStats();
      loadStreak();
    } else if (state === 'completed' && motoristaId) {
      // Também carregar streak no estado completed
      loadStreak();
    }
  }, [loadYesterdayStats, loadTodayStats, loadStreak, motoristaId, state]);

  // Animação de celebração quando rota é concluída
  useEffect(() => {
    if (state === 'completed' && !celebrationTriggered) {
      setCelebrationTriggered(true);

      // Haptic feedback de sucesso
      successHaptic();

      // Animar checkmark
      Animated.parallel([
        Animated.spring(celebrationScale, {
          toValue: 1,
          tension: 50,
          friction: 3,
          useNativeDriver: true,
        }),
        Animated.timing(celebrationOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (state !== 'completed' && celebrationTriggered) {
      // Reset quando sair do estado completed
      setCelebrationTriggered(false);
      celebrationScale.setValue(0);
      celebrationOpacity.setValue(0);
    }
  }, [state, celebrationTriggered, celebrationScale, celebrationOpacity]);

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
    const hasAnyStats = stats.rotasOntem > 0 || stats.paradasOntem > 0 || stats.rotasHoje > 0 || stats.paradasHoje > 0;

    return (
      <View style={styles.content}>
        <View style={styles.noRouteHeader}>
          <View style={[styles.noRouteIconContainer, { backgroundColor: theme.colors.gray100 }]}>
            <Ionicons name="cafe-outline" size={32} color={theme.colors.gray500} />
          </View>
          <Text style={styles.title}>Sem rota no momento</Text>
          <Text style={styles.subtitle}>
            {hasAnyStats
              ? 'Confira suas estatísticas'
              : 'Aguardando atribuição de nova rota'}
          </Text>
        </View>

        {/* Streak Badge */}
        {streak > 0 && (
          <View style={[styles.streakBadge, { backgroundColor: theme.colors.warningBg }]}>
            <Ionicons name="flame" size={18} color={theme.colors.warning} />
            <Text style={[styles.streakText, { color: theme.colors.warningText }]}>
              {streak} {streak === 1 ? 'dia' : 'dias'} seguidos!
            </Text>
          </View>
        )}

        {hasAnyStats ? (
          <View style={styles.statsComparison}>
            {/* Coluna HOJE */}
            <View style={styles.statsColumn}>
              <Text style={[styles.statsColumnHeader, { color: theme.colors.primary }]}>HOJE</Text>
              <View style={styles.statsColumnContent}>
                <View style={styles.miniStat}>
                  <Ionicons name="map-outline" size={14} color={theme.colors.gray500} />
                  <Text style={styles.miniStatValue}>
                    {stats.rotasHoje} {stats.rotasHoje === 1 ? 'rota' : 'rotas'}
                  </Text>
                </View>
                <View style={styles.miniStat}>
                  <Ionicons name="location-outline" size={14} color={theme.colors.gray500} />
                  <Text style={styles.miniStatValue}>
                    {stats.paradasHoje > 0 ? `${stats.paradasHoje} paradas` : '--'}
                  </Text>
                </View>
                <View style={styles.miniStat}>
                  <Ionicons name="speedometer-outline" size={14} color={theme.colors.gray500} />
                  <Text style={styles.miniStatValue}>
                    {stats.distanciaHoje > 0 ? `${stats.distanciaHoje} km` : '--'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Divider */}
            <View style={styles.statsDivider} />

            {/* Coluna ONTEM */}
            <View style={styles.statsColumn}>
              <Text style={[styles.statsColumnHeader, { color: theme.colors.gray500 }]}>ONTEM</Text>
              <View style={styles.statsColumnContent}>
                <View style={styles.miniStat}>
                  <Ionicons name="map-outline" size={14} color={theme.colors.gray400} />
                  <Text style={[styles.miniStatValue, { color: theme.colors.gray600 }]}>
                    {stats.rotasOntem > 0 ? `${stats.rotasOntem} ${stats.rotasOntem === 1 ? 'rota' : 'rotas'}` : '--'}
                  </Text>
                </View>
                <View style={styles.miniStat}>
                  <Ionicons name="location-outline" size={14} color={theme.colors.gray400} />
                  <Text style={[styles.miniStatValue, { color: theme.colors.gray600 }]}>
                    {stats.paradasOntem > 0 ? `${stats.paradasOntem} paradas` : '--'}
                  </Text>
                </View>
                <View style={styles.miniStat}>
                  <Ionicons name="speedometer-outline" size={14} color={theme.colors.gray400} />
                  <Text style={[styles.miniStatValue, { color: theme.colors.gray600 }]}>
                    {stats.distanciaOntem > 0 ? `${stats.distanciaOntem} km` : '--'}
                  </Text>
                </View>
              </View>
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
              state === 'last-stop' && { backgroundColor: theme.colors.successDark } // successDark (#047857) para contraste 6:1 com texto branco
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
              size="medium"
              fallback="static-map"
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

          {/* Indicador de swipe */}
          <View style={styles.swipeHint}>
            <Ionicons name="swap-horizontal" size={16} color={theme.colors.gray400} />
            <Text style={styles.swipeHintText}>Deslize para ações rápidas</Text>
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

    // Contar paradas concluídas vs total
    const paradasConcluidas = paradasReais.filter(p => p.status === 'concluida').length;
    const taxaSucesso = paradasReais.length > 0
      ? Math.round((paradasConcluidas / paradasReais.length) * 100)
      : 100;

    // Mensagem motivacional baseada em performance
    const getMensagemMotivacional = () => {
      if (taxaSucesso === 100) return 'Todas as entregas concluídas!';
      if (taxaSucesso >= 90) return 'Excelente trabalho!';
      return 'Bom trabalho!';
    };

    return (
      <View style={styles.content}>
        {/* Checkmark animado */}
        <View style={styles.celebrationContainer}>
          <Animated.View
            style={[
              styles.celebrationCircle,
              {
                backgroundColor: theme.colors.successBg,
                opacity: celebrationOpacity,
                transform: [{ scale: celebrationScale }],
              },
            ]}
          >
            <Ionicons name="checkmark-circle" size={56} color={theme.colors.success} />
          </Animated.View>
        </View>

        <Text style={styles.title}>Parabéns!</Text>
        <Text style={styles.subtitle}>{getMensagemMotivacional()}</Text>

        {/* Streak Badge */}
        {streak > 0 && (
          <View style={[styles.streakBadge, { backgroundColor: theme.colors.warningBg }]}>
            <Ionicons name="flame" size={18} color={theme.colors.warning} />
            <Text style={[styles.streakText, { color: theme.colors.warningText }]}>
              {streak} {streak === 1 ? 'dia' : 'dias'} seguidos!
            </Text>
          </View>
        )}

        {/* Stats em 3 colunas */}
        <View style={styles.completedStatsRow}>
          <View style={styles.completedStatItem}>
            <Ionicons name="time-outline" size={20} color={theme.colors.gray500} />
            <Text style={styles.completedStatValue}>{totalTime}</Text>
            <Text style={styles.completedStatLabel}>Tempo</Text>
          </View>
          <View style={[styles.completedStatDivider, { backgroundColor: theme.colors.gray200 }]} />
          <View style={styles.completedStatItem}>
            <Ionicons name="location-outline" size={20} color={theme.colors.gray500} />
            <Text style={styles.completedStatValue}>{paradasConcluidas}/{paradasReais.length}</Text>
            <Text style={styles.completedStatLabel}>Paradas</Text>
          </View>
          <View style={[styles.completedStatDivider, { backgroundColor: theme.colors.gray200 }]} />
          <View style={styles.completedStatItem}>
            <Ionicons name="speedometer-outline" size={20} color={theme.colors.gray500} />
            <Text style={styles.completedStatValue}>{route?.distancia_total || 0} km</Text>
            <Text style={styles.completedStatLabel}>Distância</Text>
          </View>
        </View>

        {/* Botão Ver Detalhes */}
        <TouchableOpacity
          style={[styles.detailsButton, { backgroundColor: theme.colors.primary }]}
          onPress={() => router.push('/motorista/resumo')}
          activeOpacity={0.8}
        >
          <Ionicons name="document-text-outline" size={18} color={theme.colors.white} />
          <Text style={[styles.detailsButtonText, { color: theme.colors.white }]}>
            Ver Detalhes da Rota
          </Text>
        </TouchableOpacity>
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
    borderRadius: 16, // Aumentado de 12 para 16 (tendência 2024/2025)
    marginHorizontal: 16,
    marginVertical: 16, // Unificado para 16px (8pt grid system)
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
    paddingHorizontal: 10, // Aumentado de 8 para 10 (compensar fonte maior)
    paddingVertical: 5, // Aumentado de 4 para 5 (compensar fonte maior)
    borderRadius: 6, // Aumentado de 4 para 6 (mais moderno)
  },
  badgeText: {
    color: colors.white,
    fontSize: 12, // Aumentado de 11 para 12 (WCAG mínimo legível)
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
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 16,
    alignSelf: 'center',
  },
  streakText: {
    fontSize: 14,
    fontWeight: '600',
  },
  statsComparison: {
    flexDirection: 'row',
    marginTop: 8,
  },
  statsColumn: {
    flex: 1,
    alignItems: 'center',
  },
  statsColumnHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  statsColumnContent: {
    gap: 6,
  },
  statsDivider: {
    width: 1,
    backgroundColor: colors.gray200,
    marginHorizontal: 12,
  },
  miniStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  miniStatValue: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.gray900,
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
    fontSize: 11, // Aumentado de 10 para 11 (melhor legibilidade)
    fontWeight: '600',
    color: colors.gray600, // Mais escuro para melhor contraste
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
    color: '#92400e', // amber-800 para alto contraste em fundo warningBg (7:1)
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
  swipeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: colors.gray50,
    borderRadius: 4,
    marginTop: 8,
  },
  swipeHintText: {
    fontSize: 12,
    color: colors.gray500,
    fontWeight: '500',
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
  // Estilos para estado completed (celebração)
  celebrationContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  celebrationCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  completedStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 12,
    backgroundColor: colors.gray50,
    borderRadius: 12,
  },
  completedStatItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  completedStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.gray900,
  },
  completedStatLabel: {
    fontSize: 11,
    color: colors.gray500,
    fontWeight: '500',
  },
  completedStatDivider: {
    width: 1,
    height: 40,
  },
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  detailsButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});



