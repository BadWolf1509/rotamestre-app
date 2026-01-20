/**
 * Hook para gerenciar dados do MainCard
 *
 * @deprecated Use imports from '@/hooks/main-card-data' for granular access
 * This file re-exports for backward compatibility
 */

// Re-export everything from the new modular location
export {
  initialStats,
  useExpiredRoute,
  useLastRoute,
  useMainCardData,
  useMotoristaStats,
  useMotoristaStreak,
} from './main-card-data';

// Re-export types
export type {
  ExpiredRouteData,
  LastRouteData,
  MotoristaStats,
  UseMainCardDataOptions,
  UseMainCardDataReturn,
} from './main-card-data';
