/**
 * Hook for centering the map camera on the user's current location
 *
 * Handles:
 * - Requesting foreground location permission
 * - Fetching current position
 * - Moving camera to user location
 * - isLocating loading state
 */

import * as Location from 'expo-location';
import { useCallback, useState, type RefObject } from 'react';

import { useAlert } from '@/hooks/useAlert';
import { logger } from '@/lib/logger';
import { toLngLat, zoomFromLongitudeDelta } from '@/lib/maplibre';

import type { CameraRef } from '@maplibre/maplibre-react-native';

interface UseLocationTrackingResult {
  isLocating: boolean;
  handleCenterOnUser: () => Promise<void>;
}

/**
 * Provides the ability to center the MapLibre camera on the user's GPS position.
 * Shows permission/error alerts via useAlert.
 */
export function useLocationTracking(
  cameraRef: RefObject<CameraRef | null>,
): UseLocationTrackingResult {
  const { showWarning, showError } = useAlert();
  const [isLocating, setIsLocating] = useState(false);

  const handleCenterOnUser = useCallback(async () => {
    setIsLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showWarning(
          'Permissão negada',
          'Permita o acesso à localização para usar esta função.',
        );
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const newUserLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      cameraRef.current?.setStop({
        center: toLngLat(newUserLocation),
        zoom: zoomFromLongitudeDelta(0.01),
        duration: 500,
      });
    } catch (error) {
      logger.error('[useLocationTracking] Erro ao obter localização:', error);
      showError({
        title: 'Erro',
        message: 'Não foi possível obter sua localização.',
      });
    } finally {
      setIsLocating(false);
    }
  }, [cameraRef, showWarning, showError]);

  return { isLocating, handleCenterOnUser };
}
