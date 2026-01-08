/* global google */

/**
 * Hook for calculating directions between paradas
 * Works with Google Maps DirectionsService on web
 */

import { useEffect, useState } from 'react';

import { logger } from '@/lib/logger';

interface Parada {
  id: string;
  latitude: number | null;
  longitude: number | null;
  ordem: number;
}

interface UseDirectionsOptions {
  paradas: Parada[];
  isLoaded: boolean;
}

interface UseDirectionsResult {
  directions: google.maps.DirectionsResult | null;
  isCalculating: boolean;
  error: string | null;
}

/**
 * Hook to calculate directions between paradas using Google Maps DirectionsService
 */
export function useDirections({
  paradas,
  isLoaded,
}: UseDirectionsOptions): UseDirectionsResult {
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Need at least 2 paradas with valid coordinates
    const validParadas = paradas.filter((p) => p.latitude != null && p.longitude != null);

    if (!isLoaded || validParadas.length < 2) {
      setDirections(null);
      return;
    }

    setIsCalculating(true);
    setError(null);

    const DirectionsService = new google.maps.DirectionsService();

    const origin = {
      lat: validParadas[0].latitude!,
      lng: validParadas[0].longitude!,
    };

    const destination = {
      lat: validParadas[validParadas.length - 1].latitude!,
      lng: validParadas[validParadas.length - 1].longitude!,
    };

    const waypoints = validParadas.slice(1, -1).map((p) => ({
      location: { lat: p.latitude!, lng: p.longitude! },
      stopover: true,
    }));

    DirectionsService.route(
      {
        origin,
        destination,
        waypoints: waypoints.length > 0 ? waypoints : undefined,
        travelMode: google.maps.TravelMode.DRIVING,
        optimizeWaypoints: false,
      },
      (result, status) => {
        setIsCalculating(false);
        if (status === google.maps.DirectionsStatus.OK && result) {
          setDirections(result);
          setError(null);
        } else {
          logger.error('Error calculating directions:', status);
          setError(`Failed to calculate directions: ${status}`);
          setDirections(null);
        }
      }
    );
  }, [isLoaded, paradas]);

  return {
    directions,
    isCalculating,
    error,
  };
}

/**
 * Extract distance and duration from directions result
 */
export function extractRouteInfo(directions: google.maps.DirectionsResult | null): {
  distanceMeters: number;
  durationSeconds: number;
  distanceText: string;
  durationText: string;
} {
  if (!directions || !directions.routes[0]) {
    return {
      distanceMeters: 0,
      durationSeconds: 0,
      distanceText: '',
      durationText: '',
    };
  }

  const route = directions.routes[0];
  let totalDistance = 0;
  let totalDuration = 0;

  route.legs.forEach((leg) => {
    totalDistance += leg.distance?.value || 0;
    totalDuration += leg.duration?.value || 0;
  });

  const distanceKm = totalDistance / 1000;
  const durationMins = Math.ceil(totalDuration / 60);

  return {
    distanceMeters: totalDistance,
    durationSeconds: totalDuration,
    distanceText: distanceKm >= 1 ? `${distanceKm.toFixed(1)} km` : `${totalDistance} m`,
    durationText: durationMins >= 60
      ? `${Math.floor(durationMins / 60)}h ${durationMins % 60}min`
      : `${durationMins} min`,
  };
}
