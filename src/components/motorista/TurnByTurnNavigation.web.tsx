import { Ionicons } from '@expo/vector-icons';
import * as maplibregl from 'maplibre-gl';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Linking,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import 'maplibre-gl/dist/maplibre-gl.css';

import { formatarDecimal } from '@/lib/formatNumber';
import { logger } from '@/lib/logger';
import { configureMaplibreWorker } from '@/lib/maplibreWorker';
import {
  getOpenFreeMapStyle,
  installOpenFreeMapMissingImageHandler,
} from '@/lib/openFreeMapStyle';
import LocationTrackingService from '@/services/locationTracking';
import TurnByTurnNavigationService, {
  calculateHaversineDistance,
  type NavigationInstruction,
} from '@/services/turnByTurnNavigation';
import type { IconName } from '@/types/icons';
import { boxShadow } from '@/utils/color';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

import { BottomPanel, InstructionBar } from './turn-by-turn';

// Default values
const DEFAULT_PROXIMITY_RADIUS = 30;
const DEFAULT_VOICE_ENABLED = true;

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
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  // User preferences
  const [proximityRadius, setProximityRadius] = useState(
    DEFAULT_PROXIMITY_RADIUS,
  );

  // Navigation state
  const [userLocation, setUserLocation] = useState(origin);
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
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [speed, setSpeed] = useState(0);

  // Geolocation watch ID
  const watchIdRef = useRef<number | null>(null);

  // User marker ref for updates
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);

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
        logger.warn('[TurnByTurn.web] Error loading preferences:', error);
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
      waypoints,
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
    const firstInstruction =
      TurnByTurnNavigationService.getCurrentInstruction();
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
      logger.warn('[TurnByTurn.web] Geolocation not supported');
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
        (position.coords.speed || 0) * 3.6,
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
        destination.longitude,
      );

      if (distToDestination < proximityRadius) {
        handleArrival();
      }
    };

    const handleError = (error: GeolocationPositionError) => {
      logger.warn('[TurnByTurn.web] Geolocation error:', error.message);
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePosition,
      handleError,
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 1000,
      },
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [destination, proximityRadius, handleArrival]);

  // Initialize MapLibre map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current || isLoading) return;

    let cancelled = false;
    let mapInstance: maplibregl.Map | null = null;
    let removeMissingImageHandler: (() => void) | null = null;

    const initializeMap = async () => {
      try {
        const style = await getOpenFreeMapStyle();
        if (cancelled || !mapContainerRef.current) return;

        configureMaplibreWorker();
        mapInstance = new maplibregl.Map({
          container: mapContainerRef.current,
          style,
          center: [userLocation.longitude, userLocation.latitude],
          zoom: 17,
          attributionControl: false,
        });
        removeMissingImageHandler =
          installOpenFreeMapMissingImageHandler(mapInstance);

        mapInstance.on('load', () => {
          setMapLoaded(true);
          mapRef.current = mapInstance;
        });

        mapInstance.on('error', (e) => {
          logger.error('[TurnByTurn.web] Map error:', e);
          setMapError('Erro ao carregar mapa');
        });
      } catch (error) {
        if (cancelled) return;
        logger.error('[TurnByTurn.web] Failed to initialize map:', error);
        setMapError('Erro ao inicializar mapa');
      }
    };

    initializeMap();

    return () => {
      cancelled = true;
      if (removeMissingImageHandler) {
        removeMissingImageHandler();
      }
      // Cleanup markers
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
      if (mapInstance) {
        mapInstance.remove();
      }
      mapRef.current = null;
      setMapLoaded(false);
    };
  }, [isLoading, userLocation.latitude, userLocation.longitude]);

  // Create user marker element
  const createUserMarkerElement = useCallback(() => {
    const el = document.createElement('div');
    el.style.cssText = `
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background-color: ${theme.colors.info};
      border: 3px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    const inner = document.createElement('div');
    inner.style.cssText = `
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: white;
    `;
    el.appendChild(inner);

    return el;
  }, [theme.colors.info]);

  // Create destination marker element
  const createDestinationMarkerElement = useCallback(() => {
    const el = document.createElement('div');
    el.style.cssText = `
      background-color: ${theme.colors.white};
      border-radius: 16px;
      padding: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    const icon = document.createElement('div');
    icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 512 512"><path fill="${theme.colors.error}" d="M80 464V68.14a8 8 0 0 1 4-6.9C91.81 56.66 112.92 48 160 48c64 0 145 48 192 48a199.53 199.53 0 0 0 77.23-15.77a2 2 0 0 1 2.77 1.85v219.36a4 4 0 0 1-2.39 3.65C421.37 308.7 392.33 320 352 320c-48 0-128-32-192-32s-80 16-80 16"/><path fill="${theme.colors.error}" d="M80 464a16 16 0 0 1-16-16V68.14a24 24 0 0 1 12-20.9C91.55 38 112.91 32 160 32c61.31 0 140.63 40 184 40c48.47 0 80.27-16.3 90.14-21.42a16 16 0 0 1 17.71 2.63A15.94 15.94 0 0 1 456 67.57v237.31a23.93 23.93 0 0 1-14.36 21.93C423.45 334.9 384.05 352 352 352c-50.44 0-129.44-32-192-32c-31.81 0-54.07 6.84-64 12.64V448a16 16 0 0 1-16 16"/></svg>`;
    el.appendChild(icon);

    return el;
  }, [theme.colors.white, theme.colors.error]);

  // Create waypoint marker element
  const createWaypointMarkerElement = useCallback(
    (index: number) => {
      const el = document.createElement('div');
      el.style.cssText = `
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background-color: ${theme.colors.gray500};
      border: 2px solid white;
      box-shadow: 0 1px 3px rgba(0,0,0,0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 12px;
      font-weight: 700;
    `;
      el.textContent = String(index + 1);

      return el;
    },
    [theme.colors.gray500],
  );

  // Add markers to map
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    // Clear existing markers (except user marker)
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // Add destination marker
    const destMarker = new maplibregl.Marker({
      element: createDestinationMarkerElement(),
    })
      .setLngLat([destination.longitude, destination.latitude])
      .addTo(mapRef.current);
    markersRef.current.push(destMarker);

    // Add waypoint markers
    waypoints?.forEach((wp, index) => {
      const wpMarker = new maplibregl.Marker({
        element: createWaypointMarkerElement(index),
      })
        .setLngLat([wp.longitude, wp.latitude])
        .addTo(mapRef.current!);
      markersRef.current.push(wpMarker);
    });

    // Add or update user marker
    if (!userMarkerRef.current) {
      userMarkerRef.current = new maplibregl.Marker({
        element: createUserMarkerElement(),
      })
        .setLngLat([userLocation.longitude, userLocation.latitude])
        .addTo(mapRef.current);
    }
  }, [
    mapLoaded,
    destination,
    waypoints,
    createDestinationMarkerElement,
    createWaypointMarkerElement,
    createUserMarkerElement,
    userLocation,
  ]);

  // Update user marker position
  useEffect(() => {
    if (userMarkerRef.current) {
      userMarkerRef.current.setLngLat([
        userLocation.longitude,
        userLocation.latitude,
      ]);
    }

    // Center map on user (smooth pan)
    if (mapRef.current && mapLoaded) {
      mapRef.current.panTo([userLocation.longitude, userLocation.latitude], {
        duration: 300,
      });
    }
  }, [userLocation, mapLoaded]);

  // Add route polyline
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    const map = mapRef.current;
    const sourceId = 'route-source';
    const layerId = 'route-layer';

    // Remove existing layer and source if they exist
    if (map.getLayer(layerId)) {
      map.removeLayer(layerId);
    }
    if (map.getSource(sourceId)) {
      map.removeSource(sourceId);
    }

    if (routeCoordinates.length < 2) return;

    // Add route source
    map.addSource(sourceId, {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: routeCoordinates.map((c) => [c.longitude, c.latitude]),
        },
      },
    });

    // Add route layer
    map.addLayer({
      id: layerId,
      type: 'line',
      source: sourceId,
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': theme.colors.primary,
        'line-width': 5,
        'line-opacity': 0.8,
      },
    });

    // Fit bounds to show entire route
    if (routeCoordinates.length > 0) {
      const bounds = new maplibregl.LngLatBounds();
      routeCoordinates.forEach((coord) => {
        bounds.extend([coord.longitude, coord.latitude]);
      });
      bounds.extend([userLocation.longitude, userLocation.latitude]);

      map.fitBounds(bounds, {
        padding: { top: 150, right: 50, bottom: 200, left: 50 },
        duration: 500,
      });
    }

    return () => {
      if (!(map as unknown as { style?: unknown }).style) return;
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    };
  }, [mapLoaded, routeCoordinates, theme.colors.primary, userLocation]);

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

  // Memoized formatted values
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

  // Get maneuver icon
  const getManeuverIcon = useCallback((maneuver: string): IconName => {
    const iconMap: Record<string, IconName> = {
      'turn-left': 'arrow-back',
      'turn-right': 'arrow-forward',
      'turn-sharp-left': 'return-up-back',
      'turn-sharp-right': 'return-up-forward',
      straight: 'arrow-up',
      merge: 'git-merge',
      roundabout: 'sync',
      uturn: 'refresh',
    };

    for (const [key, icon] of Object.entries(iconMap)) {
      if (maneuver?.includes(key)) {
        return icon;
      }
    }

    return 'arrow-up';
  }, []);

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

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Calculando rota...</Text>
      </View>
    );
  }

  // Error state
  if (mapError) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="alert-circle" size={48} color={theme.colors.error} />
        <Text style={styles.loadingText}>{mapError}</Text>
        <TouchableOpacity
          style={styles.fallbackButton}
          onPress={openInGoogleMaps}
        >
          <Text style={styles.fallbackButtonText}>Abrir no Google Maps</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Map */}
      <div
        ref={mapContainerRef}
        style={{
          flex: 1,
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }}
      />

      <InstructionBar
        currentInstruction={currentInstruction}
        nextInstruction={nextInstruction}
        formattedDistanceToTurn={formattedDistanceToTurn}
        getManeuverIcon={getManeuverIcon}
      />

      <BottomPanel
        progress={progress}
        formattedRemainingDistance={formattedRemainingDistance}
        formattedRemainingTime={formattedRemainingTime}
        speed={speed}
        voiceEnabled={voiceEnabled}
        onToggleVoice={toggleVoice}
        onOpenInMaps={openInGoogleMaps}
        onExit={onExit}
      />
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
