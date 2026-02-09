/**
 * Historico hooks - Barrel export
 */

export { useHistoricoData } from './useHistoricoData';
export { useHistoricoFilters } from './useHistoricoFilters';
export { useHistoricoMetrics } from './useHistoricoMetrics';
export { calcularTempoTotal, formatarTempo } from './utils';
export type {
  FiltroPeriodo,
  FiltroStatus,
  Metricas,
  RotaHistorico,
} from './types';
