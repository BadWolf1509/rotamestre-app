/**
 * usePiPCollisionDetection
 *
 * Hook that handles collision detection with avoidAreas and calculates safe positions
 */

import { useCallback } from 'react';

import { EDGE_PADDING, PIP_HEIGHT, PIP_WIDTH } from './constants';

import type { AvoidArea, Position } from './types';

interface ViewportBounds {
  width: number;
  height: number;
  minY: number;
  maxY: number;
}

interface UsePiPCollisionDetectionReturn {
  /** Check if a position collides with any avoidArea */
  checkCollision: (position: Position, avoidAreas: AvoidArea[]) => boolean;
  /** Find the nearest safe position that doesn't collide */
  findSafePosition: (
    currentPosition: Position,
    avoidAreas: AvoidArea[],
    viewport: ViewportBounds
  ) => Position;
  /** Get all safe corner positions */
  getSafeCorners: (viewport: ViewportBounds) => Position[];
}

/**
 * Hook that provides collision detection utilities for PiP positioning
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
