/**
 * Route Filters - Types
 *
 * Shared type definitions for route filtering components.
 */

import type { Periodo } from '@/lib/periodo';

/** Status e motorista; o período vive à parte (`usePeriodoLembrado`). */
export interface RouteFiltersState {
  status?: 'pendente' | 'em_andamento' | 'concluida' | 'cancelada' | null;
  motoristaId?: string | null;
}

export interface Motorista {
  id: string;
  nome: string;
}

export interface RouteFiltersProps {
  filters: RouteFiltersState;
  onFiltersChange: (filters: RouteFiltersState) => void;
  /** Período escolhido (o seletor no lugar do antigo "Selecionar período"). */
  periodo: Periodo;
  onPeriodoChange: (periodo: Periodo) => void;
  motoristas?: Motorista[];
  variant?: 'desktop' | 'mobile';
}

export interface StatusOption {
  value: RouteFiltersState['status'];
  label: string;
}
