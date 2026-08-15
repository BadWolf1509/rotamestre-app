/**
 * useTurnByTurnFormatters
 *
 * Hook providing formatting utilities for Turn-by-Turn navigation
 */

import { useCallback } from 'react';

import { formatarDecimal } from '@/lib/formatNumber';
import type { IconName } from '@/types/icons';

interface UseTurnByTurnFormattersReturn {
  /** Format distance in meters to display string */
  formatDistance: (meters: number) => string;
  /** Format duration in seconds to display string */
  formatDuration: (seconds: number) => string;
  /** Get icon name for a maneuver type */
  getManeuverIcon: (maneuver: string | undefined) => IconName;
}

/**
 * Hook that provides formatting utilities for navigation display
 */
export function useTurnByTurnFormatters(): UseTurnByTurnFormattersReturn {
  /**
   * Format distance for display
   * @param meters - Distance in meters
   * @returns Formatted string (e.g., "250m" or "1.5km")
   */
  const formatDistance = useCallback((meters: number): string => {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${formatarDecimal(meters / 1000)}km`;
  }, []);

  /**
   * Format duration for display
   * @param seconds - Duration in seconds
   * @returns Formatted string (e.g., "5 min" or "1h 30 min")
   */
  const formatDuration = useCallback((seconds: number): string => {
    const minutes = Math.ceil(seconds / 60);
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins} min` : `${hours}h`;
  }, []);

  /**
   * Get icon name for maneuver type
   * @param maneuver - Maneuver type from navigation service
   * @returns Ionicon name for the maneuver
   */
  const getManeuverIcon = useCallback(
    (maneuver: string | undefined): IconName => {
      if (!maneuver) return 'arrow-up';

      switch (maneuver) {
        case 'turn-right':
        case 'turn-slight-right':
          return 'arrow-forward';
        case 'turn-left':
        case 'turn-slight-left':
          return 'arrow-back';
        case 'turn-sharp-right':
          return 'return-down-forward';
        case 'turn-sharp-left':
          return 'return-down-back';
        case 'uturn-right':
        case 'uturn-left':
          return 'return-up-back';
        case 'roundabout-right':
        case 'roundabout-left':
          return 'sync';
        case 'merge':
          return 'git-merge';
        case 'fork-right':
        case 'fork-left':
          return 'git-branch';
        case 'ramp-right':
        case 'ramp-left':
          return 'trending-up';
        case 'keep-right':
        case 'keep-left':
          return 'arrow-forward';
        case 'arrive':
          return 'flag';
        case 'depart':
        case 'straight':
        default:
          return 'arrow-up';
      }
    },
    [],
  );

  return {
    formatDistance,
    formatDuration,
    getManeuverIcon,
  };
}
