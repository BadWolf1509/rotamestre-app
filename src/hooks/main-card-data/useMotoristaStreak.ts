/**
 * useMotoristaStreak
 *
 * Hook for calculating consecutive days with completed routes
 */

import { useCallback, useState } from 'react';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

interface UseMotoristaStreakReturn {
  streak: number;
  loadStreak: () => Promise<void>;
}

/**
 * Hook that calculates the motorista's streak (consecutive days with at least 1 completed route)
 */
export function useMotoristaStreak(motoristaId?: string): UseMotoristaStreakReturn {
  const [streak, setStreak] = useState(0);

  /**
   * Load streak - consecutive days with at least 1 completed route
   */
  const loadStreak = useCallback(async () => {
    if (!motoristaId) return;

    try {
      // Get last 30 days of completed routes
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      thirtyDaysAgo.setHours(0, 0, 0, 0);

      const { data: rotas, error } = await supabase
        .from('rotas')
        .select('concluida_em')
        .eq('motorista_id', motoristaId)
        .eq('status', 'concluida')
        .gte('concluida_em', thirtyDaysAgo.toISOString())
        .order('concluida_em', { ascending: false });

      if (error) throw error;

      // Calculate consecutive days with at least 1 route
      let currentStreak = 0;
      const checkDate = new Date();
      checkDate.setHours(0, 0, 0, 0);

      const routeDates = new Set(
        rotas?.map(r => new Date(r.concluida_em).toDateString()) || []
      );

      while (routeDates.has(checkDate.toDateString())) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      }

      setStreak(currentStreak);
    } catch (error) {
      logger.error('Error loading streak:', error);
    }
  }, [motoristaId]);

  return {
    streak,
    loadStreak,
  };
}
