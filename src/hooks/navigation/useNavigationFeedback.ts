/**
 * useNavigationFeedback - Haptic and sound feedback for navigation
 *
 * Extracted from NavigationMode.tsx to reduce component complexity.
 * Handles haptic feedback (expo-haptics) and notification sounds (expo-av).
 */

import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { useCallback, useRef } from 'react';
import { Platform } from 'react-native';

interface UseNavigationFeedbackOptions {
  vibrationAlerts: boolean;
  soundAlerts: boolean;
}

export function useNavigationFeedback({
  vibrationAlerts,
  soundAlerts,
}: UseNavigationFeedbackOptions) {
  const soundRef = useRef<Audio.Sound | null>(null);

  const triggerHaptic = useCallback(
    async (type: 'impact' | 'success' | 'warning') => {
      if (Platform.OS === 'web' || !vibrationAlerts) return;

      try {
        if (type === 'impact') {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } else if (type === 'success') {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else if (type === 'warning') {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        }
      } catch {
        // Haptics not available
      }
    },
    [vibrationAlerts]
  );

  const playNotificationSound = useCallback(async () => {
    if (Platform.OS === 'web' || !soundAlerts) return;

    try {
      // Configure audio mode for notifications
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: false,
        staysActiveInBackground: false,
      });

      // Unload previous sound if exists
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      // Play a simple notification beep using Audio
      // Note: Custom sounds can be added to assets/sounds/ folder
      // For now, we use haptics as the primary feedback
    } catch {
      // Audio not available
    }
  }, [soundAlerts]);

  const cleanupSound = useCallback(async () => {
    if (soundRef.current) {
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
  }, []);

  return { triggerHaptic, playNotificationSound, cleanupSound, soundRef };
}
