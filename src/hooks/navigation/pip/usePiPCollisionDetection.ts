/**
 * usePiPCollisionDetection - PiP Collision Avoidance Hook
 *
 * Provides collision detection utilities for the PiP (Picture-in-Picture)
 * window to automatically avoid overlapping with other UI elements like
 * FABs (Floating Action Buttons), bottom sheets, or modals.
 *
 * ## How It Works
 * 1. Caller provides list of `avoidAreas` (rectangles to avoid)
 * 2. `checkCollision` determines if PiP overlaps with any area
 * 3. `findSafePosition` calculates nearest safe corner position
 * 4. PiP component animates to the safe position
 *
 * ## Collision Algorithm
 * Uses AABB (Axis-Aligned Bounding Box) intersection test:
 * - Two rectangles DO NOT overlap if:
 *   - rect1.right < rect2.left, OR
 *   - rect1.left > rect2.right, OR
 *   - rect1.bottom < rect2.top, OR
 *   - rect1.top > rect2.bottom
 * - If NONE of these are true → collision detected
 *
 * ## Safe Positions
 * The hook prioritizes 4 corner positions (in order):
 * 1. Top-left corner
 * 2. Top-right corner (default fallback)
 * 3. Bottom-left corner
 * 4. Bottom-right corner
 *
 * @example
 * ```tsx
 * const { checkCollision, findSafePosition } = usePiPCollisionDetection();
 *
 * // Check if PiP at position would collide with FAB
 * const fabArea = { x: 300, y: 500, width: 56, height: 56 };
 * const pipPosition = { x: 280, y: 480 };
 *
 * if (checkCollision(pipPosition, [fabArea])) {
 *   const safePos = findSafePosition(pipPosition, [fabArea], viewport);
 *   // Animate PiP to safePos
 * }
 * ```
 *
 * @see PictureInPictureMap for usage context
 * @see types.ts for AvoidArea and Position interfaces
 */

import { useCallback } from 'react';

import { EDGE_PADDING, PIP_HEIGHT, PIP_WIDTH } from './constants';

import type { AvoidArea, Position } from './types';

/** Viewport bounds for safe position calculation */
interface ViewportBounds {
  /** Screen width in pixels */
  width: number;
  /** Screen height in pixels */
  height: number;
  /** Minimum Y position (below status bar) */
  minY: number;
  /** Maximum Y position (above tab bar) */
  maxY: number;
}

/** Return type for usePiPCollisionDetection hook */
interface UsePiPCollisionDetectionReturn {
  /** Check if a position collides with any avoidArea */
  checkCollision: (position: Position, avoidAreas: AvoidArea[]) => boolean;
  /** Find the nearest safe position that doesn't collide */
  findSafePosition: (
    currentPosition: Position,
    avoidAreas: AvoidArea[],
    viewport: ViewportBounds
  ) => Position;
  /** Get all safe corner positions within viewport */
  getSafeCorners: (viewport: ViewportBounds) => Position[];
}

/**
 * Hook that provides collision detection utilities for PiP positioning.
 *
 * @returns Object containing collision detection and safe position utilities
 */
export function usePiPCollisionDetection(): UsePiPCollisionDetectionReturn {
  /**
   * Check if a rectangle at the given position collides with any avoidArea
   */
  const checkCollision = useCallback(
    (position: Position, avoidAreas: AvoidArea[]): boolean => {
      const pipRight = position.x + PIP_WIDTH;
      const pipBottom = position.y + PIP_HEIGHT;

      return avoidAreas.some((area) => {
        const areaRight = area.x + area.width;
        const areaBottom = area.y + area.height;
        // Check for overlap (NOT no overlap)
        return !(
          pipRight < area.x ||
          position.x > areaRight ||
          pipBottom < area.y ||
          position.y > areaBottom
        );
      });
    },
    []
  );

  /**
   * Get all safe corner positions within viewport bounds
   */
  const getSafeCorners = useCallback((viewport: ViewportBounds): Position[] => {
    return [
      { x: EDGE_PADDING, y: viewport.minY }, // Top left
      { x: viewport.width - PIP_WIDTH - EDGE_PADDING, y: viewport.minY }, // Top right
      { x: EDGE_PADDING, y: viewport.maxY }, // Bottom left
      { x: viewport.width - PIP_WIDTH - EDGE_PADDING, y: viewport.maxY }, // Bottom right
    ];
  }, []);

  /**
   * Find the nearest safe position that doesn't collide with any avoidArea
   */
  const findSafePosition = useCallback(
    (
      currentPosition: Position,
      avoidAreas: AvoidArea[],
      viewport: ViewportBounds
    ): Position => {
      const safeCorners = getSafeCorners(viewport);

      // Default fallback: top right corner
      let bestPosition = safeCorners[1];
      let minDistance = Infinity;

      for (const pos of safeCorners) {
        const posRight = pos.x + PIP_WIDTH;
        const posBottom = pos.y + PIP_HEIGHT;

        // Check if this position would collide
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
          // Calculate distance from current position
          const distance = Math.sqrt(
            Math.pow(pos.x - currentPosition.x, 2) +
              Math.pow(pos.y - currentPosition.y, 2)
          );
          if (distance < minDistance) {
            minDistance = distance;
            bestPosition = pos;
          }
        }
      }

      return bestPosition;
    },
    [getSafeCorners]
  );

  return {
    checkCollision,
    findSafePosition,
    getSafeCorners,
  };
}
