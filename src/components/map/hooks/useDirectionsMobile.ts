/**
 * Hook for fetching directions on React Native (mobile)
 *
 * MIGRADO PARA OSRM (Open Source Routing Machine)
 * - Custo: GRATUITO (vs Google Directions API)
 * - Cache: 5 minutos (gerenciado pelo serviço OSRM)
 *
 * @see src/lib/osrm.ts
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

/**
 * Hook to fetch directions using OSRM (gratuito!)
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

      // Converter para formato OSRM
      const originCoord: Coordinate = {
        latitude: origem.latitude,
        longitude: origem.longitude,
      };
      const destCoord: Coordinate = {
        latitude: destino.latitude,
        longitude: destino.longitude,
      };
      const waypointCoords: Coordinate[] = waypoints.map(wp => ({
        latitude: wp.latitude,
        longitude: wp.longitude,
      }));

      // Buscar rota do OSRM (gratuito!)
      const route = await getRoute(originCoord, destCoord, waypointCoords, { steps: false });

      if (route && route.polyline) {
        // Decodificar polyline
        const coordinates = decodePolyline(route.polyline);

        const totalDistanceMeters = route.distance;
        const totalDurationSeconds = route.duration;

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
        // Fallback: usar linhas retas
        logger.warn('[useDirectionsMobile] OSRM não retornou rota válida, usando linhas retas');
        const coordinates: Coordinate[] = paradas.map(p => ({
          latitude: p.latitude,
          longitude: p.longitude,
        }));

        setDirections({
          coordinates,
          distanceMeters: 0,
          durationSeconds: 0,
          distanceText: '--',
          durationText: '--',
        });
        setError(null);
      }
    } catch (err) {
      logger.error('[useDirectionsMobile] Error fetching directions:', err);
      setError('Failed to fetch directions');

      // Fallback em caso de erro: usar linhas retas
      const coordinates: Coordinate[] = paradas.map(p => ({
        latitude: p.latitude,
        longitude: p.longitude,
      }));
      setDirections({
        coordinates,
        distanceMeters: 0,
        durationSeconds: 0,
        distanceText: '--',
        durationText: '--',
      });
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
