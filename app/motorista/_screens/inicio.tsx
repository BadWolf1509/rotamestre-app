import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Platform, RefreshControl, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Alert as AlertInline } from '@/components/Alert';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { IncidentReportWizard } from '@/components/IncidentReportWizard';
import { MainCard } from '@/components/motorista/home/MainCard';
import { MiniMap } from '@/components/motorista/home/MiniMap';
import { FloatingActionButton } from '@/components/motorista/home/QuickActions';
import { StartRouteButton } from '@/components/motorista/home/StartRouteButton';
import { StatusSection } from '@/components/motorista/home/StatusSection';
import { NavigationMode } from '@/components/motorista/NavigationMode';
import { OptimizationAlert } from '@/components/motorista/OptimizationAlert';
import { PictureInPictureMap } from '@/components/motorista/PictureInPictureMap';
import { SkipReasonModal } from '@/components/motorista/SkipReasonModal';
import { StopCompletionFlow } from '@/components/motorista/StopCompletionFlow';
import {
  SwipeOnboarding,
  hasSeenSwipeOnboarding,
} from '@/components/SwipeOnboarding';
import { SKIP_REASON_LABELS, type MotivoSkip } from '@/constants/skipReasons';
import { useRouteStatus } from '@/context/RouteStatusContext';
import { Dialog, SupportModal } from '@/design-system';
import { useInicioModals } from '@/hooks/motorista/useInicioModals';
import { useRestaurarConclusaoEmVoo } from '@/hooks/motorista/useRestaurarConclusaoEmVoo';
import { useRestaurarRascunhoIncidente } from '@/hooks/motorista/useRestaurarRascunhoIncidente';
import { useAlert } from '@/hooks/useAlert';
import { useDriverLocationBroadcast } from '@/hooks/useDriverLocationBroadcast';
import {
  useLocationWatcher,
  type OpcoesDoWatcher,
} from '@/hooks/useLocationWatcher';
import { useRevalidarPermissaoDeLocalizacao } from '@/hooks/useRevalidarPermissaoDeLocalizacao';
import { useUser } from '@/hooks/useUser';
import { logger } from '@/lib/logger';
import { abrirNavegacao } from '@/lib/navigation';
import {
  abrirConfiguracoesDoApp,
  pedirPermissao,
  REMEDIO_CADEADO_WEB,
} from '@/lib/permissoes';
import DynamicReroutingService from '@/services/dynamicRerouting';
import LocationTrackingService from '@/services/locationTracking';
import type { IconName } from '@/types/icons';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

const OPCOES_INICIO: OpcoesDoWatcher = {
  accuracy: Location.Accuracy.BestForNavigation,
  timeInterval: 10000,
  distanceInterval: 50,
};

function MotoristaInicioContent() {
  const router = useRouter();
  const { theme } = useUnistyles();
  const { userData } = useUser();
  const { showWarning, showSuccess, showError, AlertDialog } = useAlert();
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

  // Modal/UI state (consolidated via useReducer)
  const modals = useInicioModals();

  // Reabre a conclusão que a recriação da Activity interrompeu. É AQUI que
  // mais importa: quando o Android recria a Activity, a navegação volta para a
  // rota inicial, então é nesta tela que o motorista reaparece.
  // Ver `src/hooks/motorista/useRestaurarConclusaoEmVoo.ts`.
  useRestaurarConclusaoEmVoo(route, paradas, (parada) => {
    modals.openCompletionFlow(parada);
  });

  // Reabre o wizard de incidente interrompido. Sem isto o rascunho fica salvo
  // e ninguém o busca — o wizard só monta com `showIncidentWizard`, que é
  // estado de componente e some na remontagem.
  useRestaurarRascunhoIncidente(route, paradas, (parada) => {
    modals.openIncidentWizard(parada);
  });

  // Local state (loading/async - not suitable for reducer)
  const [refreshing, setRefreshing] = useState(false);
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [isCompletingRoute, setIsCompletingRoute] = useState(false);
  const [canStartRoute, setCanStartRoute] = useState(true);
  const [isStartingRoute, setIsStartingRoute] = useState(false);
  const [showSwipeOnboarding, setShowSwipeOnboarding] = useState(false);

  // Check if swipe onboarding should be shown
  useEffect(() => {
    hasSeenSwipeOnboarding().then((seen) => {
      if (!seen) setShowSwipeOnboarding(true);
    });
  }, []);

  // Localização: nível ambiente. Esta tela abre a cada abertura do app, então
  // a permissão negada vira um aviso dispensável (ver JSX abaixo), nunca um
  // modal — modal aqui seria ruído diário.
  const [temPermissaoDeLocalizacao, setTemPermissaoDeLocalizacao] =
    useState(false);
  const [avisoDeLocalizacaoVisivel, setAvisoDeLocalizacaoVisivel] =
    useState(false);
  // Dispensar o aviso é definitivo enquanto esta tela viver: sem esta ref,
  // uma revalidação em foreground (bloquear/desbloquear a tela já dispara
  // uma) reabriria o aviso que o motorista acabou de fechar.
  const avisoDispensadoRef = useRef(false);

  useEffect(() => {
    let cancelado = false;

    (async () => {
      try {
        const resultado = await pedirPermissao(() =>
          Location.requestForegroundPermissionsAsync(),
        );
        if (cancelado) return;

        setTemPermissaoDeLocalizacao(resultado.concedida);
        // Nível ambiente: aviso dispensável, nunca um modal. Esta tela abre a
        // cada abertura do app.
        setAvisoDeLocalizacaoVisivel(!resultado.concedida);
        if (!resultado.concedida) return;

        try {
          const posicao = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          if (cancelado) return;
          setLocation({
            latitude: posicao.coords.latitude,
            longitude: posicao.coords.longitude,
          });
        } catch (positionError: unknown) {
          // Não-crítico: o watcher abaixo entrega a posição em seguida.
          logger.warn(
            '[Location] Não foi possível obter a posição atual',
            positionError,
          );
        }
      } catch (error: unknown) {
        logger.error('[Location] Erro ao configurar o rastreamento', error);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, []);

  useRevalidarPermissaoDeLocalizacao((concedida) => {
    setTemPermissaoDeLocalizacao(concedida);
    // Dispensar é definitivo enquanto a tela viver: reabrir o aviso a cada
    // volta ao foreground — e bloquear/desbloquear a tela já conta — seria
    // justamente o assédio que este sub-projeto existe para tirar do caminho
    // do motorista. Uma revogação externa ainda aparece, desde que ele não
    // tenha dispensado.
    setAvisoDeLocalizacaoVisivel(!concedida && !avisoDispensadoRef.current);
  });

  useLocationWatcher({
    enabled: temPermissaoDeLocalizacao,
    options: OPCOES_INICIO,
    onLocation: (novaPosicao) =>
      setLocation({
        latitude: novaPosicao.coords.latitude,
        longitude: novaPosicao.coords.longitude,
      }),
  });

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
        'Ative o GPS do seu dispositivo para iniciar a rota.',
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
        statusMessages[route?.status || ''] || 'Status da rota inválido.',
      );
      return;
    }

    try {
      setIsStartingRoute(true);
      await startRoute();
      showSuccess('Rota Iniciada', 'Boa viagem! Dirija com segurança.');
    } catch (error: unknown) {
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
      modals.setNavigationMode(true);
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
    modals.openCompletionFlow(currentStop);
  };

  // Skip current stop - opens SkipReasonModal
  // Captures currentStop at open time to prevent stale closure
  const handleSkipStop = () => {
    if (!currentStop) return;
    modals.openSkipModal(currentStop);
  };

  // Confirm skip with structured reason
  // Uses captured parada from modal state (not currentStop) to prevent stale closure
  const handleConfirmSkip = async (
    motivo: MotivoSkip,
    observacoes?: string,
  ) => {
    const parada = modals.selectedParadaForSkip;
    if (!parada) return;
    modals.closeSkipModal();
    try {
      await skipStop(parada.id, motivo, observacoes);
      showSuccess('Parada Pulada', SKIP_REASON_LABELS[motivo]);
    } catch (error: unknown) {
      showError(error);
    }
  };

  // Complete route - abre modal de confirmação (funciona em web e mobile)
  const handleCompleteRoute = () => {
    modals.openCompleteRoute();
  };

  // Confirma finalização da rota
  const confirmCompleteRoute = async () => {
    setIsCompletingRoute(true);
    try {
      await completeRoute();
      modals.closeCompleteRoute();
      showSuccess('Parabéns!', 'Rota concluída com sucesso!');
    } catch (error: unknown) {
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

  const handleNavigationSkip = () => {
    handleSkipStop();
  };

  const handleNavigationExit = () => {
    modals.setNavigationMode(false);
  };

  // Handle optimization acceptance
  const handleAcceptOptimization = async () => {
    if (!modals.optimization || !route) return;

    try {
      // Apply the optimization
      await DynamicReroutingService.applyOptimization(
        route.id,
        modals.optimization.newOrder,
      );

      // Refresh route data
      await refreshRoute();

      showSuccess(
        'Sucesso',
        `Rota otimizada! Você economizará ${modals.optimization.timeSaved} minutos.`,
      );
      modals.clearOptimization();
    } catch (error) {
      showError(error);
    }
  };

  // Handle optimization rejection
  const handleRejectOptimization = () => {
    modals.dismissOptimization();
    // Keep optimization in memory for potential later use
  };

  // If in navigation mode, show full-screen navigation
  if (modals.navigationMode && currentStop) {
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
            paddingBottom:
              routeStatus === 'no-route' || routeStatus === 'pending'
                ? Math.max(16, insets.bottom + 16)
                : Math.max(72, insets.bottom + 72),
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

        {avisoDeLocalizacaoVisivel && (
          <AlertInline
            type="info"
            title="Localização desativada"
            message={
              Platform.OS === 'web'
                ? `Ative a localização para ver sua posição no mapa e acompanhar a rota. ${REMEDIO_CADEADO_WEB}`
                : 'Ative a localização para ver sua posição no mapa e acompanhar a rota.'
            }
            // Na web não há Configurações de app para abrir -
            // abrirConfiguracoesDoApp() é no-op lá (src/lib/permissoes.ts). Um
            // botão "Abrir Configurações" que não faz nada é o botão morto que
            // este app existe para eliminar; a mensagem acima já nomeia o
            // remédio real (o cadeado do navegador), então na web o Alert não
            // ganha ação nenhuma.
            actionLabel={
              Platform.OS === 'web' ? undefined : 'Abrir Configurações'
            }
            onAction={
              Platform.OS === 'web' ? undefined : abrirConfiguracoesDoApp
            }
            onClose={() => {
              // Dispensa é definitiva enquanto a tela viver — ver a ref
              // declarada junto ao estado de localização, acima.
              avisoDispensadoRef.current = true;
              setAvisoDeLocalizacaoVisivel(false);
            }}
            testID="aviso-localizacao-desativada"
          />
        )}

        {/* Mini Map - Nos estados pending, active e last-stop para visualização da rota */}
        {route &&
          (routeStatus === 'pending' ||
            routeStatus === 'active' ||
            routeStatus === 'last-stop') && (
            <MiniMap
              paradas={paradas}
              userLocation={location ?? undefined}
              expanded={modals.miniMapExpanded}
              onToggleExpand={modals.toggleMiniMap}
              onOpenFullMap={() => router.push('/motorista/mapa')}
              onOpenPiP={modals.openPiPMap}
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
      {modals.showIncidentWizard && (
        <IncidentReportWizard
          visible={modals.showIncidentWizard}
          onClose={modals.closeIncidentWizard}
          onSubmit={(report) => {
            logger.debug('Incidente reportado:', report);
            modals.closeIncidentWizard();
          }}
          paradaId={modals.selectedParadaForIncident?.id ?? currentStop?.id}
          rotaId={route?.id}
          motoristaId={userData?.id || ''}
          endereco={currentStop?.endereco}
        />
      )}

      {(routeStatus === 'pending' ||
        routeStatus === 'active' ||
        routeStatus === 'last-stop') && (
        <PictureInPictureMap
          visible={modals.showPiPMap}
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
            const primeiraParadaReal = paradas.find(
              (p) => p.is_checkpoint !== false,
            );
            if (primeiraParadaReal) {
              return {
                latitude: primeiraParadaReal.latitude,
                longitude: primeiraParadaReal.longitude,
                address: primeiraParadaReal.endereco,
              };
            }
            return null;
          })()}
          onClose={modals.closePiPMap}
          onExpand={() => {
            modals.closePiPMap();
            if (routeStatus !== 'pending') {
              modals.setNavigationMode(true);
            } else {
              router.push('/motorista/mapa');
            }
          }}
        />
      )}

      <OptimizationAlert
        visible={modals.showOptimization}
        optimization={modals.optimization}
        currentOrder={paradas.filter((p) => p.status === 'pendente')}
        onAccept={handleAcceptOptimization}
        onReject={handleRejectOptimization}
        onClose={modals.dismissOptimization}
      />

      {/* Modal de Conclusão de Parada (com foto) */}
      {/* Usa selectedParadaForCompletion (capturado no momento do swipe) para evitar loop */}
      {/* quando currentStop muda após a conclusão da parada */}
      <StopCompletionFlow
        parada={modals.selectedParadaForCompletion}
        visible={modals.showCompletionFlow}
        onClose={modals.closeCompletionFlow}
        onSuccess={() => refreshRoute()}
        allowSkipPhoto={true}
      />

      <SupportModal
        visible={modals.showSupportModal}
        onClose={modals.closeSupport}
      />

      {/* Modal de Confirmação para Finalizar Rota */}
      <Dialog
        visible={modals.showCompleteRouteModal}
        variant="confirm"
        title="Finalizar Rota"
        message="Todas as paradas foram concluídas. Deseja finalizar a rota?"
        type="success"
        confirmText="Finalizar"
        cancelText="Cancelar"
        loading={isCompletingRoute}
        onConfirm={confirmCompleteRoute}
        onCancel={modals.closeCompleteRoute}
      />

      {/* Skip Reason Modal */}
      {modals.showSkipModal && modals.selectedParadaForSkip && (
        <SkipReasonModal
          visible={modals.showSkipModal}
          parada={modals.selectedParadaForSkip}
          onConfirm={handleConfirmSkip}
          onCancel={modals.closeSkipModal}
        />
      )}

      {/* Swipe gesture onboarding (first visit only) */}
      {showSwipeOnboarding && (
        <SwipeOnboarding onDismiss={() => setShowSwipeOnboarding(false)} />
      )}

      {/* AlertDialog for useAlert hook */}
      {AlertDialog}
    </>
  );
}

// Main component - RouteStatusProvider já está no _layout.tsx
export default function MotoristaInicio() {
  return (
    <ErrorBoundary>
      <MotoristaInicioContent />
    </ErrorBoundary>
  );
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
