/**
 * Turn-by-Turn Navigation - Shared Hooks
 *
 * Barrel export for Turn-by-Turn navigation hooks, types, and constants
 */

// Hooks
export { useTurnByTurnFormatters } from './useTurnByTurnFormatters';
export { useTurnByTurnState } from './useTurnByTurnState';

// Constants
export {
  ARRIVAL_CALLBACK_DELAY,
  DEFAULT_PREVENT_SCREEN_SLEEP,
  DEFAULT_PROXIMITY_RADIUS,
  DEFAULT_VIBRATION_ALERTS,
  DEFAULT_VOICE_ENABLED,
  MIN_DISTANCE_FOR_ANIMATION,
  MIN_HEADING_CHANGE_FOR_ANIMATION,
  OFF_ROUTE_CRITICAL_THRESHOLD,
  OFF_ROUTE_WARNING_THRESHOLD,
} from './constants';

// Types
export type {
  Coordinate,
  Destination,
  TurnByTurnNavigationProps,
  TurnByTurnSetters,
  TurnByTurnState,
} from './types';
