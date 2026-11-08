/**
 * useNavigationFeedback - Haptic feedback for navigation
 *
 * Extracted from NavigationMode.tsx to reduce component complexity.
 * Handles haptic feedback (expo-haptics).
 */

import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';
import { Platform } from 'react-native';

interface UseNavigationFeedbackOptions {
  vibrationAlerts: boolean;
}

export function useNavigationFeedback({
  vibrationAlerts,
}: UseNavigationFeedbackOptions) {
  const triggerHaptic = useCallback(
    async (type: 'impact' | 'success' | 'warning') => {
      if (Platform.OS === 'web' || !vibrationAlerts) return;

      try {
        if (type === 'impact') {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } else if (type === 'success') {
          await Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success,
          );
        } else if (type === 'warning') {
          await Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Warning,
          );
        }
      } catch {
        // Haptics not available
      }
    },
    [vibrationAlerts],
  );

  return { triggerHaptic };
}
