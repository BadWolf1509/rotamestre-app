/**
 * Central export for all application constants
 *
 * Usage:
 * import { DEBOUNCE, LIMITS, ROUTE_STATUS_CONFIG } from '@/constants';
 */

// App-wide constants
export {
  DEBOUNCE,
  TIMEOUT,
  CACHE_TTL,
  LIMITS,
  LOCATION,
  UI,
  PATTERNS,
} from './app';

export type {
  DebounceKey,
  TimeoutKey,
  CacheTTLKey,
  LimitKey,
  LocationKey,
  UIKey,
} from './app';

// Status configuration
export {
  ROUTE_STATUS_CONFIG,
  STOP_STATUS_CONFIG,
  getStatusLabel,
  getStatusColorKey,
  getStatusIcon,
  getStatusColor,
} from './statusConfig';

export type {
  RouteStatusType,
  StopStatusType,
  StatusColorKey,
  StatusConfig,
} from './statusConfig';

// Page metadata
export { getGestorPageMeta, gestorPageMeta } from './gestorPageMeta';
