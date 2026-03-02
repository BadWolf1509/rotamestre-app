import * as Haptics from "expo-haptics";
import {
  type MutableRefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Animated, Platform } from "react-native";

import {
  EDGE_PADDING,
  MIN_SAFE_TOP_POSITION,
  OPACITY_ANIMATION_DURATION,
  PIP_HEIGHT,
  PIP_WIDTH,
} from "./constants";

interface UsePiPAnimationOptions {
  initialPosition: { x: number; y: number };
  screenWidth: number;
  screenHeight: number;
  expandedWidth: number;
  expandedHeight: number;
  safeTopBoundRef: MutableRefObject<number>;
  visible: boolean;
}

/**
 * Manages PiP animated values and expand/collapse transitions.
 */
export function usePiPAnimation({
  initialPosition,
  screenWidth,
  screenHeight,
  expandedWidth,
  expandedHeight,
  safeTopBoundRef,
  visible,
}: UsePiPAnimationOptions) {
  // Animated values
  const pan = useRef(new Animated.ValueXY(initialPosition)).current;
  const animatedWidth = useRef(new Animated.Value(PIP_WIDTH)).current;
  const animatedHeight = useRef(new Animated.Value(PIP_HEIGHT)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  // State
  const [isExpanded, setIsExpanded] = useState(false);
  const isExpandedRef = useRef(isExpanded);

  useEffect(() => {
    isExpandedRef.current = isExpanded;
  }, [isExpanded]);

  // Show/hide opacity animation
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: OPACITY_ANIMATION_DURATION,
      useNativeDriver: false,
    }).start();
  }, [opacity, visible]);

  // Toggle expand/collapse
  const toggleExpand = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const newExpanded = !isExpandedRef.current;
    setIsExpanded(newExpanded);

    if (newExpanded) {
      Animated.parallel([
        Animated.spring(pan, {
          toValue: {
            x: (screenWidth - expandedWidth) / 2,
            y: (screenHeight - expandedHeight) / 2,
          },
          useNativeDriver: false,
          tension: 40,
          friction: 8,
        }),
        Animated.spring(animatedWidth, {
          toValue: expandedWidth,
          useNativeDriver: false,
          tension: 40,
          friction: 8,
        }),
        Animated.spring(animatedHeight, {
          toValue: expandedHeight,
          useNativeDriver: false,
          tension: 40,
          friction: 8,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(pan, {
          toValue: {
            x: screenWidth - PIP_WIDTH - EDGE_PADDING,
            y: Math.max(safeTopBoundRef.current, MIN_SAFE_TOP_POSITION),
          },
          useNativeDriver: false,
          tension: 40,
          friction: 8,
        }),
        Animated.spring(animatedWidth, {
          toValue: PIP_WIDTH,
          useNativeDriver: false,
          tension: 40,
          friction: 8,
        }),
        Animated.spring(animatedHeight, {
          toValue: PIP_HEIGHT,
          useNativeDriver: false,
          tension: 40,
          friction: 8,
        }),
      ]).start();
    }
  }, [
    pan,
    animatedWidth,
    animatedHeight,
    screenWidth,
    screenHeight,
    expandedWidth,
    expandedHeight,
    safeTopBoundRef,
  ]);

  // Keep toggleExpand ref in sync for PanResponder
  const toggleExpandRef = useRef(toggleExpand);
  useEffect(() => {
    toggleExpandRef.current = toggleExpand;
  }, [toggleExpand]);

  return {
    pan,
    animatedWidth,
    animatedHeight,
    opacity,
    isExpanded,
    isExpandedRef,
    toggleExpand,
    toggleExpandRef,
  };
}
