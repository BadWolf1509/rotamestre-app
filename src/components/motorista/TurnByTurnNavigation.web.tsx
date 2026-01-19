/* global google */

import { Ionicons } from '@expo/vector-icons';
import { GoogleMap, useJsApiLoader, Polyline, OverlayView } from '@react-google-maps/api';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import LocationTrackingService from '@/services/locationTracking';
import TurnByTurnNavigationService, {
  calculateHaversineDistance,
  type NavigationInstruction,
} from '@/services/turnByTurnNavigation';
import type { IconName } from '@/types/icons';
import { boxShadow, withOpacity } from '@/utils/color';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

// Default values
const DEFAULT_PROXIMITY_RADIUS = 30;
const DEFAULT_VOICE_ENABLED = true;

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
const mapLibraries: ('marker' | 'places')[] = ['marker', 'places'];

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
  const mapRef = useRef<google.maps.Map | null>(null);

  // Load Google Maps
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: mapLibraries,
    version: 'beta',
  });

  // User preferences
  const [proximityRadius, setProximityRadius] = useState(DEFAULT_PROXIMITY_RADIUS);

  // Navigation state
  const [userLocation, setUserLocation] = useState(origin);
  const [currentInstruction, setCurrentInstruction] = useState<NavigationInstruction | null>(null);
  const [nextInstruction, setNextInstruction] = useState<NavigationInstruction | null>(null);
  const [distanceToTurn, setDistanceToTurn] = useState(0);
  const [routeCoordinates, setRouteCoordinates] = useState<Array<{ latitude: number; longitude: number }>>([]);
  const [remainingDistance, setRemainingDistance] = useState(0);
  const [remainingTime, setRemainingTime] = useState(0);
  const [progress, setProgress] = useState(0);
  const [voiceEnabled, setVoiceEnabled] = useState(DEFAULT_VOICE_ENABLED);
  const [isLoading, setIsLoading] = useState(true);
  const [speed, setSpeed] = useState(0);

  // Geolocation watch ID
  const watchIdRef = useRef<number | null>(null);

  // Load user preferences
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const prefs = await LocationTrackingService.getNavigationPreferences();
        if (prefs.proximityRadius !== undefined) {
          setProximityRadius(prefs.proximityRadius);
        }
        if (prefs.voiceNavigation !== undefined) {
          setVoiceEnabled(prefs.voiceNavigation);
        }
      } catch (error) {
        console.warn('[TurnByTurn.web] Error loading preferences:', error);
      }
    };
    loadPreferences();
  }, []);

  // Initialize navigation
  const initializeNavigation = useCallback(async () => {
    setIsLoading(true);

    const route = await TurnByTurnNavigationService.getDirections(
      origin,
      destination,
      waypoints
    );

    if (!route) {
      // Show error and exit
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
  }, [destination, onExit, origin, waypoints]);

  // Initialize on mount
  useEffect(() => {
    initializeNavigation();
    return () => {
      TurnByTurnNavigationService.reset();
    };
  }, [initializeNavigation]);

  // Handle arrival
  const handleArrival = useCallback(() => {
    setTimeout(() => {
      onArrive();
    }, 2000);
  }, [onArrive]);

  // Watch user position with browser Geolocation API
  useEffect(() => {
    if (!navigator.geolocation) {
      console.warn('[TurnByTurn.web] Geolocation not supported');
      return;
    }

    const handlePosition = async (position: GeolocationPosition) => {
      const coords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };

      setUserLocation(coords);
      setSpeed(Math.round((position.coords.speed || 0) * 3.6)); // m/s to km/h

      // Update navigation
      const update = await TurnByTurnNavigationService.updateNavigation(
        coords,
        (position.coords.speed || 0) * 3.6
      );

      setCurrentInstruction(update.currentInstruction);
      setNextInstruction(update.nextInstruction);
      setDistanceToTurn(update.distanceToNextTurn);
      setProgress(TurnByTurnNavigationService.getProgress());
      setRemainingDistance(TurnByTurnNavigationService.getRemainingDistance());
      setRemainingTime(TurnByTurnNavigationService.getRemainingTime());

      // Check if arrived
      const distToDestination = calculateHaversineDistance(
        coords.latitude,
        coords.longitude,
        destination.latitude,
        destination.longitude
      );

      if (distToDestination < proximityRadius) {
        handleArrival();
      }
    };

    const handleError = (error: GeolocationPositionError) => {
      console.warn('[TurnByTurn.web] Geolocation error:', error.message);
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePosition,
      handleError,
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 1000,
      }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [destination, proximityRadius, handleArrival]);

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
  const getManeuverIcon = (maneuver: string): IconName => {
    const iconMap: Record<string, IconName> = {
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

  // Toggle voice (visual only on web, no actual speech)
  const toggleVoice = () => {
    const newState = !voiceEnabled;
    setVoiceEnabled(newState);
    TurnByTurnNavigationService.setVoiceEnabled(newState);
  };

  // Open in Google Maps
  const openInGoogleMaps = () => {
    const url = `https://www.google.com/maps/dir/?api=1&origin=${userLocation.latitude},${userLocation.longitude}&destination=${destination.latitude},${destination.longitude}&travelmode=driving`;
    Linking.openURL(url);
  };

  // Polyline path for Google Maps
  const polylinePath = useMemo(() => {
    return routeCoordinates.map(coord => ({
      lat: coord.latitude,
      lng: coord.longitude,
    }));
  }, [routeCoordinates]);

  // Map center
  const mapCenter = useMemo(() => ({
    lat: userLocation.latitude,
    lng: userLocation.longitude,
  }), [userLocation]);

  // Handle map load
  const handleMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  // Fit bounds when route loads
  useEffect(() => {
    if (!mapRef.current || routeCoordinates.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    routeCoordinates.forEach(coord => {
      bounds.extend({ lat: coord.latitude, lng: coord.longitude });
    });
    bounds.extend({ lat: userLocation.latitude, lng: userLocation.longitude });

    mapRef.current.fitBounds(bounds, { top: 150, right: 50, bottom: 200, left: 50 });
  }, [routeCoordinates, userLocation]);

  // Loading state
  if (!isLoaded || isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Calculando rota...</Text>
      </View>
    );
  }

  // Error state
  if (loadError) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="alert-circle" size={48} color={theme.colors.error} />
        <Text style={styles.loadingText}>Erro ao carregar mapa</Text>
        <TouchableOpacity style={styles.fallbackButton} onPress={openInGoogleMaps}>
          <Text style={styles.fallbackButtonText}>Abrir no Google Maps</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Map */}
      <GoogleMap
        mapContainerStyle={{ flex: 1 }}
        center={mapCenter}
        zoom={17}
        onLoad={handleMapLoad}
        options={{
          disableDefaultUI: true,
          zoomControl: false,
          scrollwheel: true,
          draggable: true,
          clickableIcons: false,
          gestureHandling: 'greedy',
        }}
      >
        {/* Route polyline */}
        {polylinePath.length > 0 && (
          <Polyline
            path={polylinePath}
            options={{
              strokeColor: theme.colors.primary,
              strokeWeight: 5,
              strokeOpacity: 0.8,
            }}
          />
        )}

        {/* User location marker */}
        <OverlayView
          position={mapCenter}
          mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
        >
          <View style={[styles.userMarker, { backgroundColor: theme.colors.info }]}>
            <View style={styles.userMarkerInner} />
          </View>
        </OverlayView>

        {/* Destination marker */}
        <OverlayView
          position={{ lat: destination.latitude, lng: destination.longitude }}
          mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
        >
          <View style={[styles.destinationMarker, { backgroundColor: theme.colors.white }]}>
            <Ionicons name="flag" size={24} color={theme.colors.error} />
          </View>
        </OverlayView>

        {/* Waypoint markers */}
        {waypoints?.map((wp, index) => (
          <OverlayView
            key={`waypoint-${index}`}
            position={{ lat: wp.latitude, lng: wp.longitude }}
            mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
          >
            <View style={[styles.waypointMarker, { backgroundColor: theme.colors.gray500 }]}>
              <Text style={styles.waypointText}>{index + 1}</Text>
            </View>
          </OverlayView>
        ))}
      </GoogleMap>

      {/* Top instruction bar */}
      <View style={[styles.instructionBar, { backgroundColor: theme.colors.primary }]}>
        <View style={styles.instructionContent}>
          <View style={[styles.maneuverIcon, { backgroundColor: withOpacity(theme.colors.white, 0.2) }]}>
            <Ionicons
              name={getManeuverIcon(currentInstruction?.maneuver || '')}
              size={40}
              color={theme.colors.white}
            />
          </View>

          <View style={styles.instructionText}>
            <Text style={[styles.distanceText, { color: theme.colors.white }]}>
              {formatDistance(distanceToTurn)}
            </Text>
            <Text style={[styles.instructionMainText, { color: theme.colors.white }]} numberOfLines={2}>
              {currentInstruction?.instruction || 'Calculando...'}
            </Text>
          </View>
        </View>

        {nextInstruction && (
          <View style={[styles.nextInstructionBar, { borderTopColor: withOpacity(theme.colors.white, 0.1) }]}>
            <Ionicons
              name={getManeuverIcon(nextInstruction.maneuver)}
              size={16}
              color={theme.colors.gray400}
            />
            <Text style={[styles.nextInstructionText, { color: theme.colors.gray200 }]}>
              Depois: {nextInstruction.instruction}
            </Text>
          </View>
        )}
      </View>

      {/* Bottom info panel */}
      <View style={[styles.bottomPanel, { backgroundColor: theme.colors.white }]}>
        {/* Progress bar */}
        <View style={[styles.progressBar, { backgroundColor: theme.colors.gray200 }]}>
          <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: theme.colors.success }]} />
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: theme.colors.gray900 }]}>{formatDistance(remainingDistance)}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.gray500 }]}>restante</Text>
          </View>

          <View style={[styles.statSeparator, { backgroundColor: theme.colors.gray200 }]} />

          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: theme.colors.gray900 }]}>{formatDuration(remainingTime)}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.gray500 }]}>chegada</Text>
          </View>

          <View style={[styles.statSeparator, { backgroundColor: theme.colors.gray200 }]} />

          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: theme.colors.gray900 }]}>{speed}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.gray500 }]}>km/h</Text>
          </View>
        </View>

        {/* Controls */}
        <View style={[styles.controls, { borderTopColor: theme.colors.gray200 }]}>
          <TouchableOpacity
            style={[styles.controlButton, { backgroundColor: theme.colors.gray100 }, !voiceEnabled && styles.controlButtonDisabled]}
            onPress={toggleVoice}
          >
            <Ionicons
              name={voiceEnabled ? 'volume-high' : 'volume-mute'}
              size={24}
              color={voiceEnabled ? theme.colors.primary : theme.colors.gray400}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.openMapsButton, { backgroundColor: theme.colors.info }]}
            onPress={openInGoogleMaps}
          >
            <Ionicons name="navigate" size={20} color={theme.colors.white} />
            <Text style={[styles.openMapsButtonText, { color: theme.colors.white }]}>Google Maps</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.exitButton, { backgroundColor: theme.colors.error }]} onPress={onExit}>
            <Ionicons name="close" size={24} color={theme.colors.white} />
            <Text style={[styles.exitButtonText, { color: theme.colors.white }]}>Sair</Text>
          </TouchableOpacity>
        </View>
      </View>
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
    gap: theme.spacing['4'],
  },
  loadingText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray500,
  },
  fallbackButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing['6'],
    paddingVertical: theme.spacing['3'],
    borderRadius: theme.borderRadius.lg,
    marginTop: theme.spacing['4'],
  },
  fallbackButtonText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.base,
    fontWeight: '600',
  },
  instructionBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 20,
    boxShadow: boxShadow(0, 2, 8, 0, theme.colors.black, 0.2),
    zIndex: 10,
  },
  instructionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing['4'],
    paddingVertical: theme.spacing['4'],
  },
  maneuverIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing['4'],
  },
  instructionText: {
    flex: 1,
  },
  distanceText: {
    fontSize: theme.typography.fontSize['2xl'],
    fontWeight: '700',
    marginBottom: theme.spacing['1'],
  },
  instructionMainText: {
    fontSize: theme.typography.fontSize.base,
    opacity: 0.95,
  },
  nextInstructionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing['4'],
    paddingVertical: theme.spacing['2'],
    backgroundColor: withOpacity(theme.colors.black, 0.1),
    borderTopWidth: 1,
  },
  nextInstructionText: {
    fontSize: theme.typography.fontSize.xs,
    marginLeft: theme.spacing['2'],
  },
  bottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    paddingBottom: 20,
    boxShadow: boxShadow(0, -2, 10, 0, theme.colors.black, 0.1),
    zIndex: 10,
  },
  progressBar: {
    height: 4,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: theme.spacing['4'],
    paddingHorizontal: theme.spacing['4'],
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: theme.typography.fontSize.xs,
    marginTop: theme.spacing['0.5'],
  },
  statSeparator: {
    width: 1,
    height: 30,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing['4'],
    paddingTop: theme.spacing['2'],
    borderTopWidth: 1,
    gap: theme.spacing['3'],
  },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlButtonDisabled: {
    opacity: 0.5,
  },
  openMapsButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing['3'],
    borderRadius: theme.borderRadius['3xl'],
    gap: theme.spacing['2'],
  },
  openMapsButtonText: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: '600',
  },
  exitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing['4'],
    paddingVertical: theme.spacing['3'],
    borderRadius: theme.borderRadius['3xl'],
    gap: theme.spacing['2'],
  },
  exitButtonText: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: '600',
  },
  userMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'white',
    boxShadow: boxShadow(0, 2, 4, 0, '#000', 0.3),
  },
  userMarkerInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'white',
  },
  destinationMarker: {
    borderRadius: 16,
    padding: 8,
    boxShadow: boxShadow(0, 2, 4, 0, '#000', 0.2),
  },
  waypointMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
    boxShadow: boxShadow(0, 1, 3, 0, '#000', 0.2),
  },
  waypointText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
}));
