import { useEffect, useState, useCallback, useRef } from 'react';

import { logger } from '@/lib/logger';
import { getDistance, estimateRouteDistance } from '@/lib/osrm';

interface DistanceInfo {
  distanceMeters: number;
  distanceKm: string;
  durationSeconds: number;
  durationText: string;
  isLoading: boolean;
  error: string | null;
}

interface Location {
  latitude: number;
  longitude: number;
}

/**
 * Hook para calcular distância e tempo até uma parada em tempo real
 *
 * MIGRADO PARA OSRM (Open Source Routing Machine)
 * - Custo: GRATUITO (vs ~R$900/mês do Google Routes API)
 * - Cache: 5 minutos (gerenciado pelo serviço OSRM)
 * - Rate limit: 1 req/segundo (gerenciado pelo serviço OSRM)
 * - Fallback: Haversine se OSRM falhar
 *
 * @see src/lib/osrm.ts
 */
export function useDistanceToStop(
  userLocation: Location | null | undefined,
  destination: Location | null | undefined,
  options?: {
    enabled?: boolean;
    refreshInterval?: number; // ms entre atualizações (padrão: 2 minutos)
  }
): DistanceInfo {
  // Aumentado para 2 minutos para respeitar rate limits do OSRM
  const { enabled = true, refreshInterval = 120000 } = options || {};

  const [distanceInfo, setDistanceInfo] = useState<DistanceInfo>({
    distanceMeters: 0,
    distanceKm: '--',
    durationSeconds: 0,
    durationText: '--',
    isLoading: false,
    error: null,
  });

  const lastFetchRef = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchDistance = useCallback(async () => {
    if (!userLocation || !destination || !enabled) return;

    // Rate limiting local (além do rate limiting do serviço OSRM)
    const now = Date.now();
    if (now - lastFetchRef.current < 10000) return; // Mínimo 10s entre chamadas
    lastFetchRef.current = now;

    setDistanceInfo(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Usar OSRM (gratuito) em vez do Google (R$900/mês!)
      const result = await getDistance(userLocation, destination);

      const newInfo: DistanceInfo = {
        distanceMeters: result.distance,
        distanceKm: result.distanceText,
        durationSeconds: result.duration,
        durationText: result.durationText,
        isLoading: false,
        error: null,
      };

      setDistanceInfo(newInfo);
    } catch (error) {
      logger.error('Erro ao calcular distância com OSRM:', error);

      // Fallback: cálculo Haversine (gratuito, menos preciso)
      const estimate = estimateRouteDistance(userLocation, destination);

      setDistanceInfo({
        distanceMeters: estimate.distance,
        distanceKm: estimate.distanceText,
        durationSeconds: estimate.duration,
        durationText: estimate.durationText,
        isLoading: false,
        error: null, // Não mostrar erro, Haversine funciona como fallback
      });
    }
  }, [userLocation, destination, enabled]);

  // Fetch inicial e quando coordenadas mudam significativamente
  useEffect(() => {
    fetchDistance();
  }, [fetchDistance]);

  // Refresh periódico
  useEffect(() => {
    if (!enabled || !userLocation || !destination) return;

    intervalRef.current = setInterval(fetchDistance, refreshInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, userLocation, destination, refreshInterval, fetchDistance]);

  return distanceInfo;
}
