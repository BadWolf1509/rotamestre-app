/**
 * useMainCardData
 *
 * Orchestrator hook that composes all main card data sub-hooks.
 * Manages loading state and provides a unified refresh function.
 */

import { useCallback, useEffect, useState } from 'react';

import { useExpiredRoute } from './useExpiredRoute';
import { useLastRoute } from './useLastRoute';
import { useMotoristaStats } from './useMotoristaStats';
import { useMotoristaStreak } from './useMotoristaStreak';

import type { UseMainCardDataOptions, UseMainCardDataReturn } from './types';

/**
 * Main hook that orchestrates all main card data loading
 */
export function useMainCardData({
  motoristaId,
  state,
}: UseMainCardDataOptions): UseMainCardDataReturn {
  const [isLoading, setIsLoading] = useState(false);

  // Compose sub-hooks
  const { stats, loadYesterdayStats, loadTodayStats } = useMotoristaStats(motoristaId);
  const { streak, loadStreak } = useMotoristaStreak(motoristaId);
  const { lastRoute, loadLastRoute } = useLastRoute(motoristaId);
  const { expiredRoute, expiredRouteDismissed, loadExpiredRoute, dismissExpiredRoute } =
    useExpiredRoute(motoristaId);

  /**
   * Combined refresh function that loads all data in parallel
   */
  const refresh = useCallback(async () => {
    if (!motoristaId) return;

    setIsLoading(true);
    try {
      await Promise.all([
        loadYesterdayStats(),
        loadTodayStats(),
        loadStreak(),
        loadLastRoute(),
        loadExpiredRoute(),
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [loadYesterdayStats, loadTodayStats, loadStreak, loadLastRoute, loadExpiredRoute, motoristaId]);

  // Load data based on state
  useEffect(() => {
    if (state === 'no-route' && motoristaId) {
      refresh();
    } else if (state === 'completed' && motoristaId) {
      // Also load streak when completed
      loadStreak();
    }
  }, [state, motoristaId, refresh, loadStreak]);

  return {
    stats,
    streak,
    lastRoute,
    expiredRoute,
    expiredRouteDismissed,
    dismissExpiredRoute,
    refresh,
    isLoading,
  };
}
