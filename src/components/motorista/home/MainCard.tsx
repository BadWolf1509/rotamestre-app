import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState, useRef } from 'react';
import { TouchableOpacity, View, Animated, ActivityIndicator } from 'react-native';


import { StreetViewPreview } from '@/components/StreetViewPreview';
import { SwipeableRow } from '@/components/SwipeableRow';
import { RouteStatus } from '@/context/RouteStatusContext';
import { Text } from '@/design-system';
import { useDistanceToStop } from '@/hooks/useDistanceToStop';
import { useMilestones } from '@/hooks/useMilestones';
import { useSwipeHint } from '@/hooks/useSwipeHint';
import { useUser } from '@/hooks/useUser';
import { supabase } from '@/lib/supabase';
import { successHaptic } from '@/utils/haptics';
import {
  getCompletedMessage,
  getMilestoneMessage,
  getWorkContext,
} from '@/utils/motivationalMessages';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

import { ExpirationWarning } from './ExpirationWarning';
import { ExpiredRouteCard } from './ExpiredRouteCard';
import { LastRouteCard } from './LastRouteCard';
import { MilestoneCard } from './MilestoneCard';
import { NextStopPreview } from './NextStopPreview';
import { NoRouteStatus } from './NoRouteStatus';
import { PreRouteChecklist } from './PreRouteChecklist';
import { WeeklyChart } from './WeeklyChart';

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
  /** Quantidade de outras rotas pendentes (além da atual) */
  pendingRoutesCount?: number;
  onSwipeLeft?: () => void | Promise<void>;
  onSwipeRight?: (fotoUrl?: string) => void | Promise<void>;
  onPress?: () => void | Promise<void>;
  /** Callback quando o status do checklist pré-rota muda */
  onChecklistChange?: (canStart: boolean, allOk: boolean) => void;
  testID?: string;
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
  pendingRoutesCount = 0,
  onSwipeLeft,
  onSwipeRight,
  onPress,
  onChecklistChange,
  testID,
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
  const [lastRoute, setLastRoute] = useState<{
    concluida_em: string;
    paradas_concluidas: number;
    total_paradas: number;
    distancia_km: number;
    tempo_total: string;
  } | null>(null);
  const [expiredRoute, setExpiredRoute] = useState<{
    rota_id: string;
    data: string;
    paradas_pendentes: number;
    total_paradas: number;
    paradas_concluidas: number;
  } | null>(null);
  const [expiredRouteDismissed, setExpiredRouteDismissed] = useState(false);

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

  // Hook de milestones para estado no-route e completed
  const milestoneData = useMilestones({
    motoristaId,
    enabled: state === 'no-route' || state === 'completed',
  });

  // Hook para swipe hint inteligente
  const swipeHint = useSwipeHint();

  // Encontrar próxima parada (para preview) - usa prop nextStop se disponível, senão calcula
  const upcomingStop = nextStop || paradas.find(p =>
    p.is_checkpoint !== false &&
    p.status === 'pendente' &&
    p.id !== currentStop?.id
  );

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

  // Load last completed route of the day
  const loadLastRoute = useCallback(async () => {
    if (!motoristaId) return;

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get last completed route today
      const { data: rota, error } = await supabase
        .from('rotas')
        .select('id, concluida_em, distancia_total, tempo_total, iniciada_em')
        .eq('motorista_id', motoristaId)
        .eq('status', 'concluida')
        .gte('concluida_em', today.toISOString())
        .order('concluida_em', { ascending: false })
        .limit(1)
        .single();

      if (error || !rota) {
        setLastRoute(null);
        return;
      }

      // Get stops for this route (excluding checkpoints - departure/arrival points)
      const { data: paradasData, error: paradasError } = await supabase
        .from('paradas')
        .select('status, is_checkpoint')
        .eq('rota_id', rota.id);

      if (paradasError) {
        setLastRoute(null);
        return;
      }

      // Filter out checkpoints (is_checkpoint: false means it's a checkpoint, not a delivery)
      const deliveryStops = paradasData?.filter(p => p.is_checkpoint !== false) || [];
      const totalParadas = deliveryStops.length;
      const paradasConcluidas = deliveryStops.filter(p => p.status === 'concluida').length;

      // Calculate duration
      let tempoTotal = '--';
      if (rota.iniciada_em && rota.concluida_em) {
        const inicio = new Date(rota.iniciada_em).getTime();
        const fim = new Date(rota.concluida_em).getTime();
        const diffMs = fim - inicio;
        const diffMins = Math.floor(diffMs / 60000);
        const hours = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        if (hours > 0) {
          tempoTotal = `${hours}h ${mins}min`;
        } else {
          tempoTotal = `${mins}min`;
        }
      }

      setLastRoute({
        concluida_em: rota.concluida_em,
        paradas_concluidas: paradasConcluidas,
        total_paradas: totalParadas,
        distancia_km: Math.round(rota.distancia_total || 0),
        tempo_total: tempoTotal,
      });
    } catch (error) {
      console.error('Error loading last route:', error);
      setLastRoute(null);
    }
  }, [motoristaId]);

  // Load last expired route (within last 24h)
  const loadExpiredRoute = useCallback(async () => {
    if (!motoristaId) return;

    try {
      // Get date 24h ago
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      // Find last expired route within 24h
      const { data: rota, error } = await supabase
        .from('rotas')
        .select('id, data, updated_at')
        .eq('motorista_id', motoristaId)
        .eq('status', 'nao_executada')
        .gte('data', yesterday.toISOString().split('T')[0])
        .order('data', { ascending: false })
        .limit(1)
        .single();

      if (error || !rota) {
        setExpiredRoute(null);
        return;
      }

      // Get stops for this route
      const { data: paradasData, error: paradasError } = await supabase
        .from('paradas')
        .select('status, is_checkpoint')
        .eq('rota_id', rota.id);

      if (paradasError) {
        setExpiredRoute(null);
        return;
      }

      // Filter real stops (not checkpoints)
      const paradasReais = paradasData?.filter(p => p.is_checkpoint !== false) || [];
      const totalParadas = paradasReais.length;
      const paradasConcluidas = paradasReais.filter(p => p.status === 'concluida').length;
      const paradasPendentes = totalParadas - paradasConcluidas;

      setExpiredRoute({
        rota_id: rota.id,
        data: rota.data,
        paradas_pendentes: paradasPendentes,
        total_paradas: totalParadas,
        paradas_concluidas: paradasConcluidas,
      });
    } catch (error) {
      console.error('Error loading expired route:', error);
      setExpiredRoute(null);
    }
  }, [motoristaId]);

  // Carregar stats e streak para estados relevantes
  useEffect(() => {
    if (state === 'no-route' && motoristaId) {
      loadYesterdayStats();
      loadTodayStats();
      loadStreak();
      loadLastRoute();
      loadExpiredRoute();
    } else if (state === 'completed' && motoristaId) {
      // Também carregar streak no estado completed
      loadStreak();
    }
  }, [loadYesterdayStats, loadTodayStats, loadStreak, loadLastRoute, loadExpiredRoute, motoristaId, state]);

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
    const workContext = getWorkContext();

    // Contexto para mensagem personalizada
    const noRouteContext = {
      streak,
      rotasHoje: stats.rotasHoje,
      paradasHoje: stats.paradasHoje,
      isAboveAverage: milestoneData.averagePerDay > 0 && stats.paradasHoje > milestoneData.averagePerDay,
    };

    return (
      <View style={styles.content}>
        {/* Card de rota expirada - exibe apenas se houver e não foi dispensado */}
        {expiredRoute && !expiredRouteDismissed && (
          <ExpiredRouteCard
            data={expiredRoute}
            onDismiss={() => setExpiredRouteDismissed(true)}
          />
        )}

        {/* STATUS PRINCIPAL - Primeiro elemento (P0.1) */}
        <NoRouteStatus
          context={noRouteContext}
          showWaitingIndicator={workContext.isWorkHours}
        />

        {/* Separador visual */}
        {(hasAnyStats || milestoneData.nextMilestone || milestoneData.weeklyData.length > 0 || lastRoute || expiredRoute) && (
          <View style={styles.noRouteDivider} />
        )}

        {/* Card da última rota concluída hoje (P1.1) */}
        {lastRoute && workContext.isWorkHours && (
          <LastRouteCard data={lastRoute} />
        )}

        {/* Streak Badge - Apenas durante horário de trabalho e se tiver streak */}
        {streak > 0 && workContext.isWorkHours && (
          <View style={[styles.streakBadge, { backgroundColor: theme.colors.warningBg }]}>
            <Ionicons name="flame" size={18} color={theme.colors.warning} />
            <Text style={[styles.streakText, { color: theme.colors.warningText }]}>
              {streak} {streak === 1 ? 'dia' : 'dias'} seguidos!
            </Text>
          </View>
        )}

        {/* Gráfico Semanal - compacto */}
        {milestoneData.weeklyData.length > 0 && workContext.isWorkDay && (
          <WeeklyChart
            data={milestoneData.weeklyData}
            averagePerDay={milestoneData.averagePerDay}
            isLoading={milestoneData.isLoading}
            compact
          />
        )}

        {/* Card de Milestone - apenas se tiver próximo milestone */}
        {milestoneData.nextMilestone && workContext.isWorkDay && (
          <MilestoneCard data={milestoneData} compact />
        )}

        {/* Stats comparativos (HOJE vs ONTEM) - apenas durante horário de trabalho */}
        {hasAnyStats && workContext.isWorkHours && (
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
        )}

        {/* Links rápidos (P2.2) - apenas durante horário de trabalho */}
        {workContext.isWorkHours && (
          <View style={styles.quickLinks}>
            <TouchableOpacity
              style={styles.quickLink}
              onPress={() => router.push('/motorista/historico')}
            >
              <Ionicons name="time-outline" size={16} color={theme.colors.gray500} />
              <Text style={styles.quickLinkText}>Ver histórico</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickLink}
              onPress={() => router.push('/motorista/desempenho')}
            >
              <Ionicons name="stats-chart-outline" size={16} color={theme.colors.gray500} />
              <Text style={styles.quickLinkText}>Ver desempenho</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderPending = () => {
    const pendingFirstStop = paradas.find(p => p.is_checkpoint !== false);
    // Estimar tempo usando tempo_total quando disponível, com fallback por distância
    const estimatedMinutes = route?.tempo_total && route.tempo_total > 0
      ? route.tempo_total
      : route?.distancia_total
        ? Math.round((route.distancia_total / 30) * 60)
        : null;
    const estimatedTimeText = estimatedMinutes
      ? (estimatedMinutes > 60
        ? `~${Math.floor(estimatedMinutes / 60)}h ${estimatedMinutes % 60}min`
        : `~${estimatedMinutes} min`)
      : '--';

    return (
      <View style={styles.content}>
        {/* Aviso de expiração (a partir das 20:00) */}
        {route?.data && (
          <ExpirationWarning rotaData={route.data} />
        )}

        {/* Nome da empresa + badge de rotas pendentes */}
        <View style={styles.empresaRow}>
          <Text style={styles.empresa}>{route?.unidade_nome || 'Rota Atribuída'}</Text>
          {pendingRoutesCount > 0 && (
            <View style={[styles.pendingBadge, { backgroundColor: theme.colors.secondary }]}>
              <Text style={styles.pendingBadgeText}>+{pendingRoutesCount}</Text>
            </View>
          )}
        </View>

        {/* Stats inline - mais compacto */}
        <View style={styles.pendingStatsRow}>
          <View style={styles.pendingStatItem}>
            <Ionicons name="location" size={18} color={theme.colors.primary} />
            <Text style={styles.pendingStatValue}>{paradasReais.length}</Text>
            <Text style={styles.pendingStatLabel}>
              {paradasReais.length === 1 ? 'parada' : 'paradas'}
            </Text>
          </View>
          <View style={[styles.pendingStatDivider, { backgroundColor: theme.colors.gray200 }]} />
          <View style={styles.pendingStatItem}>
            <Ionicons name="speedometer" size={18} color={theme.colors.primary} />
            <Text style={styles.pendingStatValue}>{route?.distancia_total || 0}</Text>
            <Text style={styles.pendingStatLabel}>km</Text>
          </View>
          <View style={[styles.pendingStatDivider, { backgroundColor: theme.colors.gray200 }]} />
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
                  <Ionicons name="navigate" size={14} color={theme.colors.primary} />
                  <Text style={[styles.distanceText, { color: theme.colors.primary }]}>
                    {firstStopDistance.distanceKm} • {firstStopDistance.durationText}
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
              state === 'last-stop' && { backgroundColor: theme.colors.successDark } // contraste 6:1 com texto branco
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
  };

  const renderReadyToComplete = () => {
    // Calcular tempo real baseado em iniciada_em
    const elapsedTime = route?.iniciada_em
      ? formatElapsedTime(new Date(route.iniciada_em).getTime())
      : '--';

    // Calcular resumo das paradas
    const paradasConcluidas = paradasReais.filter(p => p.status === 'concluida').length;
    const paradasPuladas = paradasReais.filter(p => p.status === 'pulada').length;
    const taxaSucesso = paradasReais.length > 0
      ? Math.round((paradasConcluidas / paradasReais.length) * 100)
      : 100;

    return (
      <View style={styles.content}>
        <Text style={styles.icon}>🎉</Text>
        <Text style={styles.title}>Todas as paradas concluídas!</Text>
        <Text style={styles.subtitle}>Você pode finalizar a rota agora</Text>

        {/* Resumo Executivo */}
        <View style={styles.executiveSummary}>
          <View style={styles.executiveRow}>
            <View style={styles.executiveItem}>
              <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} />
              <Text style={styles.executiveValue}>{paradasConcluidas}</Text>
              <Text style={styles.executiveLabel}>concluídas</Text>
            </View>
            {paradasPuladas > 0 && (
              <View style={styles.executiveItem}>
                <Ionicons name="arrow-forward-circle" size={20} color={theme.colors.warning} />
                <Text style={styles.executiveValue}>{paradasPuladas}</Text>
                <Text style={styles.executiveLabel}>puladas</Text>
              </View>
            )}
            <View style={styles.executiveItem}>
              <Ionicons name="trophy" size={20} color={theme.colors.primary} />
              <Text style={styles.executiveValue}>{taxaSucesso}%</Text>
              <Text style={styles.executiveLabel}>sucesso</Text>
            </View>
          </View>
        </View>

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

        {/* Indicador de finalização */}
        <View style={styles.readyIndicator}>
          <Ionicons name="checkmark-done-circle" size={16} color={theme.colors.success} />
          <Text style={styles.readyText}>Pronto para finalizar a rota</Text>
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

    // Mensagem motivacional usando utilitário
    const completedMsg = getCompletedMessage(paradasConcluidas, taxaSucesso);

    // Verificar se atingiu um milestone
    const milestoneReached = milestoneData.currentMilestone;
    const milestoneMsg = milestoneReached ? getMilestoneMessage(milestoneReached) : null;

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

        <Text style={styles.title}>{completedMsg.title}</Text>
        <Text style={styles.subtitle}>{completedMsg.subtitle}</Text>

        {/* Milestone Alcançado */}
        {milestoneReached && milestoneReached >= 10 && (
          <View style={[styles.milestoneBadge, { backgroundColor: theme.colors.primaryBg }]}>
            <Text style={styles.milestoneEmoji}>{milestoneMsg?.emoji}</Text>
            <View>
              <Text style={[styles.milestoneTitle, { color: theme.colors.primary }]}>
                {milestoneMsg?.title}
              </Text>
              <Text style={styles.milestoneSubtitle}>
                {milestoneData.totalEntregas} entregas no total
              </Text>
            </View>
          </View>
        )}

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
      testID={testID}
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.white,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      {renderContent()}
    </Animated.View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  card: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.xl,
    marginHorizontal: theme.spacing.lg,
    marginVertical: theme.spacing.lg,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: theme.spacing.sm,
    elevation: 3,
  },
  content: {
    padding: theme.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  badge: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  badgeText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontSansBold,
    letterSpacing: 0.5,
  },
  badgeTextDark: {
    color: theme.colors.warningText,
  },
  timer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  timerText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray500,
  },
  icon: {
    fontSize: 48,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  title: {
    fontSize: theme.typography.fontSize.xl,
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.gray900,
    textAlign: 'center',
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray500,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  empresaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  empresa: {
    fontSize: theme.typography.fontSize.lg,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
  },
  pendingBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.lg,
  },
  pendingBadgeText: {
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.white,
  },
  addressMain: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
    marginBottom: theme.spacing.sm,
  },
  noRouteHeader: {
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  noRouteIconContainer: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  motivationalEmoji: {
    fontSize: theme.typography.fontSize['2xl'],
  },
  waitingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray100,
  },
  waitingText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray500,
    fontStyle: 'italic',
  },
  noRouteDivider: {
    height: 1,
    backgroundColor: theme.colors.gray100,
    marginVertical: theme.spacing.md,
  },
  expirationWarningContainer: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
  },
  quickLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.xl,
    marginTop: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray100,
  },
  quickLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  quickLinkText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray500,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: theme.spacing.sm,
  },
  stat: {
    alignItems: 'center',
    flex: 1,
  },
  statIconBg: {
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  statLabel: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray500,
    marginTop: 2,
  },
  statValue: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.gray900,
  },
  noStatsContainer: {
    marginTop: theme.spacing.sm,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.warningBg,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.sm,
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
    marginBottom: 2,
  },
  tipText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray600,
    lineHeight: 16,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
    marginBottom: theme.spacing.sm,
    alignSelf: 'center',
  },
  streakText: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  statsComparison: {
    flexDirection: 'row',
    marginTop: theme.spacing.sm,
  },
  statsColumn: {
    flex: 1,
    alignItems: 'center',
  },
  statsColumnHeader: {
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontSansBold,
    letterSpacing: 0.5,
    marginBottom: theme.spacing.sm,
  },
  statsColumnContent: {
    gap: theme.spacing.xs,
  },
  statsDivider: {
    width: 1,
    backgroundColor: theme.colors.gray200,
    marginHorizontal: theme.spacing.md,
  },
  miniStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  miniStatValue: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontSansMedium,
    color: theme.colors.gray900,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },
  infoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.lg,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  infoValue: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray700,
  },
  // Estilos para o novo layout pending
  pendingStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: theme.colors.gray50,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  pendingStatItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  pendingStatValue: {
    fontSize: theme.typography.fontSize.lg,
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.gray900,
  },
  pendingStatLabel: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray500,
    fontFamily: theme.typography.fontSansMedium,
  },
  pendingStatDivider: {
    width: 1,
    height: 32,
  },
  firstStopSection: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray200,
    paddingTop: theme.spacing.md,
  },
  sectionLabel: {
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray600,
    letterSpacing: 0.5,
    marginBottom: theme.spacing.xs,
  },
  addressText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray900,
    marginBottom: theme.spacing.xs,
  },
  distanceText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray500,
  },
  contactInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  contactText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray700,
  },
  observationBox: {
    backgroundColor: theme.colors.warningBg,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    marginTop: theme.spacing.sm,
  },
  observationText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.warningText,
  },
  streetViewContainer: {
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    alignItems: 'center',
  },
  distanceBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.gray100,
    borderRadius: theme.borderRadius.sm,
    marginTop: theme.spacing.sm,
  },
  swipeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.gray50,
    borderRadius: theme.borderRadius.xs,
    marginTop: theme.spacing.sm,
  },
  swipeHintText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray500,
    fontFamily: theme.typography.fontSansMedium,
  },
  summaryBox: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: theme.spacing.lg,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray500,
    marginBottom: theme.spacing.xs,
  },
  summaryValue: {
    fontSize: theme.typography.fontSize.lg,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
  },
  executiveSummary: {
    backgroundColor: theme.colors.gray50,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  executiveRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  executiveItem: {
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  executiveValue: {
    fontSize: theme.typography.fontSize.xl,
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.gray900,
  },
  executiveLabel: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  readyIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray100,
  },
  readyText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.success,
    fontFamily: theme.typography.fontSansMedium,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.gray50,
    borderRadius: theme.borderRadius.md,
  },
  statNumber: {
    fontSize: theme.typography.fontSize.xl,
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.gray900,
    marginBottom: theme.spacing.xs,
  },
  // Estilos para estado completed (celebração)
  celebrationContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  celebrationCircle: {
    width: 80,
    height: 80,
    borderRadius: theme.borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  milestoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.md,
  },
  milestoneEmoji: {
    fontSize: theme.typography.fontSize['3xl'],
  },
  milestoneTitle: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontSansBold,
  },
  milestoneSubtitle: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray600,
    marginTop: 2,
  },
  completedStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginTop: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.gray50,
    borderRadius: theme.borderRadius.lg,
  },
  completedStatItem: {
    flex: 1,
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  completedStatValue: {
    fontSize: theme.typography.fontSize.lg,
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.gray900,
  },
  completedStatLabel: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray500,
    fontFamily: theme.typography.fontSansMedium,
  },
  completedStatDivider: {
    width: 1,
    height: 40,
  },
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.borderRadius.md,
  },
  detailsButtonText: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontSansSemiBold,
  },
}));

