/**
 * Route Filters - Types
 *
 * Shared type definitions for route filtering components.
 */

// Tipos para períodos pré-definidos
export type PeriodPreset = 'hoje' | 'ultima_semana' | 'ultimo_mes' | 'este_mes' | 'personalizado';

export interface RouteFiltersState {
  status?: 'pendente' | 'em_andamento' | 'concluida' | 'cancelada' | null;
  dataInicio?: Date | null;
  dataFim?: Date | null;
  motoristaId?: string | null;
}

export interface Motorista {
  id: string;
  nome: string;
}

export interface RouteFiltersProps {
  filters: RouteFiltersState;
  onFiltersChange: (filters: RouteFiltersState) => void;
  motoristas?: Motorista[];
  variant?: 'desktop' | 'mobile';
}

export interface StatusOption {
  value: RouteFiltersState['status'];
  label: string;
  color: string | undefined;
}
