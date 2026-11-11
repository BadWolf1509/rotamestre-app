/**
 * Filtros do Histórico: o período (lembrado no aparelho) e o status.
 *
 * Os dois vão ao banco (`useHistoricoData`); aqui não se filtra lista alguma.
 * `de`/`ate` saem como strings: o objeto do intervalo muda de identidade a
 * cada render e, nas dependências de efeito, refaria a consulta em laço.
 * O Histórico é lista: o período vai inteiro, sem corte em hoje.
 */

import { useState } from 'react';

import { usePeriodoLembrado } from '@/hooks/usePeriodoLembrado';
import { resolverPeriodo, textoPeriodo, type Periodo } from '@/lib/periodo';

import type { FiltroStatus } from './types';

interface UseHistoricoFiltersReturn {
  filtroStatus: FiltroStatus;
  setFiltroStatus: (f: FiltroStatus) => void;
  periodo: Periodo;
  definirPeriodo: (p: Periodo) => void;
  /** O período lembrado já foi lido do aparelho: só então se consulta. */
  carregado: boolean;
  de: string | null;
  ate: string | null;
  /** "Este mês (01/11 a 30/11)". */
  textoDoPeriodo: string;
}

export function useHistoricoFilters(): UseHistoricoFiltersReturn {
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todos');
  const { periodo, definirPeriodo, carregado } = usePeriodoLembrado(
    'historico_motorista',
  );
  const intervalo = resolverPeriodo(periodo);

  return {
    filtroStatus,
    setFiltroStatus,
    periodo,
    definirPeriodo,
    carregado,
    de: intervalo.de,
    ate: intervalo.ate,
    textoDoPeriodo: textoPeriodo(periodo, intervalo),
  };
}
