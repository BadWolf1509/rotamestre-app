import { Ionicons } from '@expo/vector-icons';
import * as MapLibreGL from '@maplibre/maplibre-react-native';
import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform, Text, View } from 'react-native';

import { useAlert } from '@/hooks/useAlert';
import { useOffRouteDetection } from '@/hooks/useOffRouteDetection';
import { formatarDecimal } from '@/lib/formatNumber';
import { logger } from '@/lib/logger';
import { OPENFREEMAP_STYLE_URL, toLineString, toLngLat } from '@/lib/maplibre';
import LocationTrackingService from '@/services/locationTracking';
import TurnByTurnNavigationService, {
  calculateHaversineDistance,
  type NavigationInstruction,
} from '@/services/turnByTurnNavigation';
import type { IconName } from '@/types/icons';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

import { MANEUVER_ICONS } from './maneuverIcons';
import { BottomPanel, InstructionBar, OffRouteAlerts } from './turn-by-turn';

import type {
  CameraRef,
  InitialViewState,
} from '@maplibre/maplibre-react-native';

// Default values (used when preferences not loaded)
const DEFAULT_PROXIMITY_RADIUS = 30; // meters
const DEFAULT_VOICE_ENABLED = true;
const DEFAULT_PREVENT_SCREEN_SLEEP = true;

interface TurnByTurnNavigationProps {
  origin: { latitude: number; longitude: number };
  destination: { latitude: number; longitude: number; address: string };
  waypoints?: Array<{ latitude: number; longitude: number }>;
  onArrive: () => void;
  onExit: () => void;
}

export function TurnByTurnNavigation({
  origin,
  destination,
  waypoints,
  onArrive,
  onExit,
}: TurnByTurnNavigationProps) {
  const { theme } = useUnistyles();
  const { showError, AlertDialog } = useAlert();
  const cameraRef = useRef<CameraRef>(null);

  // Refs for preventing race conditions and multiple triggers
  const hasArrivedRef = useRef(false);
  const lastProcessedLocation = useRef<{ lat: number; lng: number } | null>(
    null,
  );
  const lastAnimatedLocation = useRef<{ lat: number; lng: number } | null>(
    null,
  );
  const lastAnimatedHeading = useRef<number>(0);

  // User preferences state
  const [proximityRadius, setProximityRadius] = useState(
    DEFAULT_PROXIMITY_RADIUS,
  );
  const [preventScreenSleep, setPreventScreenSleep] = useState(
    DEFAULT_PREVENT_SCREEN_SLEEP,
  );
  const [vibrationAlerts, setVibrationAlerts] = useState(true);

  // Navigation state
  const [userLocation, setUserLocation] = useState(origin);
  const [speed, setSpeed] = useState(0);
  const [heading, setHeading] = useState(0);
  const [currentInstruction, setCurrentInstruction] =
    useState<NavigationInstruction | null>(null);
  const [nextInstruction, setNextInstruction] =
    useState<NavigationInstruction | null>(null);
  const [distanceToTurn, setDistanceToTurn] = useState(0);
  const [routeCoordinates, setRouteCoordinates] = useState<
    Array<{ latitude: number; longitude: number }>
  >([]);
  const [remainingDistance, setRemainingDistance] = useState(0);
  const [remainingTime, setRemainingTime] = useState(0);
  const [progress, setProgress] = useState(0);
  const [voiceEnabled, setVoiceEnabled] = useState(DEFAULT_VOICE_ENABLED);
  const [isLoading, setIsLoading] = useState(true);
  const [isRouteReady, setIsRouteReady] = useState(false);
  const [mapView, setMapView] = useState<'north-up' | 'heading-up'>(
    'heading-up',
  );
  const voiceEnabledRef = useRef(voiceEnabled);

  // Load user preferences on mount
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const prefs = await LocationTrackingService.getNavigationPreferences();
        if (prefs.proximityRadius !== undefined) {
          setProximityRadius(prefs.proximityRadius);
        }
        if (prefs.voiceNavigation !== undefined) {
          setVoiceEnabled(prefs.voiceNavigation);
          TurnByTurnNavigationService.setVoiceEnabled(prefs.voiceNavigation);
        }
        if (prefs.preventScreenSleep !== undefined) {
          setPreventScreenSleep(prefs.preventScreenSleep);
        }
        if (prefs.vibrationAlerts !== undefined) {
          setVibrationAlerts(prefs.vibrationAlerts);
        }
      } catch (error) {
        logger.warn('[TurnByTurn] Error loading preferences:', error);
      }
    };
    loadPreferences();
  }, []);

  // Manage screen awake state based on preference
  useEffect(() => {
    if (preventScreenSleep && Platform.OS !== 'web') {
      activateKeepAwakeAsync('turn-by-turn-navigation');
    }
    return () => {
      deactivateKeepAwake('turn-by-turn-navigation');
    };
  }, [preventScreenSleep]);

  useEffect(() => {
    voiceEnabledRef.current = voiceEnabled;
  }, [voiceEnabled]);

  // Haptic feedback helper that respects preference
  const triggerHaptic = useCallback(
    async (type: 'light' | 'success' | 'warning') => {
      if (Platform.OS === 'web' || !vibrationAlerts) return;

      try {
        if (type === 'light') {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } else if (type === 'success') {
          await Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success,
          );
        } else if (type === 'warning') {
          await Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Warning,
          );
        }
      } catch {
        // Haptics not available
      }
    },
    [vibrationAlerts],
  );

  // Reroute callback for off-route detection
  const handleReroute = useCallback(async () => {
    // Mark route as not ready during recalculation
    setIsRouteReady(false);

    // Reset service and recalculate route from current position
    TurnByTurnNavigationService.reset();

    const route = await TurnByTurnNavigationService.getDirections(
      userLocation, // Use current location as new origin
      destination,
      waypoints,
    );

    if (route) {
      const coordinates = TurnByTurnNavigationService.getRouteCoordinates();
      setRouteCoordinates(coordinates);
      setRemainingDistance(route.distance);
      setRemainingTime(route.duration);

      const firstInstruction =
        TurnByTurnNavigationService.getCurrentInstruction();
      setCurrentInstruction(firstInstruction);

      const secondInstruction =
        TurnByTurnNavigationService.getNextInstruction();
      setNextInstruction(secondInstruction);

      // Mark route as ready
      setIsRouteReady(true);
    }
  }, [userLocation, destination, waypoints]);

  // Off-route detection hook
  const {
    status: offRouteStatus,
    distanceFromRoute,
    isRecalculating,
  } = useOffRouteDetection(userLocation, routeCoordinates, handleReroute, {
    warningThreshold: 100,
    criticalThreshold: 200,
    enabled: !isLoading,
  });

  // Handle arrival at destination - defined before useEffect that uses it
  const handleArrival = useCallback(async () => {
    // Prevent multiple arrival triggers (debounce)
    if (hasArrivedRef.current) return;
    hasArrivedRef.current = true;

    // Haptic feedback for arrival
    await triggerHaptic('success');

    // Respect voice preference
    if (voiceEnabledRef.current) {
      Speech.speak('Você chegou ao seu destino', {
        language: 'pt-BR',
        pitch: 1.0,
        rate: 0.9,
      });
    }

    setTimeout(() => {
      onArrive();
    }, 2000);
  }, [onArrive, triggerHaptic]);

  // Update navigation based on position - defined before useEffect that uses it
  const updateNavigation = useCallback(
    async (
      currentLocation: { latitude: number; longitude: number },
      speedMs: number,
    ) => {
      const update = await TurnByTurnNavigationService.updateNavigation(
        currentLocation,
        speedMs * 3.6, // Convert to km/h
      );

      setCurrentInstruction(update.currentInstruction);
      setNextInstruction(update.nextInstruction);
      setDistanceToTurn(update.distanceToNextTurn);
      setProgress(TurnByTurnNavigationService.getProgressByDistance());
      setRemainingDistance(TurnByTurnNavigationService.getRemainingDistance());
      setRemainingTime(TurnByTurnNavigationService.getRemainingTime());

      // Speak instruction if needed
      if (
        update.shouldSpeak &&
        update.currentInstruction?.voiceInstruction &&
        voiceEnabledRef.current
      ) {
        TurnByTurnNavigationService.speakInstruction(
          update.currentInstruction.voiceInstruction,
        );
      }
    },
    [voiceEnabledRef],
  );

  // Initialize navigation with directions - defined before useEffect that uses it
  const initializeNavigation = useCallback(async () => {
    setIsLoading(true);

    const route = await TurnByTurnNavigationService.getDirections(
      origin,
      destination,
      waypoints,
    );

    if (!route) {
      showError({ title: 'Erro', message: 'Não foi possível calcular a rota' });
      onExit();
      return;
    }

    // Set route polyline
    const coordinates = TurnByTurnNavigationService.getRouteCoordinates();
    setRouteCoordinates(coordinates);

    // Set initial values
    setRemainingDistance(route.distance);
    setRemainingTime(route.duration);

    // Get first instruction
    const firstInstruction =
      TurnByTurnNavigationService.getCurrentInstruction();
    setCurrentInstruction(firstInstruction);

    const secondInstruction = TurnByTurnNavigationService.getNextInstruction();
    setNextInstruction(secondInstruction);

    setIsLoading(false);
    setIsRouteReady(true);

    // Speak initial instruction
    if (firstInstruction?.voiceInstruction && voiceEnabledRef.current) {
      setTimeout(() => {
        Speech.speak(
          `Iniciando navegação. ${firstInstruction.voiceInstruction}`,
          {
            language: 'pt-BR',
            pitch: 1.0,
            rate: 0.9,
          },
        );
      }, 1000);
    }
  }, [destination, onExit, origin, voiceEnabledRef, waypoints, showError]);

  // Initialize navigation
  useEffect(() => {
    initializeNavigation();
    return () => {
      TurnByTurnNavigationService.reset();
      Speech.stop();
      hasArrivedRef.current = false;
    };
  }, [initializeNavigation]);

  // Watch position updates
  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showError({
          title: 'Erro',
          message: 'Permissão de localização negada',
        });
        return;
      }

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 5,
        },
        async (location) => {
          const coords = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };
          const accuracy = location.coords.accuracy || 50;

          // Throttle: only process if moved > 3m (reduces unnecessary processing)
          const lastLoc = lastProcessedLocation.current;
          if (lastLoc) {
            const delta = calculateHaversineDistance(
              lastLoc.lat,
              lastLoc.lng,
              coords.latitude,
              coords.longitude,
            );
            if (delta < 3) {
              return; // Skip insignificant movement
            }
          }
          lastProcessedLocation.current = {
            lat: coords.latitude,
            lng: coords.longitude,
          };

          setUserLocation(coords);
          setSpeed(Math.round((location.coords.speed || 0) * 3.6)); // m/s to km/h
          setHeading(location.coords.heading || 0);

          // Only update navigation if route is ready (prevents race condition)
          if (isRouteReady) {
            await updateNavigation(coords, location.coords.speed || 0);
          }

          // Check if arrived at destination
          const distToDestination = calculateHaversineDistance(
            coords.latitude,
            coords.longitude,
            destination.latitude,
            destination.longitude,
          );

          // Arrival detection with GPS accuracy consideration:
          // 1. Distance < proximity radius
          // 2. GPS accuracy is good (< 30m) OR very close (< 10m regardless of accuracy)
          const isArrived =
            distToDestination < proximityRadius &&
            (accuracy < 30 || distToDestination < 10);

          if (isArrived && !hasArrivedRef.current) {
            handleArrival();
          }
        },
      );
    })();

    return () => {
      try {
        subscription?.remove();
      } catch (error) {
        // expo-location remove() não funciona corretamente na web
        logger.warn('[TurnByTurn] Error removing subscription:', error);
      }
    };
  }, [
    destination,
    handleArrival,
    isRouteReady,
    proximityRadius,
    updateNavigation,
    showError,
  ]);

  // Format distance
  const formatDistance = (meters: number): string => {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${formatarDecimal(meters / 1000)}km`;
  };

  // Format duration
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}min`;
    }
    return `${minutes} min`;
  };

  // Memoized formatted values to prevent unnecessary recalculations
  const formattedRemainingDistance = useMemo(
    () => formatDistance(remainingDistance),
    [remainingDistance],
  );

  const formattedRemainingTime = useMemo(
    () => formatDuration(remainingTime),
    [remainingTime],
  );

  const formattedDistanceToTurn = useMemo(
    () => formatDistance(distanceToTurn),
    [distanceToTurn],
  );

  const routeShape = useMemo(
    () =>
      routeCoordinates.length >= 2 ? toLineString(routeCoordinates) : null,
    [routeCoordinates],
  );

  const initialCamera = useMemo<InitialViewState>(
    () => ({
      center: toLngLat(origin),
      zoom: 17,
      pitch: 60,
      bearing: 0,
    }),
    [origin],
  );

  // Get maneuver icon - uses extracted MANEUVER_ICONS mapping
  const getManeuverIcon = useCallback((maneuver: string): IconName => {
    // Exact match first
    const exactMatch = MANEUVER_ICONS[maneuver as keyof typeof MANEUVER_ICONS];
    if (exactMatch) {
      return exactMatch;
    }

    // Partial match
    for (const [key, icon] of Object.entries(MANEUVER_ICONS)) {
      if (maneuver?.includes(key)) {
        return icon;
      }
    }

    return 'arrow-up'; // fallback
  }, []);

  // Toggle voice
  const toggleVoice = async () => {
    await triggerHaptic('light');

    const newState = !voiceEnabled;
    setVoiceEnabled(newState);
    TurnByTurnNavigationService.setVoiceEnabled(newState);

    if (newState) {
      Speech.speak('Voz ativada', { language: 'pt-BR', rate: 0.9 });
    }
  };

  // Toggle map view
  const toggleMapView = async () => {
    await triggerHaptic('light');
    setMapView((prev) => (prev === 'north-up' ? 'heading-up' : 'north-up'));
  };

  // Animate camera when user location or heading changes (throttled)
  useEffect(() => {
    if (cameraRef.current && userLocation && !isLoading) {
      const lastLoc = lastAnimatedLocation.current;
      const lastHead = lastAnimatedHeading.current;

      // Calculate deltas
      const locationDelta = lastLoc
        ? calculateHaversineDistance(
            lastLoc.lat,
            lastLoc.lng,
            userLocation.latitude,
            userLocation.longitude,
          )
        : Infinity;

      const headingDelta = Math.abs(heading - lastHead);

      // Only animate if moved > 10m or rotated > 15° (reduces unnecessary animations)
      const shouldAnimate = locationDelta > 10 || headingDelta > 15;

      if (shouldAnimate) {
        cameraRef.current.setStop({
          center: toLngLat(userLocation),
          zoom: 17,
          pitch: mapView === 'heading-up' ? 60 : 0,
          bearing: mapView === 'heading-up' ? heading : 0,
          duration: 500,
        });

        lastAnimatedLocation.current = {
          lat: userLocation.latitude,
          lng: userLocation.longitude,
        };
        lastAnimatedHeading.current = heading;
      }
    }
  }, [userLocation, heading, mapView, isLoading]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Calculando rota...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Map */}
      <MapLibreGL.Map
        testID="map-view"
        style={styles.map}
        mapStyle={OPENFREEMAP_STYLE_URL}
        touchRotate={false}
        compass={false}
        logo={false}
        attribution={false}
      >
        <MapLibreGL.Camera ref={cameraRef} initialViewState={initialCamera} />

        {/* Route polyline */}
        {routeShape && (
          <MapLibreGL.GeoJSONSource id="rota-turnbyturn" data={routeShape}>
            <MapLibreGL.Layer
              id="rota-turnbyturn-line"
              type="line"
              paint={{ 'line-color': theme.colors.primary, 'line-width': 5 }}
            />
          </MapLibreGL.GeoJSONSource>
        )}

        {userLocation && (
          <MapLibreGL.Marker lngLat={toLngLat(userLocation)} anchor="center">
            <View
              style={[
                styles.userDirectionMarker,
                { transform: [{ rotate: `${heading}deg` }] },
              ]}
            >
              <Ionicons
                name="navigate"
                size={20}
                color={theme.colors.primary}
              />
            </View>
          </MapLibreGL.Marker>
        )}

        {/* Waypoint markers */}
        {waypoints?.map((wp, index) => (
          <MapLibreGL.Marker
            key={`waypoint-${index}`}
            lngLat={toLngLat(wp)}
            anchor="center"
          >
            <View style={styles.waypointMarker}>
              <Text style={styles.waypointText}>{index + 1}</Text>
            </View>
          </MapLibreGL.Marker>
        ))}

        {/* Destination marker */}
        <MapLibreGL.Marker lngLat={toLngLat(destination)} anchor="center">
          <View style={styles.destinationMarker}>
            <Ionicons name="flag" size={24} color={theme.colors.error} />
          </View>
        </MapLibreGL.Marker>
      </MapLibreGL.Map>

      <InstructionBar
        currentInstruction={currentInstruction}
        nextInstruction={nextInstruction}
        formattedDistanceToTurn={formattedDistanceToTurn}
        getManeuverIcon={getManeuverIcon}
      />

      <OffRouteAlerts
        offRouteStatus={offRouteStatus}
        distanceFromRoute={distanceFromRoute}
        isRecalculating={isRecalculating}
        onReroute={handleReroute}
      />

      <BottomPanel
        progress={progress}
        formattedRemainingDistance={formattedRemainingDistance}
        formattedRemainingTime={formattedRemainingTime}
        speed={speed}
        voiceEnabled={voiceEnabled}
        mapView={mapView}
        onToggleVoice={toggleVoice}
        onToggleMapView={toggleMapView}
        onExit={onExit}
      />
      {AlertDialog}
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
    backgroundColor: theme.colors.white,
  },
  loadingText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray500,
  },
  map: {
    flex: 1,
  },
  destinationMarker: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing['2'],
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  waypointMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.gray500,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.white,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  waypointText: {
    color: theme.colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  userDirectionMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
}));
