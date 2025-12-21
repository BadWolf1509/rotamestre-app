/**
 * Hook para transmitir a localização do motorista em tempo real
 * quando a rota está em andamento.
 *
 * Este hook funciona em foreground e complementa o serviço de background:
 * - Com app aberto: Usa este hook para alta precisão (10s, 20m)
 * - Com app fechado: Usa o serviço de background (30s, 50m)
 *
 * Ambos salvam na mesma tabela motorista_locations com campo 'fonte'
 * indicando a origem do update.
 */

import * as Location from 'expo-location';
import { useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';
import { getTrackingContext } from '@/services/unifiedLocationTracking';

interface UseDriverLocationBroadcastOptions {
  /** ID da rota ativa */
  rotaId: string | null | undefined;
  /** Status da rota (só transmite quando 'em_andamento') */
  rotaStatus: string | null | undefined;
  /** Intervalo mínimo entre atualizações em ms (default: 10000 = 10s) */
  updateInterval?: number;
  /** Se deve habilitar o broadcast (pode ser desabilitado por preferência) */
  enabled?: boolean;
}

/**
 * Hook para transmitir localização do motorista para o servidor.
 *
 * @example
 * ```tsx
 * useDriverLocationBroadcast({
 *   rotaId: route?.id,
 *   rotaStatus: route?.status,
 * });
 * ```
 */
export function useDriverLocationBroadcast({
  rotaId,
  rotaStatus,
  updateInterval = 10000,
  enabled = true,
}: UseDriverLocationBroadcastOptions) {
  const lastUpdateRef = useRef<number>(0);
  const watchSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const isActiveRef = useRef(false);

  // Função para enviar localização para o banco
  const broadcastLocation = useCallback(
    async (location: Location.LocationObject) => {
      // Verificar intervalo mínimo entre updates
      const now = Date.now();
      if (now - lastUpdateRef.current < updateInterval) {
        return;
      }

      if (!rotaId) return;

      try {
        // Tentar usar o contexto do serviço unificado (mais confiável)
        const context = await getTrackingContext();
        const motoristaId = context?.motoristaId;

        // Fallback para auth se não tiver contexto
        let finalMotoristaId = motoristaId;
        if (!finalMotoristaId) {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;
          finalMotoristaId = user.id;
        }

        const { error } = await supabase.from('motorista_locations').insert({
          motorista_id: finalMotoristaId,
          rota_id: rotaId,
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          velocidade: location.coords.speed ? location.coords.speed * 3.6 : null, // m/s -> km/h
          precisao: location.coords.accuracy,
          heading: location.coords.heading,
          fonte: 'foreground', // Identificar que veio do hook (app aberto)
        });

        if (error) {
          console.error('[LocationBroadcast] Erro ao enviar localização:', error);
        } else {
          lastUpdateRef.current = now;
        }
      } catch (err) {
        console.error('[LocationBroadcast] Erro:', err);
      }
    },
    [rotaId, updateInterval]
  );

  // Iniciar/parar tracking baseado no status da rota
  useEffect(() => {
    const shouldTrack = enabled && rotaId && rotaStatus === 'em_andamento';

    // Cleanup anterior
    const cleanup = async () => {
      if (watchSubscriptionRef.current) {
        watchSubscriptionRef.current.remove();
        watchSubscriptionRef.current = null;
      }
      isActiveRef.current = false;
    };

    if (!shouldTrack) {
      cleanup();
      return;
    }

    // Iniciar tracking
    const startTracking = async () => {
      // Web não suporta expo-location da mesma forma
      if (Platform.OS === 'web') {
        // Para web, usar geolocation API nativa se disponível
        if ('geolocation' in navigator) {
          const watchId = navigator.geolocation.watchPosition(
            (position) => {
              if (isActiveRef.current) {
                broadcastLocation({
                  coords: {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    altitude: position.coords.altitude,
                    altitudeAccuracy: position.coords.altitudeAccuracy,
                    heading: position.coords.heading,
                    speed: position.coords.speed,
                  },
                  timestamp: position.timestamp,
                } as Location.LocationObject);
              }
            },
            (error) => {
              console.error('[LocationBroadcast] Web geolocation error:', error);
            },
            {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 5000,
            }
          );

          isActiveRef.current = true;

          // Armazenar função de cleanup
          watchSubscriptionRef.current = {
            remove: () => navigator.geolocation.clearWatch(watchId),
          } as unknown as Location.LocationSubscription;
        }
        return;
      }

      // Mobile (iOS/Android)
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.warn('[LocationBroadcast] Permissão de localização negada');
          return;
        }

        isActiveRef.current = true;

        watchSubscriptionRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: updateInterval,
            distanceInterval: 20, // Mínimo 20m entre updates
          },
          (location) => {
            if (isActiveRef.current) {
              broadcastLocation(location);
            }
          }
        );

      } catch (err) {
        console.error('[LocationBroadcast] Erro ao iniciar tracking:', err);
      }
    };

    startTracking();

    return () => {
      cleanup();
    };
  }, [enabled, rotaId, rotaStatus, updateInterval, broadcastLocation]);

  return {
    isActive: isActiveRef.current,
  };
}
