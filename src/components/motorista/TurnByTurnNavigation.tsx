import { Ionicons } from '@expo/vector-icons';
import { useKeepAwake } from 'expo-keep-awake';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

import TurnByTurnNavigationService from '@/services/turnByTurnNavigation';
import { withOpacity } from '@/utils/color';
import { defaultTheme, useUnistyles } from '@/utils/styles';

const colors = defaultTheme.colors;

// Calculate distance between two coordinates (Haversine formula)
// Moved outside component to avoid useEffect dependency issues
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const EARTH_RADIUS = 6371000;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS * c;
};

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
  useKeepAwake(); // Keep screen awake during navigation
  const { theme } = useUnistyles();
  const mapRef = useRef<MapView>(null);

  // State
  const [userLocation, setUserLocation] = useState(origin);
  const [speed, setSpeed] = useState(0);
  const [heading, setHeading] = useState(0);
  const [currentInstruction, setCurrentInstruction] = useState<any>(null);
  const [nextInstruction, setNextInstruction] = useState<any>(null);
  const [distanceToTurn, setDistanceToTurn] = useState(0);
  const [routeCoordinates, setRouteCoordinates] = useState<Array<{ latitude: number; longitude: number }>>([]);
  const [remainingDistance, setRemainingDistance] = useState(0);
  const [remainingTime, setRemainingTime] = useState(0);
  const [progress, setProgress] = useState(0);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [mapView, setMapView] = useState<'north-up' | 'heading-up'>('heading-up');
  const voiceEnabledRef = useRef(voiceEnabled);

  useEffect(() => {
    voiceEnabledRef.current = voiceEnabled;
  }, [voiceEnabled]);

  // Handle arrival at destination - defined before useEffect that uses it
  const handleArrival = useCallback(() => {
    Speech.speak('Voce chegou ao seu destino', {
      language: 'pt-BR',
      pitch: 1.0,
      rate: 0.9,
    });

    setTimeout(() => {
      onArrive();
    }, 2000);
  }, [onArrive]);

  // Update navigation based on position - defined before useEffect that uses it
  const updateNavigation = useCallback(
    async (
      currentLocation: { latitude: number; longitude: number },
      speedMs: number
    ) => {
      const update = await TurnByTurnNavigationService.updateNavigation(
        currentLocation,
        speedMs * 3.6 // Convert to km/h
      );

      setCurrentInstruction(update.currentInstruction);
      setNextInstruction(update.nextInstruction);
      setDistanceToTurn(update.distanceToNextTurn);
      setProgress(TurnByTurnNavigationService.getProgress());
      setRemainingDistance(TurnByTurnNavigationService.getRemainingDistance());
      setRemainingTime(TurnByTurnNavigationService.getRemainingTime());

      // Speak instruction if needed
      if (
        update.shouldSpeak &&
        update.currentInstruction?.voiceInstruction &&
        voiceEnabledRef.current
      ) {
        TurnByTurnNavigationService.speakInstruction(update.currentInstruction.voiceInstruction);
      }
    },
    [voiceEnabledRef]
  );

  // Initialize navigation with directions - defined before useEffect that uses it
  const initializeNavigation = useCallback(async () => {
    setIsLoading(true);

    const route = await TurnByTurnNavigationService.getDirections(
      origin,
      destination,
      waypoints
    );

    if (!route) {
      Alert.alert('Erro', 'Não foi possível calcular a rota');
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
    const firstInstruction = TurnByTurnNavigationService.getCurrentInstruction();
    setCurrentInstruction(firstInstruction);

    const secondInstruction = TurnByTurnNavigationService.getNextInstruction();
    setNextInstruction(secondInstruction);

    setIsLoading(false);

    // Speak initial instruction
    if (firstInstruction?.voiceInstruction && voiceEnabledRef.current) {
      setTimeout(() => {
        Speech.speak(`Iniciando navegação. ${firstInstruction.voiceInstruction}`, {
          language: 'pt-BR',
          pitch: 1.0,
          rate: 0.9,
        });
      }, 1000);
    }
  }, [destination, onExit, origin, voiceEnabledRef, waypoints]);

  // Initialize navigation
  useEffect(() => {
    initializeNavigation();
    return () => {
      TurnByTurnNavigationService.reset();
      Speech.stop();
    };
  }, [initializeNavigation]);

  // Watch position updates
  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Erro', 'Permissão de localização negada');
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

          setUserLocation(coords);
          setSpeed(Math.round((location.coords.speed || 0) * 3.6)); // m/s to km/h
          setHeading(location.coords.heading || 0);

          // Update navigation
          await updateNavigation(coords, location.coords.speed || 0);

          // Check if arrived at destination
          const distToDestination = calculateDistance(
            coords.latitude,
            coords.longitude,
            destination.latitude,
            destination.longitude
          );

          if (distToDestination < 30) {
            handleArrival();
          }
        }
      );
    })();

    return () => {
      try {
        subscription?.remove();
      } catch (error) {
        // expo-location remove() não funciona corretamente na web
        console.warn('[TurnByTurn] Error removing subscription:', error);
      }
    };
  }, [destination, handleArrival, updateNavigation]);

  // Format distance
  const formatDistance = (meters: number): string => {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
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

  // Get maneuver icon
  const getManeuverIcon = (maneuver: string): string => {
    const iconMap: { [key: string]: string } = {
      'turn-left': 'arrow-back',
      'turn-right': 'arrow-forward',
      'turn-sharp-left': 'return-up-back',
      'turn-sharp-right': 'return-up-forward',
      'straight': 'arrow-up',
      'merge': 'git-merge',
      'roundabout': 'sync',
      'uturn': 'refresh',
    };

    for (const [key, icon] of Object.entries(iconMap)) {
      if (maneuver?.includes(key)) {
        return icon;
      }
    }

    return 'arrow-up';
  };

  // Toggle voice
  const toggleVoice = () => {
    const newState = !voiceEnabled;
    setVoiceEnabled(newState);
    TurnByTurnNavigationService.setVoiceEnabled(newState);

    if (newState) {
      Speech.speak('Voz ativada', { language: 'pt-BR', rate: 0.9 });
    }
  };

  // Toggle map view
  const toggleMapView = () => {
    setMapView(prev => prev === 'north-up' ? 'heading-up' : 'north-up');
  };

  // Get camera settings for map
  const getCameraSettings = () => {
    const baseCamera = {
      center: userLocation,
      zoom: 17,
      pitch: mapView === 'heading-up' ? 60 : 0,
      heading: mapView === 'heading-up' ? heading : 0,
    };

    return baseCamera;
  };

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
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        camera={getCameraSettings()}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        rotateEnabled={false}
        toolbarEnabled={false}
      >
        {/* Route polyline */}
        {routeCoordinates.length > 0 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor={theme.colors.primary}
            strokeWidth={5}
          />
        )}

        {/* Destination marker */}
        <Marker
          coordinate={destination}
          title={destination.address}
        >
          <View style={styles.destinationMarker}>
            <Ionicons name="flag" size={24} color={colors.error} />
          </View>
        </Marker>
      </MapView>

      {/* Top instruction bar */}
      <View style={styles.instructionBar}>
        <View style={styles.instructionContent}>
          <View style={styles.maneuverIcon}>
            <Ionicons
              name={getManeuverIcon(currentInstruction?.maneuver) as any}
              size={40}
              color={colors.white}
            />
          </View>

          <View style={styles.instructionText}>
            <Text style={styles.distanceText}>
              {formatDistance(distanceToTurn)}
            </Text>
            <Text style={styles.instructionMainText} numberOfLines={2}>
              {currentInstruction?.instruction || 'Calculando...'}
            </Text>
          </View>
        </View>

        {nextInstruction && (
          <View style={styles.nextInstructionBar}>
            <Ionicons
              name={getManeuverIcon(nextInstruction.maneuver) as any}
              size={16}
              color={colors.gray400}
            />
            <Text style={styles.nextInstructionText}>
              Depois: {nextInstruction.instruction}
            </Text>
          </View>
        )}
      </View>

      {/* Bottom info panel */}
      <View style={styles.bottomPanel}>
        {/* Progress bar */}
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{formatDistance(remainingDistance)}</Text>
            <Text style={styles.statLabel}>restante</Text>
          </View>

          <View style={styles.statSeparator} />

          <View style={styles.stat}>
            <Text style={styles.statValue}>{formatDuration(remainingTime)}</Text>
            <Text style={styles.statLabel}>chegada</Text>
          </View>

          <View style={styles.statSeparator} />

          <View style={styles.stat}>
            <Text style={styles.statValue}>{speed}</Text>
            <Text style={styles.statLabel}>km/h</Text>
          </View>
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          <TouchableOpacity
            style={[styles.controlButton, !voiceEnabled && styles.controlButtonDisabled]}
            onPress={toggleVoice}
          >
            <Ionicons
              name={voiceEnabled ? 'volume-high' : 'volume-mute'}
              size={24}
              color={voiceEnabled ? theme.colors.primary : colors.gray400}
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.exitButton} onPress={onExit}>
            <Ionicons name="close" size={24} color={colors.white} />
            <Text style={styles.exitButtonText}>Sair</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.controlButton} onPress={toggleMapView}>
            <Ionicons
              name={mapView === 'heading-up' ? 'compass' : 'navigate'}
              size={24}
              color={theme.colors.primary}
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  loadingText: {
    fontSize: 16,
    color: colors.gray500,
  },
  map: {
    flex: 1,
  },
  instructionBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: defaultTheme.colors.primary,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 10,
  },
  instructionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  maneuverIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: withOpacity(colors.white, 0.2),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  instructionText: {
    flex: 1,
  },
  distanceText: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.white,
    marginBottom: 4,
  },
  instructionMainText: {
    fontSize: 16,
    color: colors.white,
    opacity: 0.95,
  },
  nextInstructionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: withOpacity(colors.black, 0.1),
    borderTopWidth: 1,
    borderTopColor: withOpacity(colors.white, 0.1),
  },
  nextInstructionText: {
    fontSize: 12,
    color: colors.gray200,
    marginLeft: 8,
  },
  bottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.gray200,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.success,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.gray900,
  },
  statLabel: {
    fontSize: 11,
    color: colors.gray500,
    marginTop: 2,
  },
  statSeparator: {
    width: 1,
    height: 30,
    backgroundColor: colors.gray200,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
  },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlButtonDisabled: {
    opacity: 0.5,
  },
  exitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.error,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
  },
  exitButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  destinationMarker: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 8,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
});


