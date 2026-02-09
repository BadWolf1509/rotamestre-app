/**
 * Hook to manage filter state and computed filtered routes
 */

import { useMemo, useState } from 'react';

import { parseLocalDate } from '@/lib/dateUtils';

import type { FiltroPeriodo, FiltroStatus, RotaHistorico } from './types';

interface UseHistoricoFiltersReturn {
  filtroStatus: FiltroStatus;
  setFiltroStatus: (f: FiltroStatus) => void;
  filtroPeriodo: FiltroPeriodo;
  setFiltroPeriodo: (f: FiltroPeriodo) => void;
  rotasFiltradas: RotaHistorico[];
}

export function useHistoricoFilters(rotas: RotaHistorico[]): UseHistoricoFiltersReturn {
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todos');
  const [filtroPeriodo, setFiltroPeriodo] = useState<FiltroPeriodo>('todos');

  const rotasFiltradas = useMemo(() => {
    let resultado = [...rotas];

    if (filtroStatus !== 'todos') {
      resultado = resultado.filter((r) => r.status === filtroStatus);
    }

    if (filtroPeriodo !== 'todos') {
      const agora = new Date();
      const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());

      resultado = resultado.filter((r) => {
        const dataRota = parseLocalDate(r.data);
        if (!dataRota) return false;

        switch (filtroPeriodo) {
          case 'hoje':
            return dataRota >= hoje;
          case 'semana': {
            const inicioSemana = new Date(hoje);
            inicioSemana.setDate(hoje.getDate() - hoje.getDay());
            return dataRota >= inicioSemana;
          }
          case 'mes': {
            const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
            return dataRota >= inicioMes;
          }
          default:
            return true;
        }
      });
    }

    return resultado;
  }, [rotas, filtroStatus, filtroPeriodo]);

  return {
    filtroStatus,
    setFiltroStatus,
    filtroPeriodo,
    setFiltroPeriodo,
    rotasFiltradas,
  };
}
