/**
 * Hook para gerenciar animações do MainCard
 * Consolida animações de entrada e celebração
 */

import { useEffect, useRef, useState } from 'react';
import { Animated } from 'react-native';

import { RouteStatus } from '@/context/RouteStatusContext';
import { successHaptic } from '@/utils/haptics';

interface UseMainCardAnimationsOptions {
  state: RouteStatus;
}

interface UseMainCardAnimationsReturn {
  // Card entry animation
  fadeAnim: Animated.Value;
  slideAnim: Animated.Value;
  // Celebration animation (completed state)
  celebrationScale: Animated.Value;
  celebrationOpacity: Animated.Value;
}

export function useMainCardAnimations({
  state,
}: UseMainCardAnimationsOptions): UseMainCardAnimationsReturn {
  // Card entry animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  // Celebration animation refs
  const celebrationScale = useRef(new Animated.Value(0)).current;
  const celebrationOpacity = useRef(new Animated.Value(0)).current;

  // Track if celebration was triggered to avoid re-triggering
  const [celebrationTriggered, setCelebrationTriggered] = useState(false);

  // Card entry animation - triggers on state change
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, [state, fadeAnim, slideAnim]);

  // Celebration animation - triggers when route is completed
  useEffect(() => {
    if (state === 'completed' && !celebrationTriggered) {
      setCelebrationTriggered(true);

      // Haptic feedback
      successHaptic();

      // Animate checkmark
      Animated.parallel([
        Animated.spring(celebrationScale, {
          toValue: 1,
          tension: 50,
          friction: 3,
          useNativeDriver: true,
        }),
        Animated.timing(celebrationOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (state !== 'completed' && celebrationTriggered) {
      // Reset when leaving completed state
      setCelebrationTriggered(false);
      celebrationScale.setValue(0);
      celebrationOpacity.setValue(0);
    }
  }, [state, celebrationTriggered, celebrationScale, celebrationOpacity]);

  return {
    fadeAnim,
    slideAnim,
    celebrationScale,
    celebrationOpacity,
  };
}
