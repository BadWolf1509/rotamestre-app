/**
 * usePiPRouteInfo
 *
 * Hook that calculates route information (distance, ETA) for PiP map
 */

import { useEffect, useMemo, useState } from 'react';

import { decodePolyline, getRoute, type Coordinate } from '@/lib/osrm';

import { AVERAGE_URBAN_SPEED_KMH, NEAR_DESTINATION_THRESHOLD_KM } from './constants';

import type { RouteInfo } from './types';

interface Location {
  latitude: number;
  longitude: number;
}

interface UsePiPRouteInfoOptions {
  visible: boolean;
  userLocation: Location | null;
  destination: Location | null;
}

interface UsePiPRouteInfoReturn {
  /** Route information (distance, ETA, formatted text) */
  routeInfo: RouteInfo | null;
  /** Whether user is near the destination (< 100m) */
  isNearDestination: boolean;
  /** Route path coordinates from OSRM */
  routePath: Coordinate[];
  /** Whether route is currently being loaded */
  isLoadingRoute: boolean;
}

/**
 * Calculate distance in km between two points using Haversine formula
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Hook that calculates route information and fetches OSRM route
 */
export function usePiPRouteInfo({
  visible,
  userLocation,
  destination,
}: UsePiPRouteInfoOptions): UsePiPRouteInfoReturn {
  const [routePath, setRoutePath] = useState<Coordinate[]>([]);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);

  // Calculate distance and estimated time to destination
  const routeInfo = useMemo((): RouteInfo | null => {
    if (!userLocation || !destination) return null;

    const distanceKm = calculateDistanceKm(
      userLocation.latitude,
      userLocation.longitude,
      destination.latitude,
      destination.longitude
    );

    // Estimate time based on average urban speed
    const estimatedMinutes = Math.ceil((distanceKm / AVERAGE_URBAN_SPEED_KMH) * 60);

    return {
      distanceKm,
      estimatedMinutes,
      // Format for display
      distanceText:
        distanceKm < 1
          ? `${Math.round(distanceKm * 1000)} m`
          : `${distanceKm.toFixed(1)} km`,
      timeText:
        estimatedMinutes < 60
          ? `${estimatedMinutes} min`
          : `${Math.floor(estimatedMinutes / 60)}h${estimatedMinutes % 60}`,
    };
  }, [userLocation, destination]);

  // Check if near destination (< 100m)
  const isNearDestination = routeInfo !== null && routeInfo.distanceKm < NEAR_DESTINATION_THRESHOLD_KM;

  // Fetch OSRM route when visible and locations change
  useEffect(() => {
    if (!visible || !userLocation || !destination) {
      setRoutePath([]);
      return;
    }

    let cancelled = false;

    const fetchRoute = async () => {
      setIsLoadingRoute(true);
      try {
        const result = await getRoute(
          { latitude: userLocation.latitude, longitude: userLocation.longitude },
          { latitude: destination.latitude, longitude: destination.longitude }
        );

        if (cancelled) return;

        if (result?.polyline) {
          const decoded = decodePolyline(result.polyline);
          setRoutePath(decoded);
        } else {
          // Fallback to straight line if OSRM fails
          setRoutePath([
            { latitude: userLocation.latitude, longitude: userLocation.longitude },
            { latitude: destination.latitude, longitude: destination.longitude },
          ]);
        }
      } catch (error) {
        console.warn('PiP: Error fetching OSRM route:', error);
        if (!cancelled) {
          // Fallback to straight line
          setRoutePath([
            { latitude: userLocation.latitude, longitude: userLocation.longitude },
            { latitude: destination.latitude, longitude: destination.longitude },
          ]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingRoute(false);
        }
      }
    };

    fetchRoute();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Use specific coordinates to avoid unnecessary re-fetch
  }, [visible, userLocation?.latitude, userLocation?.longitude, destination?.latitude, destination?.longitude]);

  return {
    routeInfo,
    isNearDestination,
    routePath,
    isLoadingRoute,
  };
}
