/**
 * Main Card Data Hooks
 *
 * Barrel export for main card data hooks and types
 */

// Main orchestrator hook
export { useMainCardData } from './useMainCardData';

// Sub-hooks (for granular usage)
export { useExpiredRoute } from './useExpiredRoute';
export { useLastRoute } from './useLastRoute';
export { useMotoristaStats } from './useMotoristaStats';
export { useMotoristaStreak } from './useMotoristaStreak';

// Types
export type {
  ExpiredRouteData,
  LastRouteData,
  MotoristaStats,
  UseMainCardDataOptions,
  UseMainCardDataReturn,
} from './types';
export { initialStats } from './types';
