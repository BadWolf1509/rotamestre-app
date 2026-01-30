import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IncidentReportWizard } from '@/components/IncidentReportWizard';
import { MainCard } from '@/components/motorista/home/MainCard';
import { MiniMap } from '@/components/motorista/home/MiniMap';
import { FloatingActionButton } from '@/components/motorista/home/QuickActions';
import { StartRouteButton } from '@/components/motorista/home/StartRouteButton';
import { StatusSection } from '@/components/motorista/home/StatusSection';
import { NavigationMode } from '@/components/motorista/NavigationMode';
import { OptimizationAlert } from '@/components/motorista/OptimizationAlert';
import { PictureInPictureMap } from '@/components/motorista/PictureInPictureMap';
import { StopCompletionFlow } from '@/components/motorista/StopCompletionFlow';
import { useRouteStatus, type ParadaData } from '@/context/RouteStatusContext';
import { Dialog, SupportModal } from '@/design-system';
import { useAlert } from '@/hooks/useAlert';
import { useDriverLocationBroadcast } from '@/hooks/useDriverLocationBroadcast';
import { useUser } from '@/hooks/useUser';
import { logger } from '@/lib/logger';
import { abrirNavegacao } from '@/lib/navigation';
import DynamicReroutingService from '@/services/dynamicRerouting';
import LocationTrackingService from '@/services/locationTracking';
import type { IconName } from '@/types/icons';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

function MotoristaInicioContent() {
  const router = useRouter();
  const { theme } = useUnistyles();
  const { userData } = useUser();
  const { showWarning, showSuccess, showError, showConfirm, AlertDialog } = useAlert();
  const insets = useSafeAreaInsets();

  // Route context
  const {
    routeStatus,
    route,
    paradas,
    currentStop,
    nextStop,
    progress,
    pendingRoutesCount,
    refreshRoute,
    startRoute,
    completeStop: _completeStop,
    skipStop,
    completeRoute,
  } = useRouteStatus();

  // Broadcast localização do motorista quando a rota está em andamento
  useDriverLocationBroadcast({
    rotaId: route?.id,
    rotaStatus: route?.status,
  });

  // Local state
  const [refreshing, setRefreshing] = useState(false);
  const [miniMapExpanded, setMiniMapExpanded] = useState(false);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showIncidentWizard, setShowIncidentWizard] = useState(false);
  const [navigationMode, setNavigationMode] = useState(false);
  const [showPiPMap, setShowPiPMap] = useState(false);
  const [optimization, setOptimization] = useState<any>(null);
  const [showOptimization, setShowOptimization] = useState(false);
  const [showCompletionFlow, setShowCompletionFlow] = useState(false);
  const [selectedParadaForCompletion, setSelectedParadaForCompletion] = useState<ParadaData | null>(null);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showCompleteRouteModal, setShowCompleteRouteModal] = useState(false);
  const [isCompletingRoute, setIsCompletingRoute] = useState(false);
  const [canStartRoute, setCanStartRoute] = useState(true);
  const [isStartingRoute, setIsStartingRoute] = useState(false);

  // Load user location
  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          logger.debug('[Location] Permission to access location was denied');
          return;
        }

        // Try to get current position with timeout
        try {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
        } catch (positionError) {
          logger.warn('[Location] Could not get current position:', positionError);
          // Continue anyway - will try to get location from watcher
        }

        // Subscribe to location updates
        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 10000,
            distanceInterval: 50,
          },
          (newLocation) => {
            setLocation({
              latitude: newLocation.coords.latitude,
              longitude: newLocation.coords.longitude,
            });
          }
        );
      } catch (error) {
        logger.error('[Location] Error setting up location tracking:', error);
      }
    })();

    return () => {
      if (subscription) {
        try {
          subscription.remove();
        } catch (error) {
          // expo-location remove() não funciona corretamente na web
          logger.warn('[Location] Error removing subscription:', error);
        }
      }
    };
  }, []);

  // SUSPENDED: Dynamic route optimization (Google Distance Matrix API has high cost)
  // TODO: Re-enable when budget allows or implement alternative optimization
  // useEffect(() => {
  //   if (routeStatus === 'active' && route && paradas.length > 1) {
  //     // Start monitoring for optimizations
  //     DynamicReroutingService.startMonitoring(route.id, paradas);

  //     // Check for optimizations every 5 minutes
  //     const checkOptimization = setInterval(async () => {
  //       const opt = await DynamicReroutingService.checkForOptimization(paradas);
  //       if (opt && opt.timeSaved >= 5) {
  //         setOptimization(opt);
  //         setShowOptimization(true);
  //       }
  //     }, 5 * 60 * 1000); // 5 minutes

  //     return () => {
  //       clearInterval(checkOptimization);
  //       DynamicReroutingService.stopMonitoring();
  //     };
  //   }
  // }, [routeStatus, route, paradas]);

  // Main action handler
  const handleMainAction = async () => {
    switch (routeStatus) {
      case 'pending':
        await handleStartRoute();
        break;

      case 'active':
      case 'last-stop':
        handleNavigateToStop();
        break;

      case 'ready-to-complete':
        await handleCompleteRoute();
        break;

      case 'completed':
        router.push('/motorista/resumo');
        break;

      case 'no-route':
      default:
        router.push('/motorista/historico');
        break;
    }
  };

  // Handler para mudança no checklist pré-rota
  const handleChecklistChange = (canStart: boolean, _allOk: boolean) => {
    setCanStartRoute(canStart);
  };

  // Start route
  const handleStartRoute = async () => {
    // Verificar checklist
    if (!canStartRoute) {
      showWarning(
        'GPS Necessário',
        'Ative o GPS do seu dispositivo para iniciar a rota.'
      );
      return;
    }

    // Verificar se a rota pode ser iniciada
    if (route?.status !== 'pendente') {
      const statusMessages: Record<string, string> = {
        em_andamento: 'Esta rota já está em andamento.',
        concluida: 'Esta rota já foi concluída.',
        cancelada: 'Esta rota foi cancelada.',
      };
      showWarning(
        'Rota não pode ser iniciada',
        statusMessages[route?.status || ''] || 'Status da rota inválido.'
      );
      return;
    }

    try {
      setIsStartingRoute(true);
      await startRoute();
      showSuccess('Rota Iniciada', 'Boa viagem! Dirija com segurança.');
    } catch (error) {
      showError(error);
    } finally {
      setIsStartingRoute(false);
    }
  };

  // Navigate to current stop
  const handleNavigateToStop = async () => {
    if (!currentStop) return;

    // Check if user wants multi-stop navigation
    const prefs = await LocationTrackingService.getNavigationPreferences();

    if (prefs.autoAdvance) {
      // Open navigation mode with auto-advance
      setNavigationMode(true);
    } else {
      // Open regular navigation
      abrirNavegacao({
        latitude: currentStop.latitude,
        longitude: currentStop.longitude,
        endereco: currentStop.endereco,
      });
    }
  };

  // Complete current stop - abre o modal de conclusão com foto
  // Captura a parada atual antes de abrir o modal para evitar loop
  // quando currentStop muda após a conclusão
  const handleCompleteStop = async () => {
    if (!currentStop) return;
    setSelectedParadaForCompletion(currentStop);
    setShowCompletionFlow(true);
  };

  // Skip current stop
  const handleSkipStop = async () => {
    if (!currentStop) return;

    const confirmed = await showConfirm({
      title: 'Pular Parada',
      message: `Deseja pular esta parada?\n${currentStop.endereco}`,
      confirmText: 'Pular',
      cancelText: 'Cancelar',
      type: 'warning',
    });

    if (confirmed) {
      try {
        await skipStop(currentStop.id);
        showSuccess('Parada Pulada', 'Você pode voltar a ela mais tarde');
      } catch (error) {
        showError(error);
      }
    }
  };

  // Complete route - abre modal de confirmação (funciona em web e mobile)
  const handleCompleteRoute = () => {
    setShowCompleteRouteModal(true);
  };

  // Confirma finalização da rota
  const confirmCompleteRoute = async () => {
    setIsCompletingRoute(true);
    try {
      await completeRoute();
      setShowCompleteRouteModal(false);
      showSuccess('Parabéns!', 'Rota concluída com sucesso!');
    } catch (error) {
      showError(error);
    } finally {
      setIsCompletingRoute(false);
    }
  };

  // Refresh handler
  const onRefresh = async () => {
    setRefreshing(true);
    await refreshRoute();
    setRefreshing(false);
  };

  // Calculate elapsed time
  const getElapsedTime = () => {
    if (!route?.iniciada_em) return null;

    const start = new Date(route.iniciada_em).getTime();
    const now = Date.now();
    const elapsed = now - start;

    const hours = Math.floor(elapsed / (1000 * 60 * 60));
    const minutes = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60));

    // Não mostrar "0h" quando menos de 1 hora
    if (hours === 0) return `${minutes}min`;
    return `${hours}h ${minutes}min`;
  };

  // Get FAB properties
  const getFABProps = (): { icon: IconName; color: string; label: string } => {
    switch (routeStatus) {
      case 'pending':
        return {
          icon: 'play-circle',
          color: theme.colors.success,
          label: 'Iniciar',
        };

      case 'active':
      case 'last-stop':
        return {
          icon: 'navigate',
          color: theme.colors.secondary,
          label: 'Navegar',
        };

      case 'ready-to-complete':
        return {
          icon: 'checkmark-circle',
          color: theme.colors.success,
          label: 'Finalizar',
        };

      case 'completed':
        return {
          icon: 'document-text',
          color: theme.colors.primary,
          label: 'Detalhes',
        };

      case 'no-route':
      default:
        return {
          icon: 'time',
          color: theme.colors.primary,
          label: 'Histórico',
        };
    }
  };

  const fabProps = getFABProps();

  // Handle navigation mode callbacks
  const handleNavigationComplete = async () => {
    await handleCompleteStop();
    // Continue to next stop automatically
  };

  const handleNavigationSkip = async () => {
    await handleSkipStop();
    // Continue to next stop
  };

  const handleNavigationExit = () => {
    setNavigationMode(false);
  };

  // Handle optimization acceptance
  const handleAcceptOptimization = async () => {
    if (!optimization || !route) return;

    try {
      // Apply the optimization
      await DynamicReroutingService.applyOptimization(route.id, optimization.newOrder);

      // Refresh route data
      await refreshRoute();

      showSuccess('Sucesso', `Rota otimizada! Você economizará ${optimization.timeSaved} minutos.`);
      setShowOptimization(false);
      setOptimization(null);
    } catch (error) {
      showError(error);
    }
  };

  // Handle optimization rejection
  const handleRejectOptimization = () => {
    setShowOptimization(false);
    // Keep optimization in memory for potential later use
  };

  // If in navigation mode, show full-screen navigation
  if (navigationMode && currentStop) {
    return (
      <NavigationMode
        currentStop={currentStop}
        nextStop={nextStop}
        paradas={paradas}
        rotaId={route?.id}
        onComplete={handleNavigationComplete}
        onSkip={handleNavigationSkip}
        onExit={handleNavigationExit}
      />
    );
  }

  return (
    <>
      {/* Padding condicional baseado no estado:
          - no-route: sem FAB flutuante, padding mínimo
          - pending: botão dentro do scroll, padding mínimo
          - outros: FAB flutuante, precisa de espaço extra (96px) */}
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom: (routeStatus === 'no-route' || routeStatus === 'pending')
              ? Math.max(16, insets.bottom + 16)
              : Math.max(72, insets.bottom + 72)
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Status Section */}
        <StatusSection
          testID="motorista-status-section"
          userName={userData?.nome}
          unitName={userData?.unidades?.nome}
          userPhoto={userData?.foto_url}
          routeStatus={routeStatus}
          completedStops={progress.completed}
          totalStops={progress.total}
          timeElapsed={getElapsedTime() ?? undefined}
        />

        {/* Main Card */}
        <MainCard
          state={routeStatus}
          route={route}
          paradas={paradas}
          currentStop={currentStop}
          nextStop={nextStop}
          location={location}
          pendingRoutesCount={pendingRoutesCount}
          onSwipeLeft={handleSkipStop}
          onSwipeRight={handleCompleteStop}
          onPress={handleMainAction}
          onChecklistChange={handleChecklistChange}
          testID="motorista-main-card"
        />

        {/* Mini Map - Nos estados pending, active e last-stop para visualização da rota */}
        {route && (routeStatus === 'pending' || routeStatus === 'active' || routeStatus === 'last-stop') && (
          <MiniMap
            paradas={paradas}
            userLocation={location ?? undefined}
            expanded={miniMapExpanded}
            onToggleExpand={() => setMiniMapExpanded(!miniMapExpanded)}
            onOpenFullMap={() => router.push('/motorista/mapa')}
            onOpenPiP={() => {
              setMiniMapExpanded(false); // Auto-colapsar MiniMap quando PiP abre
              setShowPiPMap(true);
            }}
            route={route}
            testID="motorista-mini-map"
          />
        )}

        {/* Botão Iniciar Rota - full-width no estado pending */}
        {routeStatus === 'pending' && (
          <StartRouteButton
            onPress={handleStartRoute}
            disabled={!canStartRoute}
            loading={isStartingRoute}
            label="Iniciar Rota"
            errorMessage={!canStartRoute ? 'GPS necessário' : undefined}
            variant="start"
          />
        )}

      </ScrollView>

      {/* Floating Action Button - apenas quando NÃO é pending (pending usa StartRouteButton) */}
      {routeStatus !== 'pending' && (
        <FloatingActionButton
          icon={fabProps.icon}
          color={fabProps.color}
          onPress={handleMainAction}
          label={fabProps.label}
          tabBarHeight={16}
        />
      )}

      {/* Modals - rendered outside ScrollView */}
      {showIncidentWizard && (
        <IncidentReportWizard
          visible={showIncidentWizard}
          onClose={() => setShowIncidentWizard(false)}
          onSubmit={(report) => {
            logger.debug('Incidente reportado:', report);
            setShowIncidentWizard(false);
          }}
          paradaId={currentStop?.id}
          rotaId={route?.id}
          motoristaId={userData?.id || ''}
          endereco={currentStop?.endereco}
        />
      )}

      {(routeStatus === 'pending' || routeStatus === 'active' || routeStatus === 'last-stop') && (
        <PictureInPictureMap
          visible={showPiPMap}
          userLocation={location}
          destination={(() => {
            // Usar currentStop se disponível
            if (currentStop) {
              return {
                latitude: currentStop.latitude,
                longitude: currentStop.longitude,
                address: currentStop.endereco,
              };
            }
            // Fallback: encontrar primeira parada real (não checkpoint)
            // is_checkpoint === false significa que É checkpoint (partida/chegada da unidade)
            const primeiraParadaReal = paradas.find(p => p.is_checkpoint !== false);
            if (primeiraParadaReal) {
              return {
                latitude: primeiraParadaReal.latitude,
                longitude: primeiraParadaReal.longitude,
                address: primeiraParadaReal.endereco,
              };
            }
            return null;
          })()}
          onClose={() => setShowPiPMap(false)}
          onExpand={() => {
            setShowPiPMap(false);
            if (routeStatus !== 'pending') {
              setNavigationMode(true);
            } else {
              router.push('/motorista/mapa');
            }
          }}
        />
      )}

      <OptimizationAlert
        visible={showOptimization}
        optimization={optimization}
        currentOrder={paradas.filter(p => p.status === 'pendente')}
        onAccept={handleAcceptOptimization}
        onReject={handleRejectOptimization}
        onClose={() => setShowOptimization(false)}
      />

      {/* Modal de Conclusão de Parada (com foto) */}
      {/* Usa selectedParadaForCompletion (capturado no momento do swipe) para evitar loop */}
      {/* quando currentStop muda após a conclusão da parada */}
      <StopCompletionFlow
        parada={selectedParadaForCompletion}
        visible={showCompletionFlow}
        onClose={() => {
          setShowCompletionFlow(false);
          setSelectedParadaForCompletion(null);
        }}
        onSuccess={() => refreshRoute()}
        allowSkipPhoto={true}
      />

      <SupportModal
        visible={showSupportModal}
        onClose={() => setShowSupportModal(false)}
      />

      {/* Modal de Confirmação para Finalizar Rota */}
      <Dialog
        visible={showCompleteRouteModal}
        variant="confirm"
        title="Finalizar Rota"
        message="Todas as paradas foram concluídas. Deseja finalizar a rota?"
        type="success"
        confirmText="Finalizar"
        cancelText="Cancelar"
        loading={isCompletingRoute}
        onConfirm={confirmCompleteRoute}
        onCancel={() => setShowCompleteRouteModal(false)}
      />

      {/* AlertDialog for useAlert hook */}
      {AlertDialog}
    </>
  );
}

// Main component - RouteStatusProvider já está no _layout.tsx
export default function MotoristaInicio() {
  return <MotoristaInicioContent />;
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
  },
  scrollContent: {
    // Padding is set inline to account for Tab Bar + FAB
  },
}));




