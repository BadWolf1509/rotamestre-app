/**
 * Route Filters - Utilities
 *
 * Helper functions for route filtering.
 */

import type { RouteFiltersState } from './types';

/**
 * Filtros ativos (status e motorista). O período não conta: sempre há um, e o
 * padrão é "Este mês".
 */
export const countActiveFilters = (filters: RouteFiltersState): number => {
  return [filters.status, filters.motoristaId].filter(Boolean).length;
};
