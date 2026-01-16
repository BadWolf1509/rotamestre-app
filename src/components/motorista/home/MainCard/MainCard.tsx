/**
 * MainCard - Main orchestrator component for motorista home screen
 * Composes state-specific subcomponents based on current route status
 */

import React from 'react';
import { Animated } from 'react-native';

import { useDistanceToStop } from '@/hooks/useDistanceToStop';
import { useMainCardAnimations } from '@/hooks/useMainCardAnimations';
import { useMainCardData } from '@/hooks/useMainCardData';
import { useMilestones } from '@/hooks/useMilestones';
import { useSwipeHint } from '@/hooks/useSwipeHint';
import { useUser } from '@/hooks/useUser';
import { useUnistyles } from '@/utils/styles';

import { styles } from '../MainCard.styles';
import { MainCardActive } from './MainCardActive';
import { MainCardCompleted } from './MainCardCompleted';
import { MainCardNoRoute } from './MainCardNoRoute';
import { MainCardPending } from './MainCardPending';
import { MainCardReadyToComplete } from './MainCardReadyToComplete';

import type { MainCardProps } from './MainCard.types';

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

  // Hook de milestones para estado no-route e completed
  const milestoneData = useMilestones({
    motoristaId,
    enabled: state === 'no-route' || state === 'completed',
  });

  // Hook para swipe hint inteligente
  const swipeHint = useSwipeHint();

  // Renderização baseada no estado
  const renderContent = () => {
    switch (state) {
      case 'no-route':
        return (
          <MainCardNoRoute
            stats={stats}
            streak={streak}
            lastRoute={lastRoute}
            expiredRoute={expiredRoute}
            expiredRouteDismissed={expiredRouteDismissed}
            dismissExpiredRoute={dismissExpiredRoute}
            milestoneData={milestoneData}
          />
        );

      case 'pending':
        return (
          <MainCardPending
            route={route}
            paradas={paradas}
            pendingRoutesCount={pendingRoutesCount}
            firstStopDistance={firstStopDistance}
            onChecklistChange={onChecklistChange}
          />
        );

      case 'active':
      case 'last-stop':
        if (!currentStop) return null;
        return (
          <MainCardActive
            state={state}
            route={route}
            paradas={paradas}
            currentStop={currentStop}
            nextStop={nextStop}
            location={location}
            distanceInfo={distanceInfo}
            swipeHint={swipeHint}
            onSwipeLeft={onSwipeLeft}
            onSwipeRight={onSwipeRight}
            onPress={onPress}
          />
        );

      case 'ready-to-complete':
        return (
          <MainCardReadyToComplete
            route={route}
            paradas={paradas}
          />
        );

      case 'completed':
        return (
          <MainCardCompleted
            route={route}
            paradas={paradas}
            streak={streak}
            milestoneData={milestoneData}
            celebrationScale={celebrationScale}
            celebrationOpacity={celebrationOpacity}
          />
        );

      default:
        return null;
    }
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
