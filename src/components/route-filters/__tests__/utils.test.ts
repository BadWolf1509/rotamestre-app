/**
 * Route Filters Utils - Tests
 */

import { countActiveFilters } from '../utils';

import type { RouteFiltersState } from '../types';

describe('route-filters/utils', () => {
  describe('countActiveFilters', () => {
    it('returns 0 for empty filters', () => {
      const filters: RouteFiltersState = {};
      expect(countActiveFilters(filters)).toBe(0);
    });

    it('returns 0 for null filters', () => {
      const filters: RouteFiltersState = { status: null, motoristaId: null };
      expect(countActiveFilters(filters)).toBe(0);
    });

    it('counts status filter', () => {
      const filters: RouteFiltersState = { status: 'pendente' };
      expect(countActiveFilters(filters)).toBe(1);
    });

    it('counts motorista filter', () => {
      const filters: RouteFiltersState = { motoristaId: 'uuid-123' };
      expect(countActiveFilters(filters)).toBe(1);
    });

    it('counts all active filters', () => {
      const filters: RouteFiltersState = {
        status: 'concluida',
        motoristaId: 'uuid-123',
      };
      expect(countActiveFilters(filters)).toBe(2);
    });
  });
});
