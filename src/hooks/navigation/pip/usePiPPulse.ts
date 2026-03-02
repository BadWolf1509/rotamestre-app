import * as Haptics from "expo-haptics";
import { useEffect, useRef } from "react";
import { Animated, Platform } from "react-native";

/**
 * Manages the pulse animation when the user is near the destination.
 * Loops a scale animation and triggers haptic feedback.
 */
export function usePiPPulse(isNearDestination: boolean, isExpanded: boolean) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isNearDestination && !isExpanded) {
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 500,
            useNativeDriver: false,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: false,
          }),
        ]),
      );
      pulseAnimation.start();

      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      return () => pulseAnimation.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isNearDestination, isExpanded, pulseAnim]);

  return pulseAnim;
}
