import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';

// Contexts
import { RouteStatusProvider, useRouteStatus } from '@/context/RouteStatusContext';
import { useUser } from '@/hooks/useUser';

// Components
import { StatusSection } from '@/components/motorista/home/StatusSection';
import { MainCard } from '@/components/motorista/home/MainCard';
import { ProgressBar } from '@/components/motorista/home/ProgressBar';
import { MiniMap } from '@/components/motorista/home/MiniMap';
import { QuickActions, FloatingActionButton } from '@/components/motorista/home/QuickActions';
import { IncidentReportWizard } from '@/components/IncidentReportWizard';
import { NavigationMode } from '@/components/motorista/NavigationMode';
import { NavigationSettings } from '@/components/motorista/NavigationSettings';
import { PictureInPictureMap } from '@/components/motorista/PictureInPictureMap';
import { OptimizationAlert } from '@/components/motorista/OptimizationAlert';
import DynamicReroutingService from '@/services/dynamicRerouting';

// Utils
import { abrirNavegacao } from '@/lib/navigation';
import LocationTrackingService from '@/services/locationTracking';
import { useUnistyles } from '@/utils/styles';

function MotoristaHomeContent() {
  const router = useRouter();
  const { theme } = useUnistyles();
  const { userData } = useUser();

  // Route context
  const {
    routeStatus,
    route,
    paradas,
    currentStop,
    nextStop,
    progress,
    loading,
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

  // Load user location
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Permission to access location was denied');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      // Subscribe to location updates
      const subscription = await Location.watchPositionAsync(
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

      return () => subscription.remove();
    })();
  }, []);

  // Check for route optimizations periodically
  useEffect(() => {
    if (routeStatus === 'active' && route && paradas.length > 1) {
      // Start monitoring for optimizations
      DynamicReroutingService.startMonitoring(route.id, paradas);

      // Check for optimizations every 5 minutes
      const checkOptimization = setInterval(async () => {
        const opt = await DynamicReroutingService.checkForOptimization(paradas);
        if (opt && opt.timeSaved >= 5) {
          setOptimization(opt);
          setShowOptimization(true);
        }
      }, 5 * 60 * 1000); // 5 minutes

      return () => {
        clearInterval(checkOptimization);
        DynamicReroutingService.stopMonitoring();
      };
    }
  }, [routeStatus, route, paradas]);

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
    } catch (error) {
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
  const handleCompleteStop = async () => {
    if (!currentStop) return;

    Alert.alert(
      'Confirmar Entrega',
      `Confirma a entrega em:\n${currentStop.endereco}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              await completeStop(currentStop.id);
              Alert.alert('Sucesso', 'Parada concluída!');
            } catch (error) {
              Alert.alert('Erro', 'Não foi possível concluir a parada');
            }
          }
        }
      ]
    );
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
            } catch (error) {
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
            } catch (error) {
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
          color: theme.colors.success || '#10b981',
          label: 'Iniciar',
        };

      case 'active':
      case 'last-stop':
        return {
          icon: 'navigate',
          color: theme.colors.secondary || '#f7a02a',
          label: 'Navegar',
        };

      case 'ready-to-complete':
        return {
          icon: 'checkmark-circle',
          color: theme.colors.success || '#10b981',
          label: 'Finalizar',
        };

      case 'completed':
        return {
          icon: 'refresh',
          color: theme.colors.gray500 || '#6b7280',
          label: 'Atualizar',
        };

      case 'no-route':
      default:
        return {
          icon: 'time',
          color: theme.colors.primary || '#1e5aa8',
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
    } catch (error) {
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
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
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
        <StatusSection userName={userData?.nome} />

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
            timeElapsed={getElapsedTime()}
            estimatedTime={route?.tempo_total ? `~${route.tempo_total}h` : undefined}
          />
        )}

        {/* Mini Map */}
        {route && routeStatus !== 'no-route' && routeStatus !== 'completed' && (
          <MiniMap
            paradas={paradas}
            userLocation={location}
            expanded={miniMapExpanded}
            onToggleExpand={() => setMiniMapExpanded(!miniMapExpanded)}
            onOpenFullMap={() => router.push('/motorista/mapa')}
            onOpenPiP={() => setShowPiPMap(true)}
          />
        )}

        {/* Add padding for FAB */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Quick Actions */}
      <QuickActions
        state={routeStatus}
        onViewAllStops={() => router.push('/motorista/checkpoints')}
        onViewHistory={() => router.push('/motorista/historico')}
        onContactSupport={() => Alert.alert('Suporte', 'Em breve!')}
        onReportIncident={() => setShowIncidentWizard(true)}
        onOpenSettings={() => setShowNavigationSettings(true)}
      />

      {/* Floating Action Button */}
      <FloatingActionButton
        icon={fabProps.icon}
        color={fabProps.color}
        onPress={handleMainAction}
        label={fabProps.label}
      />

      {/* Incident Report Wizard */}
      {showIncidentWizard && route && currentStop && (
        <IncidentReportWizard
          visible={showIncidentWizard}
          onClose={() => setShowIncidentWizard(false)}
          onSubmit={(report) => {
            console.log('Incidente reportado:', report);
            setShowIncidentWizard(false);
          }}
          paradaId={currentStop.id}
          rotaId={route.id}
          motoristaId={userData?.id || ''}
          endereco={currentStop.endereco}
        />
      )}

      {/* Navigation Settings */}
      {showNavigationSettings && (
        <NavigationSettings
          visible={showNavigationSettings}
          onClose={() => setShowNavigationSettings(false)}
        />
      )}

      {/* Picture-in-Picture Map */}
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

      {/* Optimization Alert */}
      <OptimizationAlert
        visible={showOptimization}
        optimization={optimization}
        currentOrder={paradas.filter(p => p.status === 'pendente')}
        onAccept={handleAcceptOptimization}
        onReject={handleRejectOptimization}
        onClose={() => setShowOptimization(false)}
      />
    </View>
  );
}

// Main component with provider
export default function MotoristaHome() {
  return (
    <RouteStatusProvider>
      <MotoristaHomeContent />
    </RouteStatusProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollView: {
    flex: 1,
  },
});