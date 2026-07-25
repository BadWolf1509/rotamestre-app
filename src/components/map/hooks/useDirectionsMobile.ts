/**
 * Legacy mobile directions hook.
 *
 * Kept for MapaRN compatibility. It only exposes actual road geometry; when
 * OSRM cannot provide one, callers receive an explicit error and no line.
 */
import { useCallback, useEffect, useState } from 'react';

import { logger } from '@/lib/logger';
import { getRoute, decodePolyline, type Coordinate } from '@/lib/osrm';

interface Parada {
  id: string;
  latitude: number;
  longitude: number;
  ordem: number;
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

export function useDirectionsMobile({
  paradas,
}: UseDirectionsMobileOptions): UseDirectionsMobileResult {
  const [directions, setDirections] = useState<DirectionsResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDirections = useCallback(async () => {
    if (paradas.length < 2) {
      setDirections(null);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const origem = paradas[0];
      const destino = paradas[paradas.length - 1];
      const waypoints = paradas.slice(1, -1);
      const route = await getRoute(
        { latitude: origem.latitude, longitude: origem.longitude },
        { latitude: destino.latitude, longitude: destino.longitude },
        waypoints.map((waypoint) => ({
          latitude: waypoint.latitude,
          longitude: waypoint.longitude,
        })),
        { steps: false },
      );

      if (!route?.polyline) {
        throw new Error('OSRM não retornou uma geometria viária');
      }

      const coordinates = decodePolyline(route.polyline);
      if (coordinates.length < 2) {
        throw new Error('OSRM retornou uma geometria inválida');
      }

      const distanceKm = route.distance / 1000;
      const durationMins = Math.ceil(route.duration / 60);

      setDirections({
        coordinates,
        distanceMeters: route.distance,
        durationSeconds: route.duration,
        distanceText:
          distanceKm >= 1
            ? `${distanceKm.toFixed(1)} km`
            : `${Math.round(route.distance)} m`,
        durationText:
          durationMins >= 60
            ? `${Math.floor(durationMins / 60)}h ${durationMins % 60}min`
            : `${durationMins} min`,
      });
    } catch (routeError) {
      logger.error(
        '[useDirectionsMobile] Erro ao buscar trajeto viário:',
        routeError,
      );
      setDirections(null);
      setError('Trajeto viário indisponível');
    } finally {
      setIsLoading(false);
    }
  }, [paradas]);

  useEffect(() => {
    void fetchDirections();
  }, [fetchDirections]);

  return {
    directions,
    isLoading,
    error,
    refetch: fetchDirections,
  };
}
