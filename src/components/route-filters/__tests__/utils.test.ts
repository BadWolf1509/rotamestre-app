/**
 * Route Filters Utils - Tests
 */

import { getPresetDates, formatDate, getRangeLabel, countActiveFilters } from '../utils';
import type { RouteFiltersState } from '../types';

describe('route-filters/utils', () => {
  describe('getPresetDates', () => {
    beforeEach(() => {
      // Mock current date to ensure consistent tests
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-01-15T12:00:00.000Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('returns today start and end for "hoje"', () => {
      const result = getPresetDates('hoje');
      expect(result).not.toBeNull();
      expect(result!.startDate.getHours()).toBe(0);
      expect(result!.startDate.getMinutes()).toBe(0);
      expect(result!.endDate.getHours()).toBe(23);
      expect(result!.endDate.getMinutes()).toBe(59);
    });

    it('returns 7 days ago for "ultima_semana"', () => {
      const result = getPresetDates('ultima_semana');
      expect(result).not.toBeNull();
      const daysDiff = Math.round(
        (result!.endDate.getTime() - result!.startDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      expect(daysDiff).toBe(7);
    });

    it('returns 30 days ago for "ultimo_mes"', () => {
      const result = getPresetDates('ultimo_mes');
      expect(result).not.toBeNull();
      const daysDiff = Math.round(
        (result!.endDate.getTime() - result!.startDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      expect(daysDiff).toBe(30);
    });

    it('returns first day of month for "este_mes"', () => {
      const result = getPresetDates('este_mes');
      expect(result).not.toBeNull();
      expect(result!.startDate.getDate()).toBe(1);
    });

    it('returns null for "personalizado"', () => {
      const result = getPresetDates('personalizado');
      expect(result).toBeNull();
    });
  });

  describe('formatDate', () => {
    it('returns "Selecionar" for null', () => {
      expect(formatDate(null)).toBe('Selecionar');
    });

    it('returns "Selecionar" for undefined', () => {
      expect(formatDate(undefined)).toBe('Selecionar');
    });

    it('formats date in pt-BR format', () => {
      const date = new Date('2026-01-15');
      const formatted = formatDate(date);
      // Format should be DD/MM/YYYY
      expect(formatted).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    });
  });

  describe('getRangeLabel', () => {
    it('returns range format when both dates provided', () => {
      const start = new Date('2026-01-01');
      const end = new Date('2026-01-15');
      const label = getRangeLabel(start, end);
      expect(label).toContain(' - ');
    });

    it('returns "A partir de" when only start date', () => {
      const start = new Date('2026-01-01');
      const label = getRangeLabel(start, null);
      expect(label).toContain('A partir de');
    });

    it('returns "Até" when only end date', () => {
      const end = new Date('2026-01-15');
      const label = getRangeLabel(null, end);
      expect(label).toContain('Até');
    });

    it('returns "Selecionar Período" when no dates', () => {
      expect(getRangeLabel(null, null)).toBe('Selecionar Período');
      expect(getRangeLabel(undefined, undefined)).toBe('Selecionar Período');
    });
  });

  describe('countActiveFilters', () => {
    it('returns 0 for empty filters', () => {
      const filters: RouteFiltersState = {};
      expect(countActiveFilters(filters)).toBe(0);
    });

    it('returns 0 for null filters', () => {
      const filters: RouteFiltersState = {
        status: null,
        dataInicio: null,
        dataFim: null,
        motoristaId: null,
      };
      expect(countActiveFilters(filters)).toBe(0);
    });

    it('counts status filter', () => {
      const filters: RouteFiltersState = { status: 'pendente' };
      expect(countActiveFilters(filters)).toBe(1);
    });

    it('counts date filters', () => {
      const filters: RouteFiltersState = {
        dataInicio: new Date(),
        dataFim: new Date(),
      };
      expect(countActiveFilters(filters)).toBe(2);
    });

    it('counts motorista filter', () => {
      const filters: RouteFiltersState = { motoristaId: 'uuid-123' };
      expect(countActiveFilters(filters)).toBe(1);
    });

    it('counts all active filters', () => {
      const filters: RouteFiltersState = {
        status: 'concluida',
        dataInicio: new Date(),
        dataFim: new Date(),
        motoristaId: 'uuid-123',
      };
      expect(countActiveFilters(filters)).toBe(4);
    });
  });
});
