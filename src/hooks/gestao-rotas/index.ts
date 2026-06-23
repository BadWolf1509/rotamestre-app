/**
 * Route management hooks - barrel export
 */

export { useRotasCache } from './useRotasCache';
export { useRotasFiltering } from './useRotasFiltering';
export { useTimelineData } from './useTimelineData';
export type { UseTimelineDataResult } from './useTimelineData';
export { exportRotasToCSV } from './routeExport';
export { exportRotasToXLSX } from './routeExportXLSX';
export { exportRotaToPDF } from './routeExportPDF';
export type { RotaParaPDF, ParadaParaPDF } from './routeExportPDF';
export type {
  RotaHistorico,
  RotaStatus,
  FiltroStatus,
  CachedRotas,
  SortConfig,
} from './types';
