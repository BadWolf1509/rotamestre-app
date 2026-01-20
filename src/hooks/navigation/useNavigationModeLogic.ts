/**
 * useNavigationModeLogic
 *
 * Shared logic hook for NavigationMode components (native and web).
 * Extracts common state, memoized values, and helper functions.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { ParadaData } from '@/context/RouteStatusContext';
import { getRoute, decodePolyline, type Coordinate } from '@/lib/osrm';
import LocationTrackingService from '@/services/locationTracking';
import { calculateHaversineDistance } from '@/services/turnByTurnNavigation';
import { useUnistyles } from '@/utils/styles';

import type {
  NavigationPreferences,
  UserLocation,
  UseNavigationModeLogicReturn,
} from './types';

// Average urban speed for ETA estimation (km/h)
const AVERAGE_URBAN_SPEED_KMH = 30;

// Default navigation preferences
const DEFAULT_PREFERENCES: NavigationPreferences = {
  soundAlerts: true,
  vibrationAlerts: true,
  showSpeedometer: true,
  internalNavigation: false,
  autoAdvance: true,
  proximityRadius: 50,
};

interface UseNavigationModeLogicOptions {
  currentStop: ParadaData;
  nextStop?: ParadaData | null;
  paradas: ParadaData[];
  rotaId?: string;
}

/**
 * Hook that provides shared logic for NavigationMode components.
 *
 * Includes:
 * - User location and speed state
 * - Route path from OSRM
 * - Navigation preferences
 * - Derived parada data (realParadas, checkpoints, etc.)
 * - Helper functions (formatDistance, getSpeedColor)
 */
export function useNavigationModeLogic({
  currentStop,
  nextStop,
  paradas,
  rotaId,
}: UseNavigationModeLogicOptions): UseNavigationModeLogicReturn {
  const { theme } = useUnistyles();

  // Core state
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [speed, setSpeed] = useState(0);
  const [distance, setDistance] = useState<number | null>(null);
  const [eta, setEta] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [navigationMode, setNavigationMode] = useState<'map' | 'turn-by-turn'>('map');
  const [isInitializing, setIsInitializing] = useState(true);
  const [preferences, setPreferences] = useState<NavigationPreferences>(DEFAULT_PREFERENCES);

  // Route path from OSRM
  const [routePath, setRoutePath] = useState<Coordinate[]>([]);

  // Track previous user location to avoid unnecessary OSRM calls
  const prevUserLocationRef = useRef<{ lat: number; lon: number } | null>(null);

  // Filter out checkpoints - only show real delivery/pickup stops
  // is_checkpoint === false means checkpoint, true/undefined means real stop
  const realParadas = useMemo(() => {
    return paradas.filter((p) => p.is_checkpoint !== false);
  }, [paradas]);

  // Get checkpoints (start/end points) for special markers
  const checkpoints = useMemo(() => {
    return paradas.filter((p) => p.is_checkpoint === false);
  }, [paradas]);

  // Identify start and end checkpoints
  const startCheckpoint = checkpoints.length > 0 ? checkpoints[0] : null;
  const endCheckpoint = checkpoints.length > 1 ? checkpoints[checkpoints.length - 1] : null;

  // Current stop index in filtered array (1-based for display)
  const currentStopIndex = useMemo(() => {
    const idx = realParadas.findIndex((p) => p.id === currentStop?.id);
    return idx >= 0 ? idx + 1 : 1;
  }, [realParadas, currentStop]);

  // Identify next stop after current (for highlighting)
  const nextStopAfterCurrent = useMemo(() => {
    const currentIdx = realParadas.findIndex((p) => p.id === currentStop?.id);
    if (currentIdx >= 0 && currentIdx < realParadas.length - 1) {
      return realParadas[currentIdx + 1];
    }
    return null;
  }, [realParadas, currentStop]);

  // Pending stops (excluding current and completed)
  const pendingStops = useMemo(() => {
    return realParadas.filter((p) => p.id !== currentStop?.id && p.status === 'pendente');
  }, [realParadas, currentStop]);

  // Remaining waypoints for turn-by-turn navigation
  const remainingWaypoints = useMemo(() => {
    return realParadas
      .filter((p) => p.id !== currentStop?.id && p.status === 'pendente')
      .map((p) => ({ latitude: p.latitude, longitude: p.longitude }));
  }, [realParadas, currentStop]);

  // Check if stop is delivery or pickup
  const isEntrega = currentStop?.tipo === 'entrega';

  // Check if near destination (< 100m)
  const isNearDestination = distance !== null && distance < 100;

  /**
   * Format distance for display
   * @param meters - Distance in meters
   * @returns Formatted string (e.g., "250m" or "1.5km")
   */
  const formatDistance = useCallback((meters: number): string => {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
  }, []);

  /**
   * Get color for speed indicator based on value
   * @param speedKmh - Speed in km/h
   * @returns Color string from theme
   */
  const getSpeedColor = useCallback(
    (speedKmh: number): string => {
      if (speedKmh <= 40) return theme.colors.success;
      if (speedKmh <= 80) return theme.colors.warning;
      return theme.colors.error;
    },
    [theme.colors]
  );

  /**
   * Load navigation preferences from storage
   */
  const loadPreferences = useCallback(async () => {
    try {
      const prefs = await LocationTrackingService.getNavigationPreferences();
      const newPrefs: NavigationPreferences = {
        soundAlerts: prefs.soundAlerts ?? DEFAULT_PREFERENCES.soundAlerts,
        vibrationAlerts: prefs.vibrationAlerts ?? DEFAULT_PREFERENCES.vibrationAlerts,
        showSpeedometer: prefs.showSpeedometer ?? DEFAULT_PREFERENCES.showSpeedometer,
        internalNavigation: prefs.internalNavigation ?? DEFAULT_PREFERENCES.internalNavigation,
        autoAdvance: prefs.autoAdvance ?? DEFAULT_PREFERENCES.autoAdvance,
        proximityRadius: prefs.proximityRadius ?? DEFAULT_PREFERENCES.proximityRadius,
      };
      setPreferences(newPrefs);
      if (newPrefs.internalNavigation) {
        setNavigationMode('turn-by-turn');
      }
    } catch {
      // Use defaults on failure
    }
  }, []);

  /**
   * Start location tracking service
   */
  const startNavigation = useCallback(async () => {
    if (!currentStop || !rotaId) return;

    const tracking = await LocationTrackingService.startTracking(
      rotaId,
      currentStop.id,
      nextStop?.id
    );
    setIsTracking(tracking);
  }, [currentStop, nextStop, rotaId]);

  /**
   * Stop location tracking service
   */
  const stopNavigation = useCallback(async () => {
    await LocationTrackingService.stopTracking();
    setIsTracking(false);
  }, []);

  /**
   * Update location state from GPS coordinates
   * Calculates distance and ETA based on speed
   */
  const updateLocationFromCoords = useCallback(
    (
      coords: { latitude: number; longitude: number; heading?: number | null },
      speedMs: number | null
    ) => {
      const location: UserLocation = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        heading: coords.heading ?? undefined,
      };
      setUserLocation(location);
      setSpeed(Math.round((speedMs || 0) * 3.6)); // m/s to km/h

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
        if (speedMs && speedMs > 0) {
          const timeInSeconds = dist / speedMs;
          const minutes = Math.ceil(timeInSeconds / 60);
          setEta(`${minutes} min`);
        } else {
          // Fallback: use average urban speed
          const timeInHours = (dist / 1000) / AVERAGE_URBAN_SPEED_KMH;
          const minutes = Math.ceil(timeInHours * 60);
          setEta(minutes > 0 ? `${minutes} min` : '< 1 min');
        }
      }
    },
    [currentStop]
  );

  // Fetch OSRM route when user location or destination changes
  useEffect(() => {
    if (!userLocation || !currentStop) {
      setRoutePath([]);
      return;
    }

    // Avoid refetching if location hasn't changed significantly (> 50m)
    const prevLoc = prevUserLocationRef.current;
    if (prevLoc) {
      const movedDistance = calculateHaversineDistance(
        prevLoc.lat,
        prevLoc.lon,
        userLocation.latitude,
        userLocation.longitude
      );
      if (movedDistance < 50) {
        return;
      }
    }

    let cancelled = false;

    const fetchRoute = async () => {
      try {
        const routeData = await getRoute(
          { latitude: userLocation.latitude, longitude: userLocation.longitude },
          { latitude: currentStop.latitude, longitude: currentStop.longitude }
        );

        if (!cancelled && routeData?.polyline) {
          const decoded = decodePolyline(routeData.polyline);
          setRoutePath(decoded);
          prevUserLocationRef.current = {
            lat: userLocation.latitude,
            lon: userLocation.longitude,
          };
        }
      } catch (error) {
        console.warn('[useNavigationModeLogic] Error fetching OSRM route:', error);
      }
    };

    fetchRoute();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- We only want to refetch when coordinates change
  }, [userLocation?.latitude, userLocation?.longitude, currentStop?.latitude, currentStop?.longitude]);

  // Reset route path when current stop changes
  useEffect(() => {
    prevUserLocationRef.current = null;
  }, [currentStop?.id]);

  return {
    // State
    userLocation,
    speed,
    distance,
    eta,
    isTracking,
    showSettings,
    routePath,
    preferences,
    navigationMode,
    isInitializing,

    // State setters
    setUserLocation,
    setSpeed,
    setDistance,
    setEta,
    setIsTracking,
    setShowSettings,
    setRoutePath,
    setNavigationMode,
    setIsInitializing,

    // Derived values
    realParadas,
    checkpoints,
    startCheckpoint,
    endCheckpoint,
    currentStopIndex,
    nextStopAfterCurrent,
    pendingStops,
    remainingWaypoints,
    isEntrega,
    isNearDestination,

    // Functions
    formatDistance,
    getSpeedColor,
    loadPreferences,
    startNavigation,
    stopNavigation,
    updateLocationFromCoords,
  };
}
