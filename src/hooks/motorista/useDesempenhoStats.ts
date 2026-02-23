/**
 * Hook for loading driver performance statistics.
 * Encapsulates Supabase queries and period filtering.
 */

import { useState, useEffect, useCallback } from 'react';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

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

export function useDesempenhoStats(userId: string | undefined): UseDesempenhoStatsReturn {
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

      // Calcular data de inicio baseado no periodo
      let dataInicio: string | null = null;
      const now = new Date();

      if (periodo === '7d') {
        const date = new Date(now);
        date.setDate(date.getDate() - 7);
        dataInicio = date.toISOString();
      } else if (periodo === '30d') {
        const date = new Date(now);
        date.setDate(date.getDate() - 30);
        dataInicio = date.toISOString();
      }

      // Buscar rotas do motorista
      let rotasQuery = supabase
        .from('rotas')
        .select('id, status, distancia_total')
        .eq('motorista_id', userId);

      if (dataInicio) {
        rotasQuery = rotasQuery.gte('created_at', dataInicio);
      }

      const { data: rotas, error: rotasError } = await rotasQuery;

      if (rotasError) throw rotasError;

      // Calcular estatisticas de rotas
      const rotasData = rotas || [];
      const totalRotas = rotasData.length;
      const rotasConcluidas = rotasData.filter((r) => r.status === 'concluida').length;
      const rotasCanceladas = rotasData.filter((r) => r.status === 'cancelada').length;
      const taxaSucesso = totalRotas > 0 ? Math.round((rotasConcluidas / totalRotas) * 100) : 0;
      const totalKm = rotasData.reduce((acc, r) => acc + (r.distancia_total || 0), 0);

      // Buscar paradas das rotas
      const rotaIds = rotasData.map((r) => r.id);
      let paradasData: { id: string; status: string; rota_id: string }[] = [];

      if (rotaIds.length > 0) {
        const { data: paradas, error: paradasError } = await supabase
          .from('paradas')
          .select('id, status, rota_id')
          .in('rota_id', rotaIds)
          .or('is_checkpoint.is.null,is_checkpoint.eq.true');

        if (paradasError) throw paradasError;
        paradasData = paradas || [];
      }

      const totalParadas = paradasData.length;
      const paradasConcluidas = paradasData.filter((p) => p.status === 'concluida').length;
      const paradasPuladas = paradasData.filter((p) => p.status === 'pulada').length;
      const mediaParadasPorRota = totalRotas > 0 ? Math.round(totalParadas / totalRotas) : 0;

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
      setError('Nao foi possivel carregar suas estatisticas. Puxe para baixo para tentar novamente.');
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
