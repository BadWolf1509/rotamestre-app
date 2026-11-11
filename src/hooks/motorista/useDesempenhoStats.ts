/**
 * Hook for loading driver performance statistics.
 * Os totais vêm de `buscarResumoDesempenho` (RPC da Migration 55).
 *
 * Período: o escolhido (lembrado no aparelho) com o fim cortado em hoje — as
 * rotas agendadas para dias que ainda não chegaram baixariam a taxa o mês
 * inteiro. Período que começa depois de hoje não consulta: `periodoVazio`.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

import { usePeriodoLembrado } from '@/hooks/usePeriodoLembrado';
import { logger } from '@/lib/logger';
import { buscarResumoDesempenho } from '@/lib/motorista/resumoDesempenho';
import {
  cortarEmHoje,
  resolverPeriodo,
  textoPeriodo,
  type Periodo,
} from '@/lib/periodo';

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

export interface UseDesempenhoStatsReturn {
  stats: PerformanceStats | null;
  loading: boolean;
  refreshing: boolean;
  periodo: Periodo;
  definirPeriodo: (p: Periodo) => void;
  /** Texto do período já cortado em hoje, p.ex. "Este mês (01/11 a 10/11)". */
  textoDoPeriodo: string;
  /** O período começa depois de hoje: nada foi consultado. */
  periodoVazio: boolean;
  refresh: () => void;
  error: string | null;
}

export function useDesempenhoStats(
  userId: string | undefined,
): UseDesempenhoStatsReturn {
  const [stats, setStats] = useState<PerformanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { periodo, definirPeriodo, carregado } = usePeriodoLembrado(
    'desempenho_motorista',
  );
  // Strings (não o objeto) nas dependências: o objeto muda de identidade a
  // cada render e refaria a consulta em laço.
  const intervalo = cortarEmHoje(resolverPeriodo(periodo));
  const periodoVazio = intervalo === null;
  const de = intervalo?.de ?? null;
  const ate = intervalo?.ate ?? null;
  const textoDoPeriodo = textoPeriodo(periodo, intervalo ?? undefined);
  const [error, setError] = useState<string | null>(null);

  // Só a carga mais recente escreve: a troca rápida 7d/30d/todos deixa
  // respostas em voo, e a mais lenta (a velha) chegava por último.
  const requisicaoRef = useRef(0);

  const loadStats = useCallback(async () => {
    const minha = ++requisicaoRef.current;
    const vigente = () => minha === requisicaoRef.current;

    // Período lembrado ainda lendo do aparelho: o padrão provisório não vale.
    if (!carregado) return;

    if (!userId || periodoVazio) {
      setStats(null);
      setError(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setError(null);

      // Totais somados no servidor (Migration 55): a busca antiga de todas as
      // paradas por `.in('rota_id', todas)` era cortada em 1.000 linhas pelo
      // PostgREST. O período é sobre `rotas.data` (o dia em que a rota roda,
      // nunca `created_at`), com o fim já cortado em hoje no aparelho.
      const resumo = await buscarResumoDesempenho(userId, {
        intervalo: { de, ate },
      });
      if (!vigente()) return;

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
      if (!vigente()) return;
      setStats(null);
      setError(
        'Não foi possível carregar suas estatísticas. Puxe para baixo para tentar novamente.',
      );
    } finally {
      if (vigente()) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [userId, carregado, periodoVazio, de, ate]);

  useEffect(() => {
    setLoading(true);
    // Disparo proposital, sem espera: o carregador trata o próprio erro (try/catch com log).
    void loadStats();
  }, [loadStats]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    // Disparo proposital, sem espera: o carregador trata o próprio erro (try/catch com log).
    void loadStats();
  }, [loadStats]);

  return {
    stats,
    loading,
    refreshing,
    periodo,
    definirPeriodo,
    textoDoPeriodo,
    periodoVazio,
    refresh,
    error,
  };
}
