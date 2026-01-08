/**
 * Route Filters Barrel Export - Tests
 */

import {
  DateRangeFilterSection,
  MotoristaFilterSection,
  StatusFilterSection,
  getPresetDates,
  formatDate,
  getRangeLabel,
  countActiveFilters,
} from '../index';

import type {
  PeriodPreset,
  RouteFiltersState,
  RouteFiltersProps,
  Motorista,
  StatusOption,
} from '../index';

describe('route-filters/index', () => {
  describe('component exports', () => {
    it('exports DateRangeFilterSection', () => {
      expect(DateRangeFilterSection).toBeDefined();
      expect(typeof DateRangeFilterSection).toBe('function');
    });

    it('exports MotoristaFilterSection', () => {
      expect(MotoristaFilterSection).toBeDefined();
      expect(typeof MotoristaFilterSection).toBe('function');
    });

    it('exports StatusFilterSection', () => {
      expect(StatusFilterSection).toBeDefined();
      expect(typeof StatusFilterSection).toBe('function');
    });
  });

  describe('utility exports', () => {
    it('exports getPresetDates', () => {
      expect(getPresetDates).toBeDefined();
      expect(typeof getPresetDates).toBe('function');
    });

    it('exports formatDate', () => {
      expect(formatDate).toBeDefined();
      expect(typeof formatDate).toBe('function');
    });

    it('exports getRangeLabel', () => {
      expect(getRangeLabel).toBeDefined();
      expect(typeof getRangeLabel).toBe('function');
    });

    it('exports countActiveFilters', () => {
      expect(countActiveFilters).toBeDefined();
      expect(typeof countActiveFilters).toBe('function');
    });
  });

  describe('type exports', () => {
    it('exports types that can be used correctly', () => {
      // Type assertions to verify exports work
      const preset: PeriodPreset = 'hoje';
      expect(preset).toBe('hoje');

      const filters: RouteFiltersState = { status: 'pendente' };
      expect(filters.status).toBe('pendente');

      const motorista: Motorista = { id: '1', nome: 'Test' };
      expect(motorista.nome).toBe('Test');

      const statusOption: StatusOption = {
        value: 'concluida',
        label: 'Concluída',
        color: '#00FF00',
      };
      expect(statusOption.label).toBe('Concluída');

      // Type guard check for RouteFiltersProps
      const props: Partial<RouteFiltersProps> = {
        variant: 'desktop',
      };
      expect(props.variant).toBe('desktop');
    });
  });
});
