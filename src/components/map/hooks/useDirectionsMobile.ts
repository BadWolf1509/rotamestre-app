/**
 * Hook for fetching directions on React Native (mobile)
 * Uses Google Directions API via fetch
 */

import { useCallback, useEffect, useState } from 'react';

import { logger } from '@/lib/logger';
import { decodePolyline } from '@/lib/polyline';

interface Parada {
  id: string;
  latitude: number;
  longitude: number;
  ordem: number;
}

interface Coordinate {
  latitude: number;
  longitude: number;
}

interface DirectionsResult {
  coordinates: Coordinate[];
  distanceMeters: number;
  durationSeconds: number;
  distanceText: string;
  durationText: string;
}

interface UseDirectionsMobileOptions {
  paradas: Parada[];
}

interface UseDirectionsMobileResult {
  directions: DirectionsResult | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

/**
 * Hook to fetch directions from Google Directions API (for React Native)
 */
export function useDirectionsMobile({
  paradas,
}: UseDirectionsMobileOptions): UseDirectionsMobileResult {
  const [directions, setDirections] = useState<DirectionsResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDirections = useCallback(async () => {
    if (paradas.length < 2) {
      setDirections(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const origem = paradas[0];
      const destino = paradas[paradas.length - 1];
      const waypoints = paradas.slice(1, -1);

      const waypointsParam = waypoints.length > 0
        ? `&waypoints=${waypoints.map(w => `${w.latitude},${w.longitude}`).join('|')}`
        : '';

      const url =
        `https://maps.googleapis.com/maps/api/directions/json?` +
        `origin=${origem.latitude},${origem.longitude}` +
        `&destination=${destino.latitude},${destino.longitude}` +
        `${waypointsParam}` +
        `&key=${GOOGLE_MAPS_API_KEY}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];

        // Decode polyline
        const coordinates = decodePolyline(route.overview_polyline.points);

        // Extract distance and duration
        let totalDistanceMeters = 0;
        let totalDurationSeconds = 0;

        route.legs.forEach((leg: { distance: { value: number }; duration: { value: number } }) => {
          totalDistanceMeters += leg.distance.value;
          totalDurationSeconds += leg.duration.value;
        });

        const distanceKm = totalDistanceMeters / 1000;
        const durationMins = Math.ceil(totalDurationSeconds / 60);

        setDirections({
          coordinates,
          distanceMeters: totalDistanceMeters,
          durationSeconds: totalDurationSeconds,
          distanceText: distanceKm >= 1 ? `${distanceKm.toFixed(1)} km` : `${totalDistanceMeters} m`,
          durationText: durationMins >= 60
            ? `${Math.floor(durationMins / 60)}h ${durationMins % 60}min`
            : `${durationMins} min`,
        });
        setError(null);
      } else {
        setError('No route found');
        setDirections(null);
      }
    } catch (err) {
      logger.error('Error fetching directions:', err);
      setError('Failed to fetch directions');
      setDirections(null);
    } finally {
      setIsLoading(false);
    }
  }, [paradas]);

  useEffect(() => {
    fetchDirections();
  }, [fetchDirections]);

  return {
    directions,
    isLoading,
    error,
    refetch: fetchDirections,
  };
}
