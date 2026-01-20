/**
 * useLastRoute
 *
 * Hook for loading the last completed route of the day
 */

import { useCallback, useState } from 'react';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

import type { LastRouteData } from './types';

interface UseLastRouteReturn {
  lastRoute: LastRouteData | null;
  loadLastRoute: () => Promise<void>;
}

/**
 * Hook that loads the last completed route of the day
 */
export function useLastRoute(motoristaId?: string): UseLastRouteReturn {
  const [lastRoute, setLastRoute] = useState<LastRouteData | null>(null);

  /**
   * Load last completed route today with stats
   */
  const loadLastRoute = useCallback(async () => {
    if (!motoristaId) return;

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get last completed route today
      const { data: rota, error } = await supabase
        .from('rotas')
        .select('id, concluida_em, distancia_total, tempo_total, iniciada_em')
        .eq('motorista_id', motoristaId)
        .eq('status', 'concluida')
        .gte('concluida_em', today.toISOString())
        .order('concluida_em', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !rota) {
        setLastRoute(null);
        return;
      }

      // Get stops for this route (excluding checkpoints - departure/arrival points)
      const { data: paradasData, error: paradasError } = await supabase
        .from('paradas')
        .select('status, is_checkpoint')
        .eq('rota_id', rota.id);

      if (paradasError) {
        setLastRoute(null);
        return;
      }

      // Filter out checkpoints (is_checkpoint: false means it's a checkpoint, not a delivery)
      const deliveryStops = paradasData?.filter(p => p.is_checkpoint !== false) || [];
      const totalParadas = deliveryStops.length;
      const paradasConcluidas = deliveryStops.filter(p => p.status === 'concluida').length;

      // Calculate duration
      let tempoTotal = '--';
      if (rota.iniciada_em && rota.concluida_em) {
        const inicio = new Date(rota.iniciada_em).getTime();
        const fim = new Date(rota.concluida_em).getTime();
        const diffMs = fim - inicio;
        const diffMins = Math.floor(diffMs / 60000);
        const hours = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        if (hours > 0) {
          tempoTotal = `${hours}h ${mins}min`;
        } else {
          tempoTotal = `${mins}min`;
        }
      }

      setLastRoute({
        concluida_em: rota.concluida_em,
        paradas_concluidas: paradasConcluidas,
        total_paradas: totalParadas,
        distancia_km: Math.round(rota.distancia_total || 0),
        tempo_total: tempoTotal,
      });
    } catch (error) {
      logger.error('Error loading last route:', error);
      setLastRoute(null);
    }
  }, [motoristaId]);

  return {
    lastRoute,
    loadLastRoute,
  };
}
