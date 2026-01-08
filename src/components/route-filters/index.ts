/**
 * Route Filters - Barrel Export
 *
 * Components and utilities for route filtering.
 */

export { DateRangeFilterSection } from './DateRangeFilterSection';
export { MotoristaFilterSection } from './MotoristaFilterSection';
export { StatusFilterSection } from './StatusFilterSection';

export type {
  PeriodPreset,
  RouteFiltersState,
  RouteFiltersProps,
  Motorista,
  StatusOption,
} from './types';

export {
  getPresetDates,
  formatDate,
  getRangeLabel,
  countActiveFilters,
} from './utils';
