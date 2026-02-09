/**
 * Hook to compute historico metrics from route data
 */

import { useMemo } from 'react';

import { parseLocalDate } from '@/lib/dateUtils';

import type { Metricas, RotaHistorico } from './types';

const emptyMetrics: Metricas = {
  rotasTotais: 0,
  rotasConcluidas: 0,
  rotasMes: 0,
  paradasTotais: 0,
  paradasConcluidas: 0,
  distanciaTotal: 0,
  tempoMedioMinutos: 0,
  taxaSucesso: 0,
};

export function useHistoricoMetrics(rotas: RotaHistorico[]): Metricas {
  return useMemo((): Metricas => {
    if (rotas.length === 0) return emptyMetrics;

    const agora = new Date();
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);

    let totalParadas = 0;
    let paradasConcluidas = 0;
    let distanciaTotal = 0;
    let tempoTotalMinutos = 0;
    let rotasComTempo = 0;
    let rotasMes = 0;
    let rotasConcluidas = 0;

    rotas.forEach((rota) => {
      totalParadas += rota.paradas_count || 0;
      paradasConcluidas += rota.paradas_concluidas || 0;
      distanciaTotal += rota.distancia_total || 0;

      if (rota.status === 'concluida') {
        rotasConcluidas++;
      }

      const dataRota = parseLocalDate(rota.data);
      if (dataRota && dataRota >= inicioMes) {
        rotasMes++;
      }

      if (rota.iniciada_em && rota.concluida_em) {
        const inicio = new Date(rota.iniciada_em);
        const fim = new Date(rota.concluida_em);
        const diffMinutos = (fim.getTime() - inicio.getTime()) / (1000 * 60);
        if (diffMinutos > 0 && diffMinutos < 1440) {
          tempoTotalMinutos += diffMinutos;
          rotasComTempo++;
        }
      }
    });

    const taxaSucesso =
      totalParadas > 0 ? Math.round((paradasConcluidas / totalParadas) * 100) : 0;

    const tempoMedioMinutos =
      rotasComTempo > 0 ? Math.round(tempoTotalMinutos / rotasComTempo) : 0;

    return {
      rotasTotais: rotas.length,
      rotasConcluidas,
      rotasMes,
      paradasTotais: totalParadas,
      paradasConcluidas,
      distanciaTotal: Math.round(distanciaTotal * 10) / 10,
      tempoMedioMinutos,
      taxaSucesso,
    };
  }, [rotas]);
}
