/**
 * useMotoristaStats
 *
 * Hook for loading motorista statistics (yesterday and today)
 */

import { useCallback, useRef, useState } from 'react';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

import { initialStats, type MotoristaStats } from './types';

interface UseMotoristaStatsReturn {
  stats: MotoristaStats;
  loadYesterdayStats: () => Promise<void>;
  loadTodayStats: () => Promise<void>;
}

/**
 * Conta as paradas concluídas das rotas no servidor (`count: 'exact', head`):
 * `select('id')` devolvia as linhas, e o PostgREST corta qualquer resposta em
 * 1.000 sem erro — o contador parava em 1.000. `null` = a consulta falhou.
 *
 * Alternativa descartada: a RPC `resumo_desempenho_motorista`. Ela recorta por
 * `rotas.data` em dias corridos (7/30/todos), e aqui o recorte é por
 * `concluida_em` (ontem x hoje), que a janela da RPC não expressa.
 */
async function contarParadasConcluidas(
  rotaIds: string[],
): Promise<number | null> {
  const { count, error } = await supabase
    .from('paradas')
    .select('id', { count: 'exact', head: true })
    .in('rota_id', rotaIds)
    .eq('status', 'concluida');
  if (error) return null;
  return count ?? 0;
}

/**
 * Hook that manages motorista statistics for yesterday and today
 */
export function useMotoristaStats(
  motoristaId?: string,
): UseMotoristaStatsReturn {
  const [stats, setStats] = useState<MotoristaStats>(initialStats);
  // Só a carga mais recente de cada janela escreve: o refresh com outro em voo
  // (ou a troca de motorista) deixava a resposta velha chegar por último.
  const requisicaoOntemRef = useRef(0);
  const requisicaoHojeRef = useRef(0);

  /**
   * Load yesterday's completed routes and stops stats
   */
  const loadYesterdayStats = useCallback(async () => {
    const minha = ++requisicaoOntemRef.current;
    const vigente = () => minha === requisicaoOntemRef.current;
    if (!motoristaId) return;

    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get yesterday's completed routes
      const { data: rotas, error } = await supabase
        .from('rotas')
        .select('id, distancia_total')
        .eq('motorista_id', motoristaId)
        .eq('status', 'concluida')
        .gte('concluida_em', yesterday.toISOString())
        .lt('concluida_em', today.toISOString());

      if (error) throw error;

      const rotasCount = rotas?.length || 0;
      const distanciaTotal =
        rotas?.reduce((sum, r) => sum + (r.distancia_total || 0), 0) || 0;

      // Get yesterday's completed stops
      if (rotas && rotas.length > 0) {
        const paradasCount = await contarParadasConcluidas(
          rotas.map((r) => r.id),
        );
        if (!vigente()) return;

        if (paradasCount !== null) {
          setStats((prev) => ({
            ...prev,
            rotasOntem: rotasCount,
            paradasOntem: paradasCount,
            distanciaOntem: Math.round(distanciaTotal),
          }));
        }
      } else {
        if (!vigente()) return;
        setStats((prev) => ({
          ...prev,
          rotasOntem: 0,
          paradasOntem: 0,
          distanciaOntem: 0,
        }));
      }
    } catch (error) {
      logger.error('Error loading yesterday stats:', error);
    }
  }, [motoristaId]);

  /**
   * Load today's completed routes and stops stats
   */
  const loadTodayStats = useCallback(async () => {
    const minha = ++requisicaoHojeRef.current;
    const vigente = () => minha === requisicaoHojeRef.current;
    if (!motoristaId) return;

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get today's completed routes
      const { data: rotas, error } = await supabase
        .from('rotas')
        .select('id, distancia_total')
        .eq('motorista_id', motoristaId)
        .eq('status', 'concluida')
        .gte('concluida_em', today.toISOString());

      if (error) throw error;

      const rotasCount = rotas?.length || 0;
      const distanciaTotal =
        rotas?.reduce((sum, r) => sum + (r.distancia_total || 0), 0) || 0;

      // Get today's completed stops
      let paradasCount = 0;
      if (rotas && rotas.length > 0) {
        paradasCount =
          (await contarParadasConcluidas(rotas.map((r) => r.id))) ?? 0;
      }
      if (!vigente()) return;

      setStats((prev) => ({
        ...prev,
        rotasHoje: rotasCount,
        paradasHoje: paradasCount,
        distanciaHoje: Math.round(distanciaTotal),
      }));
    } catch (error) {
      logger.error('Error loading today stats:', error);
    }
  }, [motoristaId]);

  return {
    stats,
    loadYesterdayStats,
    loadTodayStats,
  };
}
