import * as Speech from 'expo-speech';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import {
  getOffRouteStatus,
  type Coordinate,
  type OffRouteStatus,
} from '@/lib/routeGeometry';

interface UseOffRouteDetectionOptions {
  warningThreshold?: number;  // meters, default 100
  criticalThreshold?: number; // meters, default 200
  checkInterval?: number;     // ms, default 3000
  enabled?: boolean;          // default true
}

interface UseOffRouteDetectionResult {
  status: OffRouteStatus;
  distanceFromRoute: number;
  nearestPointOnRoute: Coordinate | null;
  isRecalculating: boolean;
}

/**
 * Hook for detecting when the user goes off the planned route
 *
 * Behavior (hybrid mode):
 * - At 100m off-route: Shows warning, speaks "Você saiu da rota"
 * - At 200m off-route: Auto-triggers reroute, speaks "Recalculando rota"
 *
 * @param userLocation - Current user location
 * @param routePolyline - Array of coordinates representing the route
 * @param onReroute - Callback to trigger route recalculation
 * @param options - Configuration options
 */
export function useOffRouteDetection(
  userLocation: Coordinate | null,
  routePolyline: Coordinate[],
  onReroute: () => Promise<void>,
  options: UseOffRouteDetectionOptions = {}
): UseOffRouteDetectionResult {
  const {
    warningThreshold = 100,
    criticalThreshold = 200,
    checkInterval = 3000,
    enabled = true,
  } = options;

  const [status, setStatus] = useState<OffRouteStatus>('on-route');
  const [distanceFromRoute, setDistanceFromRoute] = useState(0);
  const [nearestPointOnRoute, setNearestPointOnRoute] = useState<Coordinate | null>(null);
  const [isRecalculating, setIsRecalculating] = useState(false);

  // Track previous status for voice announcements
  const prevStatusRef = useRef<OffRouteStatus>('on-route');

  // Track if we've already triggered reroute for this off-route event
  const hasTriggeredRerouteRef = useRef(false);

  // Speak voice instruction (mobile only)
  const speak = useCallback((text: string) => {
    if (Platform.OS === 'web') return;

    Speech.speak(text, {
      language: 'pt-BR',
      pitch: 1.0,
      rate: 0.9,
    });
  }, []);

  // Handle rerouting
  const handleReroute = useCallback(async () => {
    if (isRecalculating || hasTriggeredRerouteRef.current) return;

    hasTriggeredRerouteRef.current = true;
    setIsRecalculating(true);
    speak('Recalculando rota');

    try {
      await onReroute();
      // Reset after successful reroute
      setStatus('on-route');
      setDistanceFromRoute(0);
    } catch (error) {
      console.error('[useOffRouteDetection] Reroute failed:', error);
    } finally {
      setIsRecalculating(false);
      // Reset trigger flag after some delay to allow for re-detection
      setTimeout(() => {
        hasTriggeredRerouteRef.current = false;
      }, 10000); // 10 second cooldown
    }
  }, [isRecalculating, onReroute, speak]);

  // Check off-route status periodically
  useEffect(() => {
    if (!enabled || !userLocation || routePolyline.length === 0) {
      return;
    }

    const checkOffRoute = () => {
      const result = getOffRouteStatus(
        userLocation,
        routePolyline,
        warningThreshold,
        criticalThreshold
      );

      const newStatus = result.status;
      const prevStatus = prevStatusRef.current;

      setStatus(newStatus);
      setDistanceFromRoute(result.distance);
      setNearestPointOnRoute(result.nearestPoint);

      // Voice announcements on status change
      if (newStatus !== prevStatus) {
        if (newStatus === 'warning' && prevStatus === 'on-route') {
          speak('Você saiu da rota');
        }

        if (newStatus === 'critical' && prevStatus !== 'critical') {
          // Auto-trigger reroute at critical distance
          handleReroute();
        }

        if (newStatus === 'on-route' && prevStatus !== 'on-route') {
          // Back on route
          hasTriggeredRerouteRef.current = false;
        }

        prevStatusRef.current = newStatus;
      }
    };

    // Initial check
    checkOffRoute();

    // Periodic checks
    const intervalId = setInterval(checkOffRoute, checkInterval);

    return () => {
      clearInterval(intervalId);
    };
  }, [
    enabled,
    userLocation,
    routePolyline,
    warningThreshold,
    criticalThreshold,
    checkInterval,
    speak,
    handleReroute,
  ]);

  // Reset when route changes
  useEffect(() => {
    setStatus('on-route');
    setDistanceFromRoute(0);
    setNearestPointOnRoute(null);
    hasTriggeredRerouteRef.current = false;
    prevStatusRef.current = 'on-route';
  }, [routePolyline]);

  return {
    status,
    distanceFromRoute,
    nearestPointOnRoute,
    isRecalculating,
  };
}
