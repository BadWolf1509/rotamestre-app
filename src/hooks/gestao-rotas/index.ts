/**
 * Route management hooks - barrel export
 */

export { useRotasCache } from './useRotasCache';
export { useRotasFiltering, ordenarRotas } from './useRotasFiltering';
export { useTimelineData } from './useTimelineData';
export type { UseTimelineDataResult } from './useTimelineData';
export { exportRotasToCSV } from './routeExport';
export { exportRotasToXLSX } from './routeExportXLSX';
export type {
  RotaHistorico,
  RotaStatus,
  FiltroStatus,
  CachedRotas,
  SortConfig,
} from './types';
