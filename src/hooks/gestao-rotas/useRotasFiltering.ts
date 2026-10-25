/**
 * Estado dos filtros da Gestão de Rotas e a ordenação das rotas carregadas.
 *
 * O filtro de status e a busca NÃO filtram aqui: vão ao servidor
 * (`src/lib/gestor/consultaRotas.ts`), para cobrir as rotas que não estão
 * carregadas na lista. Este hook guarda o que o gestor escolheu (a busca com
 * debounce) e ordena as linhas pela coluna clicada — a mesma ordenação vale
 * para a exportação (`ordenarRotas`).
 */

import { useState, useMemo, useCallback } from 'react';

import { useDebounce } from '@/hooks/useDebounce';
import type { FiltroStatus } from '@/lib/statusLabels';

import type { RotaHistorico, RotaStatus } from './types';

interface UseRotasFilteringOptions {
  rotas: RotaHistorico[];
}

interface UseRotasFilteringResult {
  rotasFiltradas: RotaHistorico[];
  filtroStatus: FiltroStatus;
  setFiltroStatus: (status: FiltroStatus) => void;
  searchQuery: string;
  /** A busca depois do debounce: é ela que vai ao servidor. */
  buscaAplicada: string;
  setSearchQuery: (query: string) => void;
  sortColumn: string;
  sortDirection: 'asc' | 'desc';
  handleSort: (column: string, direction: 'asc' | 'desc') => void;
}

// Status priority for sorting
const STATUS_ORDER: Record<RotaStatus, number> = {
  em_andamento: 0,
  pendente: 1,
  concluida: 2,
  cancelada: 3,
  nao_executada: 4,
};

/** Ordena pela coluna escolhida; empate pelo início, mais recente antes. */
export function ordenarRotas(
  rotas: RotaHistorico[],
  sortColumn: string,
  sortDirection: 'asc' | 'desc',
): RotaHistorico[] {
  return [...rotas].sort((a, b) => {
    let comparison: number;

    switch (sortColumn) {
      case 'data':
        comparison = a.data.localeCompare(b.data);
        break;
      case 'motorista': {
        const nomeA = a.motorista_nome?.toLowerCase() || '';
        const nomeB = b.motorista_nome?.toLowerCase() || '';
        comparison = nomeA.localeCompare(nomeB);
        break;
      }
      case 'status': {
        comparison =
          (STATUS_ORDER[a.status] || 99) - (STATUS_ORDER[b.status] || 99);
        break;
      }
      default:
        comparison = 0;
    }

    comparison = sortDirection === 'asc' ? comparison : -comparison;

    // Secondary sort: by start time (on tie), always most recent first
    if (comparison === 0) {
      const inicioA = a.iniciada_em || '';
      const inicioB = b.iniciada_em || '';
      comparison = inicioB.localeCompare(inicioA);
    }

    return comparison;
  });
}

export function useRotasFiltering({
  rotas,
}: UseRotasFilteringOptions): UseRotasFilteringResult {
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todas');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortColumn, setSortColumn] = useState<string>('data');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Debounce: uma consulta ao servidor por pausa na digitação, não por tecla.
  const buscaAplicada = useDebounce(searchQuery, 300);

  const rotasFiltradas = useMemo(
    () => ordenarRotas(rotas, sortColumn, sortDirection),
    [rotas, sortColumn, sortDirection],
  );

  const handleSort = useCallback(
    (column: string, direction: 'asc' | 'desc') => {
      setSortColumn(column);
      setSortDirection(direction);
    },
    [],
  );

  return {
    rotasFiltradas,
    filtroStatus,
    setFiltroStatus,
    searchQuery,
    buscaAplicada,
    setSearchQuery,
    sortColumn,
    sortDirection,
    handleSort,
  };
}
