/**
 * Route Filters - Utilities
 *
 * Helper functions for route filtering.
 */

import type { PeriodPreset, RouteFiltersState } from './types';

/**
 * Calculate date range for a preset period
 */
export const getPresetDates = (preset: PeriodPreset): { startDate: Date; endDate: Date } | null => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  switch (preset) {
    case 'hoje': {
      const endOfDay = new Date(today);
      endOfDay.setHours(23, 59, 59, 999);
      return { startDate: today, endDate: endOfDay };
    }
    case 'ultima_semana': {
      const startDate = new Date(today);
      startDate.setDate(today.getDate() - 7);
      return { startDate, endDate: today };
    }
    case 'ultimo_mes': {
      const startDate = new Date(today);
      startDate.setDate(today.getDate() - 30);
      return { startDate, endDate: today };
    }
    case 'este_mes': {
      const startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      return { startDate, endDate: today };
    }
    case 'personalizado':
    default:
      return null;
  }
};

/**
 * Format date for display
 */
export const formatDate = (date: Date | null | undefined): string => {
  if (!date) return 'Selecionar';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

/**
 * Get label for date range
 */
export const getRangeLabel = (dataInicio: Date | null | undefined, dataFim: Date | null | undefined): string => {
  if (dataInicio && dataFim) {
    return `${formatDate(dataInicio)} - ${formatDate(dataFim)}`;
  }
  if (dataInicio) {
    return `A partir de ${formatDate(dataInicio)}`;
  }
  if (dataFim) {
    return `Até ${formatDate(dataFim)}`;
  }
  return 'Selecionar Período';
};

/**
 * Count active filters
 */
export const countActiveFilters = (filters: RouteFiltersState): number => {
  return [
    filters.status,
    filters.dataInicio,
    filters.dataFim,
    filters.motoristaId,
  ].filter(Boolean).length;
};
