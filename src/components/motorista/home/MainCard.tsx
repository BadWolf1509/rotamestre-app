import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { TouchableOpacity, View, Animated, ActivityIndicator } from 'react-native';

import { StreetViewPreview } from '@/components/StreetViewPreview';
import { SwipeableRow } from '@/components/SwipeableRow';
import { RouteStatus } from '@/context/RouteStatusContext';
import { Text } from '@/design-system';
import { useDistanceToStop } from '@/hooks/useDistanceToStop';
import { useMainCardAnimations } from '@/hooks/useMainCardAnimations';
import { useMainCardData } from '@/hooks/useMainCardData';
import { useMilestones } from '@/hooks/useMilestones';
import { useSwipeHint } from '@/hooks/useSwipeHint';
import { useUser } from '@/hooks/useUser';
import {
  getCompletedMessage,
  getMilestoneMessage,
  getWorkContext,
} from '@/utils/motivationalMessages';
import { useUnistyles } from '@/utils/styles';

import { ExpirationWarning } from './ExpirationWarning';
import { ExpiredRouteCard } from './ExpiredRouteCard';
import { LastRouteCard } from './LastRouteCard';
import { styles } from './MainCard.styles';
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

  // Custom hooks para dados e animações
  const {
    stats,
    streak,
    lastRoute,
    expiredRoute,
    expiredRouteDismissed,
    dismissExpiredRoute,
  } = useMainCardData({ motoristaId, state });

  const {
    fadeAnim,
    slideAnim,
    celebrationScale,
    celebrationOpacity,
  } = useMainCardAnimations({ state });

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
            onDismiss={dismissExpiredRoute}
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
