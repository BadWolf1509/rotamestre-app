/**
 * Hook for computing incident statistics
 */

import { useMemo } from 'react';

import type { Incidente, EstatisticaMotorista, ResumoGeral } from './types';

interface UseIncidentesStatsOptions {
  incidentes: Incidente[];
}

interface UseIncidentesStatsResult {
  estatisticasMotorista: EstatisticaMotorista[];
  resumoGeral: ResumoGeral;
}

/**
 * Computes driver statistics and general summary from incidents
 */
export function useIncidentesStats({
  incidentes,
}: UseIncidentesStatsOptions): UseIncidentesStatsResult {
  // Driver statistics - top 5 drivers by incident count
  const estatisticasMotorista = useMemo(() => {
    const stats: Record<
      string,
      { nome: string; total: number; abertos: number; resolvidos: number }
    > = {};

    incidentes.forEach((inc) => {
      // Conta excluída (motorista_id NULL): todos num grupo só, sem id real.
      const chave = inc.motorista_id ?? 'removido';
      if (!stats[chave]) {
        stats[chave] = {
          nome: inc.motorista_nome,
          total: 0,
          abertos: 0,
          resolvidos: 0,
        };
      }
      stats[chave].total++;
      if (inc.status === 'aberto' || inc.status === 'em_analise') {
        stats[chave].abertos++;
      }
      if (inc.status === 'resolvido' || inc.status === 'fechado') {
        stats[chave].resolvidos++;
      }
    });

    return Object.entries(stats)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [incidentes]);

  // General summary - counts by status and category
  const resumoGeral = useMemo(() => {
    const abertos = incidentes.filter((i) => i.status === 'aberto').length;
    const emAnalise = incidentes.filter((i) => i.status === 'em_analise').length;
    const resolvidos = incidentes.filter((i) => i.status === 'resolvido').length;
    const fechados = incidentes.filter((i) => i.status === 'fechado').length;

    const porCategoria: Record<string, number> = {};
    incidentes.forEach((inc) => {
      porCategoria[inc.categoria] = (porCategoria[inc.categoria] || 0) + 1;
    });

    return {
      total: incidentes.length,
      abertos,
      emAnalise,
      resolvidos,
      fechados,
      porCategoria,
    };
  }, [incidentes]);

  return {
    estatisticasMotorista,
    resumoGeral,
  };
}
