import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import CameraUpload from '@/components/CameraUpload';
import { IncidentReportWizard } from '@/components/IncidentReportWizard';
import { MainCard } from '@/components/motorista/home/MainCard';
import { MiniMap } from '@/components/motorista/home/MiniMap';
import { ProgressBar } from '@/components/motorista/home/ProgressBar';
import { FloatingActionButton, BottomActionsBar } from '@/components/motorista/home/QuickActions';
import { StatusSection } from '@/components/motorista/home/StatusSection';
import { NavigationMode } from '@/components/motorista/NavigationMode';
import { NavigationSettings } from '@/components/motorista/NavigationSettings';
import { OptimizationAlert } from '@/components/motorista/OptimizationAlert';
import { PictureInPictureMap } from '@/components/motorista/PictureInPictureMap';
import { SupportModal } from '@/components/SupportModal';
import { RouteStatusProvider, useRouteStatus } from '@/context/RouteStatusContext';
import { useUser } from '@/hooks/useUser';
import { abrirNavegacao } from '@/lib/navigation';
import DynamicReroutingService from '@/services/dynamicRerouting';
import LocationTrackingService from '@/services/locationTracking';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';
import { formatarTempo } from '@/utils/timeEstimation';

function MotoristaInicioContent() {
  const router = useRouter();
  const { theme } = useUnistyles();
  const { userData } = useUser();
  const insets = useSafeAreaInsets();

  // Route context
  const {
    routeStatus,
    route,
    paradas,
    currentStop,
    nextStop,
    progress,
    refreshRoute,
    startRoute,
    completeStop,
    skipStop,
    completeRoute,
  } = useRouteStatus();

  // Local state
  const [refreshing, setRefreshing] = useState(false);
  const [miniMapExpanded, setMiniMapExpanded] = useState(false);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showIncidentWizard, setShowIncidentWizard] = useState(false);
  const [navigationMode, setNavigationMode] = useState(false);
  const [showNavigationSettings, setShowNavigationSettings] = useState(false);
  const [showPiPMap, setShowPiPMap] = useState(false);
  const [optimization, setOptimization] = useState<any>(null);
  const [showOptimization, setShowOptimization] = useState(false);
  const [showCameraUpload, setShowCameraUpload] = useState(false);
  const [pendingStopToComplete, setPendingStopToComplete] = useState<string | null>(null);
  const [showSupportModal, setShowSupportModal] = useState(false);

  // Load user location
  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.log('[Location] Permission to access location was denied');
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
          console.warn('[Location] Could not get current position:', positionError);
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
        console.error('[Location] Error setting up location tracking:', error);
      }
    })();

    return () => {
      if (subscription) {
        subscription.remove();
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
        refreshRoute();
        break;

      case 'no-route':
      default:
        router.push('/motorista/historico');
        break;
    }
  };

  // Start route
  const handleStartRoute = async () => {
    try {
      await startRoute();
      Alert.alert('Rota Iniciada', 'Boa viagem! Dirija com segurança.');
    } catch {
      Alert.alert('Erro', 'Não foi possível iniciar a rota');
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

  // Complete current stop
  const handleCompleteStop = async (fotoUrl?: string) => {
    if (!currentStop) return;

    // Se não tem foto, abrir camera upload
    if (!fotoUrl) {
      setPendingStopToComplete(currentStop.id);
      setShowCameraUpload(true);
      return;
    }

    // Se tem foto, confirmar e concluir
    Alert.alert(
      'Confirmar Entrega',
      `Confirma a entrega em:\n${currentStop.endereco}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              await completeStop(currentStop.id, fotoUrl);
              Alert.alert('Sucesso', 'Parada concluída com foto de comprovante!');
              setPendingStopToComplete(null);
            } catch {
              Alert.alert('Erro', 'Não foi possível concluir a parada');
            }
          }
        }
      ]
    );
  };

  // Handle photo upload success
  const handlePhotoUploadSuccess = (fotoUrl: string) => {
    setShowCameraUpload(false);
    if (pendingStopToComplete) {
      handleCompleteStop(fotoUrl);
    }
  };

  // Handle photo upload error
  const handlePhotoUploadError = (error: string) => {
    Alert.alert('Erro no Upload', error, [
      {
        text: 'Continuar sem foto',
        onPress: () => {
          setShowCameraUpload(false);
          if (pendingStopToComplete && currentStop) {
            // Allow completing without photo
            Alert.alert(
              'Confirmar sem foto',
              'Deseja concluir a parada sem foto de comprovante?',
              [
                { text: 'Cancelar', style: 'cancel' },
                {
                  text: 'Confirmar',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await completeStop(currentStop.id);
                      Alert.alert('Sucesso', 'Parada concluída (sem foto)');
                      setPendingStopToComplete(null);
                    } catch {
                      Alert.alert('Erro', 'Não foi possível concluir a parada');
                    }
                  }
                }
              ]
            );
          }
        }
      },
      { text: 'Tentar novamente', style: 'cancel' }
    ]);
  };

  // Skip current stop
  const handleSkipStop = async () => {
    if (!currentStop) return;

    Alert.alert(
      'Pular Parada',
      `Deseja pular esta parada?\n${currentStop.endereco}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Pular',
          style: 'destructive',
          onPress: async () => {
            try {
              await skipStop(currentStop.id);
              Alert.alert('Parada Pulada', 'Você pode voltar a ela mais tarde');
            } catch {
              Alert.alert('Erro', 'Não foi possível pular a parada');
            }
          }
        }
      ]
    );
  };

  // Complete route
  const handleCompleteRoute = async () => {
    Alert.alert(
      'Finalizar Rota',
      'Todas as paradas foram concluídas. Deseja finalizar a rota?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Finalizar',
          onPress: async () => {
            try {
              await completeRoute();
              Alert.alert('Parabéns!', 'Rota concluída com sucesso!');
            } catch {
              Alert.alert('Erro', 'Não foi possível finalizar a rota');
            }
          }
        }
      ]
    );
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

    return `${hours}h ${minutes}min`;
  };

  // Get FAB properties
  const getFABProps = () => {
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
          icon: 'refresh',
          color: theme.colors.gray500,
          label: 'Atualizar',
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

      Alert.alert('Sucesso', `Rota otimizada! Você economizará ${optimization.timeSaved} minutos.`);
      setShowOptimization(false);
      setOptimization(null);
    } catch {
      Alert.alert('Erro', 'Não foi possível aplicar a otimização');
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
        onComplete={handleNavigationComplete}
        onSkip={handleNavigationSkip}
        onExit={handleNavigationExit}
      />
    );
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 100 + insets.bottom },
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
          userName={userData?.nome}
          unitName={userData?.unidades?.nome}
          userPhoto={userData?.foto_url}
          routeStatus={routeStatus}
          completedStops={progress.completed}
          totalStops={progress.total}
        />

        {/* Main Card */}
        <MainCard
          state={routeStatus}
          route={route}
          paradas={paradas}
          currentStop={currentStop}
          nextStop={nextStop}
          location={location}
          onSwipeLeft={handleSkipStop}
          onSwipeRight={handleCompleteStop}
          onPress={handleMainAction}
        />

        {/* Progress Bar */}
        {(routeStatus === 'active' || routeStatus === 'last-stop') && (
          <ProgressBar
            completed={progress.completed}
            total={progress.total}
            timeElapsed={getElapsedTime() ?? undefined}
            estimatedTime={route?.tempo_total ? `~${formatarTempo(route.tempo_total)}` : undefined}
            currentStopIndex={currentStop?.ordem}
          />
        )}

        {/* Mini Map */}
        {route && routeStatus !== 'no-route' && routeStatus !== 'completed' && (
          <MiniMap
            paradas={paradas}
            userLocation={location ?? undefined}
            expanded={miniMapExpanded}
            onToggleExpand={() => setMiniMapExpanded(!miniMapExpanded)}
            onOpenFullMap={() => router.push('/motorista/mapa')}
            onOpenPiP={() => setShowPiPMap(true)}
            route={route}
          />
        )}

      </ScrollView>

      {/* Bottom Actions Bar - fixo no bottom */}
      <BottomActionsBar
        state={routeStatus}
        bottomInset={insets.bottom}
        onViewAllStops={() => router.push('/motorista/checkpoints')}
        onContactSupport={() => setShowSupportModal(true)}
        onReportIncident={() => setShowIncidentWizard(true)}
        onOpenSettings={() => setShowNavigationSettings(true)}
        onViewSummary={() => router.push('/motorista/resumo')}
        onViewHistory={() => router.push('/motorista/historico')}
      />

      {/* Floating Action Button - absolute positioned outside ScrollView */}
      <FloatingActionButton
        icon={fabProps.icon}
        color={fabProps.color}
        onPress={handleMainAction}
        label={fabProps.label}
      />

      {/* Modals - rendered outside ScrollView */}
      {showIncidentWizard && (
        <IncidentReportWizard
          visible={showIncidentWizard}
          onClose={() => setShowIncidentWizard(false)}
          onSubmit={(report) => {
            console.log('Incidente reportado:', report);
            setShowIncidentWizard(false);
          }}
          paradaId={currentStop?.id}
          rotaId={route?.id}
          motoristaId={userData?.id || ''}
          endereco={currentStop?.endereco}
        />
      )}

      {showNavigationSettings && (
        <NavigationSettings
          visible={showNavigationSettings}
          onClose={() => setShowNavigationSettings(false)}
        />
      )}

      {(routeStatus === 'active' || routeStatus === 'last-stop') && (
        <PictureInPictureMap
          visible={showPiPMap}
          userLocation={location}
          destination={currentStop ? {
            latitude: currentStop.latitude,
            longitude: currentStop.longitude,
            address: currentStop.endereco,
          } : null}
          onClose={() => setShowPiPMap(false)}
          onExpand={() => {
            setShowPiPMap(false);
            setNavigationMode(true);
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

      {showCameraUpload && currentStop && route && userData && (
        <View style={styles.cameraUploadOverlay}>
          <View style={styles.cameraUploadContainer}>
            <View style={styles.cameraUploadHeader}>
              <Text style={styles.cameraUploadTitle}>📸 Foto de Comprovante</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowCameraUpload(false);
                  setPendingStopToComplete(null);
                }}
                style={styles.cameraUploadClose}
              >
                <Ionicons name="close" size={24} color={theme.colors.gray500} />
              </TouchableOpacity>
            </View>
            <Text style={styles.cameraUploadAddress}>{currentStop.endereco}</Text>
            <CameraUpload
              unidadeId={userData.unidade_id!}
              rotaId={route.id}
              paradaId={currentStop.id}
              onUploadSuccess={handlePhotoUploadSuccess}
              onUploadError={handlePhotoUploadError}
            />
          </View>
        </View>
      )}

      <SupportModal
        visible={showSupportModal}
        onClose={() => setShowSupportModal(false)}
      />
    </>
  );
}

// Main component with provider
export default function MotoristaInicio() {
  return (
    <RouteStatusProvider>
      <MotoristaInicioContent />
    </RouteStatusProvider>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
  },
  scrollContent: {
    paddingBottom: 180,
  },
  cameraUploadOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  cameraUploadContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  cameraUploadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cameraUploadTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.gray900,
  },
  cameraUploadClose: {
    padding: 4,
  },
  cameraUploadAddress: {
    fontSize: 14,
    color: theme.colors.gray500,
    marginBottom: 16,
  },
}));




