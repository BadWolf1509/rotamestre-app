import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { ParadaData } from '@/context/RouteStatusContext';
import { abrirNavegacao } from '@/lib/navigation';
import LocationTrackingService from '@/services/locationTracking';
import { calculateHaversineDistance } from '@/services/turnByTurnNavigation';
import { withOpacity } from '@/utils/color';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

interface NavigationPreferences {
  soundAlerts: boolean;
  vibrationAlerts: boolean;
  showSpeedometer: boolean;
  internalNavigation: boolean;
}


import { NavigationSettings } from './NavigationSettings';
import { TurnByTurnNavigation } from './TurnByTurnNavigation';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface NavigationModeProps {
  currentStop: ParadaData;
  nextStop?: ParadaData | null;
  paradas: ParadaData[];
  rotaId?: string;
  onComplete: () => void;
  onSkip: () => void;
  onExit: () => void;
}

export function NavigationMode({
  currentStop,
  nextStop,
  paradas,
  rotaId,
  onComplete,
  onSkip,
  onExit,
}: NavigationModeProps) {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
    heading?: number;
  } | null>(null);
  const [speed, setSpeed] = useState(0);
  const [distance, setDistance] = useState<number | null>(null);
  const [eta, setEta] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [navigationMode, setNavigationMode] = useState<'map' | 'turn-by-turn'>('map');
  const [isInitializing, setIsInitializing] = useState(true);
  const [preferences, setPreferences] = useState<NavigationPreferences>({
    soundAlerts: true,
    vibrationAlerts: true,
    showSpeedometer: true,
    internalNavigation: false,
  });
  const mapRef = useRef<MapView>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  const startNavigation = useCallback(async () => {
    if (!currentStop || !rotaId) return;

    const tracking = await LocationTrackingService.startTracking(
      rotaId,
      currentStop.id,
      nextStop?.id
    );
    setIsTracking(tracking);
  }, [currentStop, nextStop, rotaId]);

  const stopNavigation = useCallback(async () => {
    await LocationTrackingService.stopTracking();
    setIsTracking(false);
  }, []);

  const loadPreferences = useCallback(async () => {
    try {
      const prefs = await LocationTrackingService.getNavigationPreferences();
      const newPrefs: NavigationPreferences = {
        soundAlerts: prefs.soundAlerts ?? true,
        vibrationAlerts: prefs.vibrationAlerts ?? true,
        showSpeedometer: prefs.showSpeedometer ?? true,
        internalNavigation: prefs.internalNavigation ?? false,
      };
      setPreferences(newPrefs);
      if (newPrefs.internalNavigation) {
        setNavigationMode('turn-by-turn');
      }
    } catch {
      // Falha ao carregar preferências - usar padrão
    }
  }, []);

  const triggerHaptic = useCallback(async (type: 'impact' | 'success' | 'warning') => {
    if (Platform.OS === 'web' || !preferences.vibrationAlerts) return;

    try {
      if (type === 'impact') {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else if (type === 'success') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (type === 'warning') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    } catch {
      // Haptics not available
    }
  }, [preferences.vibrationAlerts]);

  const playNotificationSound = useCallback(async () => {
    if (Platform.OS === 'web' || !preferences.soundAlerts) return;

    try {
      // Configure audio mode for notifications
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: false,
        staysActiveInBackground: false,
      });

      // Unload previous sound if exists
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      // Play a simple notification beep using Audio
      // Note: Custom sounds can be added to assets/sounds/ folder
      // For now, we use haptics as the primary feedback
    } catch {
      // Audio not available
    }
  }, [preferences.soundAlerts]);


  useEffect(() => {
    const initialize = async () => {
      await startNavigation();
      await loadPreferences();
      setIsInitializing(false);
    };
    initialize();
    return () => {
      stopNavigation();
      // Cleanup sound
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, [loadPreferences, startNavigation, stopNavigation]);

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 5,
        },
        (location) => {
          const coords = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            heading: location.coords.heading || undefined,
          };
          setUserLocation(coords);
          setSpeed(Math.round((location.coords.speed || 0) * 3.6)); // m/s to km/h

          // Calculate distance to destination
          if (currentStop) {
            const dist = calculateHaversineDistance(
              coords.latitude,
              coords.longitude,
              currentStop.latitude,
              currentStop.longitude
            );
            setDistance(dist);

            // Estimate time of arrival
            if (location.coords.speed && location.coords.speed > 0) {
              const timeInSeconds = dist / location.coords.speed;
              const minutes = Math.ceil(timeInSeconds / 60);
              setEta(`${minutes} min`);
            }
          }
        }
      );
    })();

    return () => {
      try {
        subscription?.remove();
      } catch (error) {
        // expo-location remove() não funciona corretamente na web
        console.warn('[NavigationMode] Error removing subscription:', error);
      }
    };
  }, [currentStop]);

  const handleOpenInMaps = () => {
    if (!currentStop) return;

    // If internal nav is enabled, switch to turn-by-turn mode
    if (preferences.internalNavigation) {
      setNavigationMode('turn-by-turn');
    } else {
      // Open in external app
      abrirNavegacao({
        latitude: currentStop.latitude,
        longitude: currentStop.longitude,
        endereco: currentStop.endereco,
      });
    }
  };

  const handleCompleteStop = async () => {
    await triggerHaptic('impact');
    Alert.alert(
      'Confirmar Entrega',
      `Confirma a entrega em:\n${currentStop.endereco}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            await playNotificationSound();
            await triggerHaptic('success');
            onComplete();
          },
        },
      ]
    );
  };

  const handleSkipStop = async () => {
    await triggerHaptic('impact');
    Alert.alert(
      'Pular Parada',
      `Deseja pular esta parada?\n${currentStop.endereco}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Pular',
          style: 'destructive',
          onPress: async () => {
            await triggerHaptic('warning');
            onSkip();
          },
        },
      ]
    );
  };

  const handleExitNavigation = () => {
    Alert.alert(
      'Sair da Navegação',
      'Deseja sair do modo de navegação?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: async () => {
            await stopNavigation();
            onExit();
          },
        },
      ]
    );
  };

  const formatDistance = (meters: number): string => {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
  };

  const getRegion = () => {
    if (userLocation && currentStop) {
      const minLat = Math.min(userLocation.latitude, currentStop.latitude);
      const maxLat = Math.max(userLocation.latitude, currentStop.latitude);
      const minLon = Math.min(userLocation.longitude, currentStop.longitude);
      const maxLon = Math.max(userLocation.longitude, currentStop.longitude);

      return {
        latitude: (minLat + maxLat) / 2,
        longitude: (minLon + maxLon) / 2,
        latitudeDelta: Math.max(0.01, (maxLat - minLat) * 1.5),
        longitudeDelta: Math.max(0.01, (maxLon - minLon) * 1.5),
      };
    }

    return currentStop
      ? {
          latitude: currentStop.latitude,
          longitude: currentStop.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }
      : null;
  };

  const region = getRegion();

  // Calculate remaining waypoints for turn-by-turn navigation
  const remainingWaypoints = useMemo(() => {
    return paradas
      .filter((p) => p.id !== currentStop?.id && p.status === 'pendente')
      .map((p) => ({ latitude: p.latitude, longitude: p.longitude }));
  }, [paradas, currentStop]);

  // Loading state
  if (isInitializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Preparando navegação...</Text>
      </View>
    );
  }

  if (!currentStop || !region) return null;

  // Show turn-by-turn navigation if selected
  if (navigationMode === 'turn-by-turn' && userLocation) {
    return (
      <TurnByTurnNavigation
        origin={userLocation}
        destination={{
          latitude: currentStop.latitude,
          longitude: currentStop.longitude,
          address: currentStop.endereco,
        }}
        waypoints={remainingWaypoints}
        onArrive={handleCompleteStop}
        onExit={() => setNavigationMode('map')}
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        region={region}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        rotateEnabled={false}
        toolbarEnabled={false}
      >
        {/* Destination Marker */}
        <Marker
          coordinate={{
            latitude: currentStop.latitude,
            longitude: currentStop.longitude,
          }}
          title={currentStop.endereco}
          description={currentStop.observacoes}
        >
          <View style={styles.destinationMarker}>
            <Ionicons name="location" size={30} color={theme.colors.error} />
          </View>
        </Marker>

        {/* Other stops */}
        {paradas
          .filter((p) => p.id !== currentStop.id && p.status === 'pendente')
          .map((parada) => (
            <Marker
              key={parada.id}
              coordinate={{
                latitude: parada.latitude,
                longitude: parada.longitude,
              }}
              opacity={0.6}
            >
              <View style={styles.otherMarker}>
                <Text style={styles.markerText}>{parada.ordem}</Text>
              </View>
            </Marker>
          ))}
      </MapView>

      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.exitButton} onPress={handleExitNavigation}>
          <Ionicons name="close" size={24} color={theme.colors.white} />
        </TouchableOpacity>

        {isTracking && (
          <View style={styles.trackingBadge}>
            <View style={styles.trackingDot} />
            <Text style={styles.trackingText}>Rastreando</Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => setShowSettings(true)}
        >
          <Ionicons name="settings-outline" size={24} color={theme.colors.white} />
        </TouchableOpacity>
      </View>

      {/* Navigation Info Panel */}
      {/* Usa Math.max para garantir mínimo de 34px (Android 15 pode retornar insets.bottom = 0) */}
      <View style={[styles.infoPanel, { paddingBottom: theme.spacing.xl + Math.max(insets.bottom, 34) }]}>
        {/* Distance and ETA */}
        <View style={styles.mainInfo}>
          <View style={styles.distanceContainer}>
            <Text style={styles.distanceValue}>
              {distance ? formatDistance(distance) : '--'}
            </Text>
            <Text style={styles.distanceLabel}>distância</Text>
          </View>

          <View style={styles.separator} />

          <View style={styles.etaContainer}>
            <Text style={styles.etaValue}>{eta || '--'}</Text>
            <Text style={styles.etaLabel}>chegada</Text>
          </View>

          {preferences.showSpeedometer && (
            <>
              <View style={styles.separator} />

              <View style={styles.speedContainer}>
                <Text style={styles.speedValue}>{speed}</Text>
                <Text style={styles.speedUnit}>km/h</Text>
              </View>
            </>
          )}
        </View>

        {/* Current Destination */}
        <View style={styles.destinationInfo}>
          <View style={styles.destinationHeader}>
            <Text style={styles.destinationLabel}>
              PARADA {currentStop.ordem}/{paradas.length}
            </Text>
            {nextStop && (
              <Text style={styles.nextStopHint}>
                Próxima: {nextStop.endereco.split(',')[0]}
              </Text>
            )}
          </View>
          <Text style={styles.destinationAddress}>{currentStop.endereco}</Text>

          {currentStop.destinatario && (
            <View style={styles.recipientInfo}>
              <Ionicons name="person-outline" size={14} color={theme.colors.gray500} />
              <Text style={styles.recipientText}>{currentStop.destinatario}</Text>
            </View>
          )}

          {currentStop.observacoes && (
            <View style={styles.observationBox}>
              <Text style={styles.observationText}>{currentStop.observacoes}</Text>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.skipButton]}
            onPress={handleSkipStop}
          >
            <Ionicons name="arrow-forward-circle-outline" size={20} color={theme.colors.warning} />
            <Text style={styles.skipButtonText}>Pular</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.mapsButton]}
            onPress={handleOpenInMaps}
          >
            <Ionicons name="navigate" size={20} color={theme.colors.white} />
            <Text style={styles.mapsButtonText}>
              {preferences.internalNavigation ? 'Navegar' : 'Abrir no Maps'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.completeButton]}
            onPress={handleCompleteStop}
          >
            <Ionicons name="checkmark-circle" size={20} color={theme.colors.white} />
            <Text style={styles.completeButtonText}>Concluir</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Settings Modal */}
      {showSettings && (
        <View style={styles.settingsOverlay}>
          <NavigationSettings
            visible={showSettings}
            onClose={() => setShowSettings(false)}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.gray50,
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray600,
    fontFamily: theme.typography.fontSans,
  },
  map: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    backgroundColor: withOpacity(theme.colors.black, 0.5),
  },
  exitButton: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.full,
    backgroundColor: withOpacity(theme.colors.black, 0.3),
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.full,
    backgroundColor: withOpacity(theme.colors.black, 0.3),
    justifyContent: 'center',
    alignItems: 'center',
  },
  trackingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs + 2,
    backgroundColor: withOpacity(theme.colors.success, 0.9),
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs + 2,
    borderRadius: theme.borderRadius.xl,
  },
  trackingDot: {
    width: theme.spacing.sm,
    height: theme.spacing.sm,
    borderRadius: theme.spacing.xs,
    backgroundColor: theme.colors.white,
  },
  trackingText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  infoPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    paddingTop: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
    // paddingBottom é definido dinamicamente com Math.max(insets.bottom, 34)
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  mainInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
  },
  distanceContainer: {
    alignItems: 'center',
  },
  distanceValue: {
    fontSize: theme.typography.fontSize['3xl'],
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.gray900,
  },
  distanceLabel: {
    fontSize: theme.typography.fontSize.xs - 1,
    color: theme.colors.gray500,
    marginTop: 2,
  },
  separator: {
    width: 1,
    height: 40,
    backgroundColor: theme.colors.gray200,
  },
  etaContainer: {
    alignItems: 'center',
  },
  etaValue: {
    fontSize: theme.typography.fontSize.xl + 4,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
  },
  etaLabel: {
    fontSize: theme.typography.fontSize.xs - 1,
    color: theme.colors.gray500,
    marginTop: 2,
  },
  speedContainer: {
    alignItems: 'center',
  },
  speedValue: {
    fontSize: theme.typography.fontSize['2xl'] + 4,
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.gray900,
  },
  speedUnit: {
    fontSize: theme.typography.fontSize.xs - 1,
    color: theme.colors.gray500,
    marginTop: 2,
  },
  destinationInfo: {
    paddingVertical: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
  },
  destinationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  destinationLabel: {
    fontSize: theme.typography.fontSize.xs - 2,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray500,
    letterSpacing: 0.5,
  },
  nextStopHint: {
    fontSize: theme.typography.fontSize.xs - 2,
    color: theme.colors.gray400,
  },
  destinationAddress: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
    marginBottom: theme.spacing.sm,
  },
  recipientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs + 2,
    marginBottom: theme.spacing.sm,
  },
  recipientText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray500,
  },
  observationBox: {
    backgroundColor: theme.colors.warningBg,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    marginTop: theme.spacing.sm,
  },
  observationText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.secondaryDark,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.lg,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs + 2,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
  },
  skipButton: {
    backgroundColor: theme.colors.warningBg,
  },
  skipButtonText: {
    color: theme.colors.warning,
    fontFamily: theme.typography.fontSansSemiBold,
    fontSize: theme.typography.fontSize.sm,
  },
  mapsButton: {
    backgroundColor: theme.colors.primary,
  },
  mapsButtonText: {
    color: theme.colors.white,
    fontFamily: theme.typography.fontSansSemiBold,
    fontSize: theme.typography.fontSize.sm,
    // Brand guideline: text shadow for white text on colored background
    textShadowColor: withOpacity(theme.colors.black, 0.25),
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  completeButton: {
    backgroundColor: theme.colors.success,
  },
  completeButtonText: {
    color: theme.colors.white,
    fontFamily: theme.typography.fontSansSemiBold,
    fontSize: theme.typography.fontSize.sm,
    // Brand guideline: text shadow for white text on colored background
    textShadowColor: withOpacity(theme.colors.black, 0.25),
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  destinationMarker: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.full,
    padding: theme.spacing.xs + 1,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: theme.spacing.xs,
    elevation: 5,
  },
  otherMarker: {
    backgroundColor: theme.colors.gray500,
    width: 30,
    height: 30,
    borderRadius: theme.borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.white,
  },
  markerText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  settingsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
}));


