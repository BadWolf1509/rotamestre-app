import { useEffect, useState, useCallback, useRef } from 'react';

import { supabase } from '@/lib/supabase';

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

// Cache para evitar chamadas repetidas
const distanceCache = new Map<string, { data: DistanceInfo; timestamp: number }>();
const CACHE_TTL = 30000; // 30 segundos

/**
 * Hook para calcular distância e tempo até uma parada em tempo real
 * Usa Google Routes API para cálculos precisos
 */
export function useDistanceToStop(
  userLocation: Location | null | undefined,
  destination: Location | null | undefined,
  options?: {
    enabled?: boolean;
    refreshInterval?: number; // ms entre atualizações
  }
): DistanceInfo {
  const { enabled = true, refreshInterval = 30000 } = options || {};

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

  const formatDuration = useCallback((seconds: number): string => {
    if (seconds < 60) return 'menos de 1 min';
    if (seconds < 3600) {
      const minutes = Math.round(seconds / 60);
      return `${minutes} min`;
    }
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);
    return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`;
  }, []);

  const formatDistance = useCallback((meters: number): string => {
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${(meters / 1000).toFixed(1)}km`;
  }, []);

  const fetchDistance = useCallback(async () => {
    if (!userLocation || !destination || !enabled) return;

    // Verificar cache
    const cacheKey = `${userLocation.latitude.toFixed(4)},${userLocation.longitude.toFixed(4)}-${destination.latitude.toFixed(4)},${destination.longitude.toFixed(4)}`;
    const cached = distanceCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setDistanceInfo(cached.data);
      return;
    }

    // Rate limiting
    const now = Date.now();
    if (now - lastFetchRef.current < 5000) return; // Mínimo 5s entre chamadas
    lastFetchRef.current = now;

    setDistanceInfo(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Usar Edge Function do Supabase para evitar CORS
      const { data, error: fnError } = await supabase.functions.invoke('google-directions', {
        body: {
          origin: `${userLocation.latitude},${userLocation.longitude}`,
          destination: `${destination.latitude},${destination.longitude}`,
          mode: 'driving',
        },
      });

      if (fnError) {
        throw new Error(fnError.message || 'Erro ao chamar Edge Function');
      }

      if (data?.status === 'OK' && data.routes?.length > 0) {
        const leg = data.routes[0].legs[0];
        const distanceMeters = leg.distance.value;
        const durationSeconds = leg.duration.value;

        const newInfo: DistanceInfo = {
          distanceMeters,
          distanceKm: formatDistance(distanceMeters),
          durationSeconds,
          durationText: formatDuration(durationSeconds),
          isLoading: false,
          error: null,
        };

        // Salvar no cache
        distanceCache.set(cacheKey, { data: newInfo, timestamp: Date.now() });
        setDistanceInfo(newInfo);
      } else {
        // Fallback: cálculo Haversine (linha reta)
        const R = 6371000; // Raio da Terra em metros
        const dLat = ((destination.latitude - userLocation.latitude) * Math.PI) / 180;
        const dLon = ((destination.longitude - userLocation.longitude) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((userLocation.latitude * Math.PI) / 180) *
            Math.cos((destination.latitude * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distanceMeters = R * c;
        const durationSeconds = Math.round((distanceMeters / 1000) * 2 * 60); // ~30km/h média urbana

        setDistanceInfo({
          distanceMeters,
          distanceKm: formatDistance(distanceMeters),
          durationSeconds,
          durationText: formatDuration(durationSeconds),
          isLoading: false,
          error: null,
        });
      }
    } catch (error) {
      console.error('Erro ao calcular distância:', error);
      setDistanceInfo(prev => ({
        ...prev,
        isLoading: false,
        error: 'Erro ao calcular distância',
      }));
    }
  }, [userLocation, destination, enabled, formatDistance, formatDuration]);

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
