/**
 * Picture-in-Picture Map - Shared Hooks
 *
 * Barrel export for PiP navigation hooks, types, and constants
 */

// Hooks
export { usePiPCollisionDetection } from './usePiPCollisionDetection';
export { calculateDistanceKm, usePiPRouteInfo } from './usePiPRouteInfo';

// Constants
export {
  AVERAGE_URBAN_SPEED_KMH,
  DOUBLE_TAP_DELAY,
  EDGE_PADDING,
  NEAR_DESTINATION_THRESHOLD_KM,
  PIP_HEIGHT,
  PIP_WIDTH,
  SWIPE_DOWN_THRESHOLD,
  TAB_BAR_BASE_HEIGHT,
} from './constants';

// Types
export type {
  AvoidArea,
  PictureInPictureMapProps,
  Position,
  RouteInfo,
} from './types';
