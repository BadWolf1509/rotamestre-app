import { type MutableRefObject, useEffect, useRef } from "react";
import { Animated } from "react-native";

import {
  EDGE_PADDING,
  PIP_HEIGHT,
  PIP_WIDTH,
  TAB_BAR_BASE_HEIGHT,
  ANDROID_MIN_NAV_BAR_HEIGHT,
} from "./constants";

interface UsePiPPositioningOptions {
  insets: { top: number; bottom: number };
  screenWidth: number;
  screenHeight: number;
  expandedWidth: number;
  expandedHeight: number;
  pan: Animated.ValueXY;
  animatedWidth: Animated.Value;
  animatedHeight: Animated.Value;
  visible: boolean;
  savedPosition: { x: number; y: number } | undefined;
  avoidAreas?: Array<{ x: number; y: number; width: number; height: number }>;
  isExpandedRef: MutableRefObject<boolean>;
  currentPositionRef: MutableRefObject<{ x: number; y: number }>;
  savePositionRef: MutableRefObject<(pos: { x: number; y: number }) => void>;
}

/**
 * Manages PiP safe bounds, position persistence, auto-reposition on collision,
 * screen rotation handling, and position sync.
 */
export function usePiPPositioning({
  insets,
  screenWidth,
  screenHeight,
  expandedWidth,
  expandedHeight,
  pan,
  animatedWidth,
  animatedHeight,
  visible,
  savedPosition,
  avoidAreas,
  isExpandedRef,
  currentPositionRef,
  savePositionRef,
}: UsePiPPositioningOptions) {
  // Safe area bounds refs
  const safeTopBoundRef = useRef(insets.top + 10);
  const safeBottomBoundRef = useRef(
    screenHeight -
      PIP_HEIGHT -
      TAB_BAR_BASE_HEIGHT -
      Math.max(insets.bottom, ANDROID_MIN_NAV_BAR_HEIGHT) -
      EDGE_PADDING,
  );

  // Update bounds when insets or dimensions change
  useEffect(() => {
    safeTopBoundRef.current = insets.top + 10;
    safeBottomBoundRef.current =
      screenHeight -
      PIP_HEIGHT -
      TAB_BAR_BASE_HEIGHT -
      Math.max(insets.bottom, ANDROID_MIN_NAV_BAR_HEIGHT) -
      EDGE_PADDING;
  }, [insets.top, insets.bottom, screenHeight]);

  // Apply saved position when loaded
  useEffect(() => {
    if (savedPosition && !isExpandedRef.current) {
      const validX = Math.max(
        EDGE_PADDING,
        Math.min(savedPosition.x, screenWidth - PIP_WIDTH - EDGE_PADDING),
      );
      const validY = Math.max(
        safeTopBoundRef.current,
        Math.min(savedPosition.y, safeBottomBoundRef.current),
      );
      pan.setValue({ x: validX, y: validY });
      currentPositionRef.current = { x: validX, y: validY };
    }
  }, [savedPosition, pan, screenWidth, isExpandedRef, currentPositionRef]);

  // Auto-reposition to avoid collision with avoidAreas
  useEffect(() => {
    if (
      !avoidAreas ||
      avoidAreas.length === 0 ||
      isExpandedRef.current ||
      !visible
    )
      return;

    const currentX = currentPositionRef.current.x;
    const currentY = currentPositionRef.current.y;
    const pipRight = currentX + PIP_WIDTH;
    const pipBottom = currentY + PIP_HEIGHT;

    const hasCollision = avoidAreas.some((area) => {
      const areaRight = area.x + area.width;
      const areaBottom = area.y + area.height;
      return !(
        pipRight < area.x ||
        currentX > areaRight ||
        pipBottom < area.y ||
        currentY > areaBottom
      );
    });

    if (hasCollision) {
      const safePositions = [
        { x: EDGE_PADDING, y: safeTopBoundRef.current },
        {
          x: screenWidth - PIP_WIDTH - EDGE_PADDING,
          y: safeTopBoundRef.current,
        },
        { x: EDGE_PADDING, y: safeBottomBoundRef.current },
        {
          x: screenWidth - PIP_WIDTH - EDGE_PADDING,
          y: safeBottomBoundRef.current,
        },
      ];

      let bestPosition = safePositions[1]; // Fallback: top-right
      let minDistance = Infinity;

      for (const pos of safePositions) {
        const posRight = pos.x + PIP_WIDTH;
        const posBottom = pos.y + PIP_HEIGHT;

        const wouldCollide = avoidAreas.some((area) => {
          const areaRight = area.x + area.width;
          const areaBottom = area.y + area.height;
          return !(
            posRight < area.x ||
            pos.x > areaRight ||
            posBottom < area.y ||
            pos.y > areaBottom
          );
        });

        if (!wouldCollide) {
          const distance = Math.sqrt(
            Math.pow(pos.x - currentX, 2) + Math.pow(pos.y - currentY, 2),
          );
          if (distance < minDistance) {
            minDistance = distance;
            bestPosition = pos;
          }
        }
      }

      Animated.spring(pan, {
        toValue: bestPosition,
        useNativeDriver: false,
        tension: 40,
        friction: 8,
      }).start(() => {
        currentPositionRef.current = bestPosition;
        savePositionRef.current(bestPosition);
      });
    }
  }, [
    avoidAreas,
    visible,
    pan,
    screenWidth,
    isExpandedRef,
    currentPositionRef,
    savePositionRef,
  ]);

  // Handle screen rotation / dimension changes
  useEffect(() => {
    if (!isExpandedRef.current) {
      const newX = screenWidth - PIP_WIDTH - EDGE_PADDING;
      const newY = Math.max(
        safeTopBoundRef.current,
        Math.min(currentPositionRef.current.y, safeBottomBoundRef.current),
      );
      pan.setValue({ x: newX, y: newY });
      currentPositionRef.current = { x: newX, y: newY };
    } else {
      const centerX = (screenWidth - expandedWidth) / 2;
      const centerY = (screenHeight - expandedHeight) / 2;
      pan.setValue({ x: centerX, y: centerY });
      animatedWidth.setValue(expandedWidth);
      animatedHeight.setValue(expandedHeight);
    }
  }, [
    screenWidth,
    screenHeight,
    expandedWidth,
    expandedHeight,
    pan,
    animatedWidth,
    animatedHeight,
    isExpandedRef,
    currentPositionRef,
  ]);

  // Sync Animated.ValueXY listener → currentPositionRef
  useEffect(() => {
    const listenerId = pan.addListener((value) => {
      currentPositionRef.current = value;
    });
    return () => {
      pan.removeListener(listenerId);
    };
  }, [pan, currentPositionRef]);

  return { safeTopBoundRef, safeBottomBoundRef };
}
