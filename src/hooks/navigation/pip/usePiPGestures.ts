import * as Haptics from "expo-haptics";
import { type MutableRefObject, useEffect, useRef, useState } from "react";
import { Animated, PanResponder, Platform } from "react-native";

import {
  DOUBLE_TAP_DELAY,
  EDGE_PADDING,
  PIP_HEIGHT,
  PIP_WIDTH,
  SWIPE_VELOCITY_THRESHOLD,
} from "./constants";

interface UsePiPGesturesOptions {
  pan: Animated.ValueXY;
  currentPositionRef: MutableRefObject<{ x: number; y: number }>;
  isExpandedRef: MutableRefObject<boolean>;
  toggleExpandRef: MutableRefObject<() => void>;
  savePositionRef: MutableRefObject<(pos: { x: number; y: number }) => void>;
  onCloseRef: MutableRefObject<() => void>;
  safeTopBoundRef: MutableRefObject<number>;
  safeBottomBoundRef: MutableRefObject<number>;
  screenWidth: number;
  screenHeight: number;
}

/**
 * Creates a PanResponder for PiP drag, double-tap, swipe-down, and snap-to-edge.
 */
export function usePiPGestures({
  pan,
  currentPositionRef,
  isExpandedRef,
  toggleExpandRef,
  savePositionRef,
  onCloseRef,
  safeTopBoundRef,
  safeBottomBoundRef,
  screenWidth,
  screenHeight,
}: UsePiPGesturesOptions) {
  const [isDragging, setIsDragging] = useState(false);
  const lastTapRef = useRef<number>(0);

  // Refs for screen dimensions (PanResponder captures closures)
  const screenWidthRef = useRef(screenWidth);
  const screenHeightRef = useRef(screenHeight);
  useEffect(() => {
    screenWidthRef.current = screenWidth;
    screenHeightRef.current = screenHeight;
  }, [screenWidth, screenHeight]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !isExpandedRef.current,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return (
          !isExpandedRef.current &&
          (Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2)
        );
      },
      onPanResponderGrant: () => {
        const now = Date.now();
        // Double-tap detection
        if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
          if (Platform.OS !== "web") {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
          toggleExpandRef.current();
          lastTapRef.current = 0;
          return;
        }
        lastTapRef.current = now;

        setIsDragging(true);
        if (Platform.OS !== "web") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        pan.setOffset({
          x: currentPositionRef.current.x,
          y: currentPositionRef.current.y,
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_, gestureState) => {
        setIsDragging(false);
        pan.flattenOffset();

        // Swipe down → close
        if (
          gestureState.vy > SWIPE_VELOCITY_THRESHOLD &&
          gestureState.dy > 50
        ) {
          if (Platform.OS !== "web") {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          }
          Animated.timing(pan.y, {
            toValue: screenHeightRef.current + PIP_HEIGHT,
            duration: 200,
            useNativeDriver: false,
          }).start(() => {
            onCloseRef.current();
          });
          return;
        }

        // Snap to edge
        if (Platform.OS !== "web") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }

        const currentScreenWidth = screenWidthRef.current;
        const finalX =
          gestureState.moveX < currentScreenWidth / 2
            ? EDGE_PADDING
            : currentScreenWidth - PIP_WIDTH - EDGE_PADDING;

        const finalY = Math.max(
          safeTopBoundRef.current,
          Math.min(
            safeBottomBoundRef.current,
            gestureState.moveY - PIP_HEIGHT / 2,
          ),
        );

        Animated.spring(pan, {
          toValue: { x: finalX, y: finalY },
          useNativeDriver: false,
          tension: 40,
          friction: 8,
        }).start(() => {
          savePositionRef.current({ x: finalX, y: finalY });
        });
      },
    }),
  ).current;

  return { panResponder, isDragging };
}
