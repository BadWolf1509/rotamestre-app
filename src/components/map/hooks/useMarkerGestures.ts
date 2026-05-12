/**
 * Hook for marker press/long-press/map-press and clipboard gestures in MapaMobile
 *
 * Handles:
 * - handleMarkerPress: haptic + deselect checkpoint + callback
 * - handleMarkerLongPress: haptic + callback
 * - handleMapPress: deselect checkpoint + callback
 * - handleCopyAddress: copy to clipboard + haptic + toast
 */

import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';
import { Platform } from 'react-native';

import { toast } from '@/utils/toast';

interface UseMarkerGesturesOptions {
  onMarkerPress?: (paradaId: string) => void;
  onMarkerLongPress?: (paradaId: string) => void;
  onMapPress?: () => void;
  setSelectedCheckpointId: (id: string | null) => void;
}

interface UseMarkerGesturesResult {
  handleMarkerPress: (paradaId: string) => void;
  handleMarkerLongPress: (paradaId: string) => void;
  handleMapPress: () => void;
  handleCopyAddress: (endereco: string) => Promise<void>;
}

/**
 * Provides all gesture handlers for map markers and the map background.
 */
export function useMarkerGestures({
  onMarkerPress,
  onMarkerLongPress,
  onMapPress,
  setSelectedCheckpointId,
}: UseMarkerGesturesOptions): UseMarkerGesturesResult {
  const handleMarkerPress = useCallback(
    (paradaId: string) => {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      setSelectedCheckpointId(null);
      onMarkerPress?.(paradaId);
    },
    [onMarkerPress, setSelectedCheckpointId],
  );

  const handleMarkerLongPress = useCallback(
    (paradaId: string) => {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      onMarkerLongPress?.(paradaId);
    },
    [onMarkerLongPress],
  );

  const handleMapPress = useCallback(() => {
    setSelectedCheckpointId(null);
    onMapPress?.();
  }, [onMapPress, setSelectedCheckpointId]);

  const handleCopyAddress = useCallback(async (endereco: string) => {
    try {
      await Clipboard.setStringAsync(endereco);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success(
        'Endereço copiado para a área de transferência.',
        'Copiado!',
      );
    } catch {
      // Clipboard may not be available on all platforms
      toast.error('Não foi possível copiar o endereço.');
    }
  }, []);

  return {
    handleMarkerPress,
    handleMarkerLongPress,
    handleMapPress,
    handleCopyAddress,
  };
}
