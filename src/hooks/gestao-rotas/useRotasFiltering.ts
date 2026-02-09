/**
 * Hook for route filtering and sorting logic
 */

import { useState, useMemo, useCallback } from 'react';

import { useDebounce } from '@/hooks/useDebounce';
import { formatDateBR } from '@/lib/dateUtils';
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

/**
 * Manages filtering and sorting of routes
 */
export function useRotasFiltering({
  rotas,
}: UseRotasFilteringOptions): UseRotasFilteringResult {
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todas');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortColumn, setSortColumn] = useState<string>('data');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Debounce search to avoid excessive filtering
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Filter and sort routes
  const rotasFiltradas = useMemo(() => {
    let resultado = [...rotas];

    // Filter by status
    if (filtroStatus !== 'todas') {
      resultado = resultado.filter((rota) => rota.status === filtroStatus);
    }

    // Filter by text search
    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase().trim();
      resultado = resultado.filter((rota) => {
        const motoristaNome = rota.motorista_nome?.toLowerCase() || '';
        const dataFormatada = formatDateBR(rota.data).toLowerCase();
        return motoristaNome.includes(query) || dataFormatada.includes(query);
      });
    }

    // Sort results
    resultado.sort((a, b) => {
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

      // Apply sort direction
      comparison = sortDirection === 'asc' ? comparison : -comparison;

      // Secondary sort: by start time (on tie)
      if (comparison === 0) {
        const inicioA = a.iniciada_em || '';
        const inicioB = b.iniciada_em || '';
        // Secondary always DESC (most recent first)
        comparison = inicioB.localeCompare(inicioA);
      }

      return comparison;
    });

    return resultado;
  }, [rotas, filtroStatus, debouncedSearchQuery, sortColumn, sortDirection]);

  const handleSort = useCallback((column: string, direction: 'asc' | 'desc') => {
    setSortColumn(column);
    setSortDirection(direction);
  }, []);

  return {
    rotasFiltradas,
    filtroStatus,
    setFiltroStatus,
    searchQuery,
    setSearchQuery,
    sortColumn,
    sortDirection,
    handleSort,
  };
}
