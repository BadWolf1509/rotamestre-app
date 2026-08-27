/**
 * Main Card Data - Shared Types
 *
 * Types and interfaces used by the main card data hooks
 */

import type { RouteStatus } from '@/context/RouteStatusContext';

/**
 * Stats for completed routes and stops
 */
export interface MotoristaStats {
  rotasOntem: number;
  paradasOntem: number;
  distanciaOntem: number;
  rotasHoje: number;
  paradasHoje: number;
  distanciaHoje: number;
}

/**
 * Data for the last completed route
 */
export interface LastRouteData {
  concluida_em: string;
  paradas_concluidas: number;
  total_paradas: number;
  distancia_km: number;
  tempo_total: string;
}

/**
 * Data for an expired route
 */
export interface ExpiredRouteData {
  rota_id: string;
  data: string;
  paradas_pendentes: number;
  total_paradas: number;
  paradas_concluidas: number;
  /** Momento em que a rota foi expirada (ISO). Ausente = horário desconhecido. */
  expirada_em?: string;
}

/**
 * Options for useMainCardData hook
 */
export interface UseMainCardDataOptions {
  motoristaId?: string;
  state: RouteStatus;
}

/**
 * Return type for useMainCardData hook
 */
export interface UseMainCardDataReturn {
  stats: MotoristaStats;
  streak: number;
  lastRoute: LastRouteData | null;
  expiredRoute: ExpiredRouteData | null;
  expiredRouteDismissed: boolean;
  dismissExpiredRoute: () => void;
  refresh: () => Promise<void>;
  isLoading: boolean;
}

/**
 * Initial empty stats
 */
export const initialStats: MotoristaStats = {
  rotasOntem: 0,
  paradasOntem: 0,
  distanciaOntem: 0,
  rotasHoje: 0,
  paradasHoje: 0,
  distanciaHoje: 0,
};
