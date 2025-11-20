import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase';

import { useUser } from './useUser';

interface UseLocationTrackingOptions {
  rotaId?: string | null;
  enabled?: boolean;
  /** Intervalo de envio em milissegundos (padrão: 30000 = 30s) */
  interval?: number;
}

interface LocationData {
  latitude: number;
  longitude: number;
  velocidade: number | null;
  precisao: number | null;
  heading: number | null;
}

export function useLocationTracking(options: UseLocationTrackingOptions = {}) {
  const { rotaId, enabled = true, interval = 30000 } = options;
  const { userData } = useUser();

  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [tracking, setTracking] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const sendIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSentLocation = useRef<LocationData | null>(null);

  // Solicitar permissão de localização
  const requestPermission = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        setError('Permissão de localização negada');
        setPermissionGranted(false);
        return false;
      }

      setPermissionGranted(true);
      setError(null);
      return true;
    } catch (err) {
      console.error('Erro ao solicitar permissão:', err);
      setError('Erro ao solicitar permissão de localização');
      return false;
    }
  }, []);

  // Enviar localização para o banco
  const sendLocationToDatabase = useCallback(
    async (location: LocationData) => {
      if (!userData?.id || !rotaId) return;

      try {
        const { error: dbError } = await supabase.from('motorista_locations').insert({
          motorista_id: userData.id,
          rota_id: rotaId,
          latitude: location.latitude,
          longitude: location.longitude,
          velocidade: location.velocidade,
          precisao: location.precisao,
          heading: location.heading,
        });

        if (dbError) throw dbError;

        lastSentLocation.current = location;
        console.log('[GPS] Localização enviada:', location);
      } catch (err) {
        console.error('[GPS] Erro ao enviar localização:', err);
      }
    },
    [userData?.id, rotaId]
  );

  // Iniciar rastreamento
  const startTracking = useCallback(async () => {
    if (!userData?.id || !rotaId || !enabled || tracking) return;

    const hasPermission = await requestPermission();
    if (!hasPermission) return;

    try {
      // Configurar watcher de localização
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000, // Atualizar a cada 5 segundos
          distanceInterval: 10, // Ou quando mover 10 metros
        },
        (loc) => {
          const locationData: LocationData = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            velocidade: loc.coords.speed ? loc.coords.speed * 3.6 : null, // m/s para km/h
            precisao: loc.coords.accuracy,
            heading: loc.coords.heading,
          };

          setCurrentLocation(locationData);
        }
      );

      // Configurar intervalo de envio para o banco
      sendIntervalRef.current = setInterval(() => {
        if (currentLocation) {
          sendLocationToDatabase(currentLocation);
        }
      }, interval);

      setTracking(true);
      console.log('[GPS] Rastreamento iniciado');
    } catch (err) {
      console.error('[GPS] Erro ao iniciar rastreamento:', err);
      setError('Erro ao iniciar rastreamento GPS');
    }
  }, [
    userData?.id,
    rotaId,
    enabled,
    tracking,
    requestPermission,
    sendLocationToDatabase,
    currentLocation,
    interval,
  ]);

  // Parar rastreamento
  const stopTracking = useCallback(() => {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }

    if (sendIntervalRef.current) {
      clearInterval(sendIntervalRef.current);
      sendIntervalRef.current = null;
    }

    setTracking(false);
    console.log('[GPS] Rastreamento parado');
  }, []);

  // Iniciar/parar automaticamente quando enabled/rotaId mudar
  useEffect(() => {
    if (enabled && rotaId && userData?.id) {
      startTracking();
    } else {
      stopTracking();
    }

    return () => {
      stopTracking();
    };
  }, [enabled, rotaId, userData?.id, startTracking, stopTracking]);

  return {
    currentLocation,
    tracking,
    permissionGranted,
    error,
    startTracking,
    stopTracking,
    requestPermission,
  };
}
