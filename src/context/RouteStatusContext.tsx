/**
 * RouteStatusContext - Backward-compatible re-exports
 *
 * All logic has been extracted to:
 * - src/context/route-status/types.ts (types)
 * - src/context/route-status/calculations.ts (pure functions)
 * - src/context/route-status/RouteStatusProvider.tsx (provider + hook)
 * - src/hooks/route-status/ (data loading, actions, realtime)
 */

export { RouteStatusProvider, useRouteStatus } from './route-status/RouteStatusProvider';
export type {
  RouteStatus,
  RouteData,
  ParadaData,
  RouteStatusContextData,
} from './route-status/types';
