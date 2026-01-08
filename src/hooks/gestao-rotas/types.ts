/**
 * Types for route management hooks
 */

import type { RotaStatus, FiltroStatus } from '@/lib/statusLabels';

export type { RotaStatus, FiltroStatus };

/**
 * Route history item from database
 */
export interface RotaHistorico {
  id: string;
  data: string;
  status: RotaStatus;
  distancia_total?: number;
  iniciada_em?: string;
  concluida_em?: string;
  motorista_id?: string;
  motorista_nome?: string;
  paradas_count: number;
  paradas_concluidas: number;
}

/**
 * Cached routes structure
 */
export interface CachedRotas {
  data: RotaHistorico[];
  timestamp: number;
}

/**
 * Sort configuration
 */
export interface SortConfig {
  column: string;
  direction: 'asc' | 'desc';
}
