/**
 * Incident management hooks - barrel export
 */

export type {
  Incidente,
  FiltroStatus,
  FiltroCategoria,
  CategoriaLabel,
  StatusLabel,
  EstatisticaMotorista,
  ResumoGeral,
} from './types';

export { createCategoriaLabels, createStatusLabels, formatIncidentDate } from './constants';
export { useIncidentesStats } from './useIncidentesStats';
export { useIncidentesModals } from './useIncidentesModals';
