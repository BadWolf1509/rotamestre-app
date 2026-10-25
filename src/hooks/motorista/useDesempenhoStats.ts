/**
 * Hook for loading driver performance statistics.
 * Os totais vêm de `buscarResumoDesempenho` (RPC da Migration 55).
 */

import { useState, useEffect, useCallback } from 'react';

import { logger } from '@/lib/logger';
import { buscarResumoDesempenho } from '@/lib/motorista/resumoDesempenho';

export interface PerformanceStats {
  totalRotas: number;
  rotasConcluidas: number;
  rotasCanceladas: number;
  taxaSucesso: number;
  totalKm: number;
  mediaParadasPorRota: number;
  totalParadas: number;
  paradasConcluidas: number;
  paradasPuladas: number;
}

export type Periodo = '7d' | '30d' | 'all';

export interface UseDesempenhoStatsReturn {
  stats: PerformanceStats | null;
  loading: boolean;
  refreshing: boolean;
  periodo: Periodo;
  setPeriodo: (p: Periodo) => void;
  refresh: () => void;
  error: string | null;
}

export function useDesempenhoStats(
  userId: string | undefined,
): UseDesempenhoStatsReturn {
  const [stats, setStats] = useState<PerformanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [periodo, setPeriodo] = useState<Periodo>('30d');
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    if (!userId) {
      setStats(null);
      setLoading(false);
      return;
    }

    try {
      setError(null);

      // Totais somados no servidor (Migration 55): a busca antiga de todas as
      // paradas por `.in('rota_id', todas)` era cortada em 1.000 linhas pelo
      // PostgREST. O período é em dias corridos sobre `rotas.data` (o dia em
      // que a rota roda, nunca `created_at`), contados de hoje no fuso do
      // Brasil — ver `buscarResumoDesempenho`.
      const dias = periodo === '7d' ? 7 : periodo === '30d' ? 30 : null;
      const resumo = await buscarResumoDesempenho(userId, dias);

      const {
        totalRotas,
        rotasConcluidas,
        rotasCanceladas,
        totalParadas,
        paradasConcluidas,
        paradasPuladas,
      } = resumo;
      const taxaSucesso =
        totalRotas > 0 ? Math.round((rotasConcluidas / totalRotas) * 100) : 0;
      const totalKm = resumo.distanciaTotal;
      const mediaParadasPorRota =
        totalRotas > 0 ? Math.round(totalParadas / totalRotas) : 0;

      setStats({
        totalRotas,
        rotasConcluidas,
        rotasCanceladas,
        taxaSucesso,
        totalKm,
        mediaParadasPorRota,
        totalParadas,
        paradasConcluidas,
        paradasPuladas,
      });
    } catch (err: unknown) {
      logger.error('Erro ao carregar estatisticas:', err);
      setStats(null);
      setError(
        'Não foi possível carregar suas estatísticas. Puxe para baixo para tentar novamente.',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, periodo]);

  useEffect(() => {
    setLoading(true);
    loadStats();
  }, [loadStats]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    loadStats();
  }, [loadStats]);

  return {
    stats,
    loading,
    refreshing,
    periodo,
    setPeriodo,
    refresh,
    error,
  };
}
