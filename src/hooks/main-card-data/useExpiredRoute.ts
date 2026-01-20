/**
 * useExpiredRoute
 *
 * Hook for loading expired routes (within last 24h)
 */

import { useCallback, useState } from 'react';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

import type { ExpiredRouteData } from './types';

interface UseExpiredRouteReturn {
  expiredRoute: ExpiredRouteData | null;
  expiredRouteDismissed: boolean;
  loadExpiredRoute: () => Promise<void>;
  dismissExpiredRoute: () => void;
}

/**
 * Hook that loads the last expired route within 24h
 */
export function useExpiredRoute(motoristaId?: string): UseExpiredRouteReturn {
  const [expiredRoute, setExpiredRoute] = useState<ExpiredRouteData | null>(null);
  const [expiredRouteDismissed, setExpiredRouteDismissed] = useState(false);

  /**
   * Load last expired route within 24h
   */
  const loadExpiredRoute = useCallback(async () => {
    if (!motoristaId) return;

    try {
      // Get date 24h ago
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      // Find last expired route within 24h
      const { data: rota, error } = await supabase
        .from('rotas')
        .select('id, data, updated_at')
        .eq('motorista_id', motoristaId)
        .eq('status', 'nao_executada')
        .gte('data', yesterday.toISOString().split('T')[0])
        .order('data', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !rota) {
        setExpiredRoute(null);
        return;
      }

      // Get stops for this route
      const { data: paradasData, error: paradasError } = await supabase
        .from('paradas')
        .select('status, is_checkpoint')
        .eq('rota_id', rota.id);

      if (paradasError) {
        setExpiredRoute(null);
        return;
      }

      // Filter real stops (not checkpoints)
      const paradasReais = paradasData?.filter(p => p.is_checkpoint !== false) || [];
      const totalParadas = paradasReais.length;
      const paradasConcluidas = paradasReais.filter(p => p.status === 'concluida').length;
      const paradasPendentes = totalParadas - paradasConcluidas;

      setExpiredRoute({
        rota_id: rota.id,
        data: rota.data,
        paradas_pendentes: paradasPendentes,
        total_paradas: totalParadas,
        paradas_concluidas: paradasConcluidas,
      });
    } catch (error) {
      logger.error('Error loading expired route:', error);
      setExpiredRoute(null);
    }
  }, [motoristaId]);

  /**
   * Dismiss the expired route notification
   */
  const dismissExpiredRoute = useCallback(() => {
    setExpiredRouteDismissed(true);
  }, []);

  return {
    expiredRoute,
    expiredRouteDismissed,
    loadExpiredRoute,
    dismissExpiredRoute,
  };
}
