/**
 * Picture-in-Picture Map - Shared Hooks
 *
 * Barrel export for PiP navigation hooks, types, and constants
 */

// Hooks
export { usePiPCollisionDetection } from './usePiPCollisionDetection';
export { calculateDistanceKm, usePiPRouteInfo } from './usePiPRouteInfo';
export { usePipDrag } from './usePipDrag';

// Utils
export { getMapCenter, getMapZoom, buildGoogleMapsUrl } from './pip-utils';

// Constants
export {
  ANDROID_MIN_NAV_BAR_HEIGHT,
  AVERAGE_URBAN_SPEED_KMH,
  DOUBLE_TAP_DELAY,
  EDGE_PADDING,
  MIN_SAFE_TOP_POSITION,
  NEAR_DESTINATION_THRESHOLD_KM,
  OPACITY_ANIMATION_DURATION,
  PIP_HEIGHT,
  PIP_WIDTH,
  SPRING_ANIMATION_DURATION,
  SWIPE_DOWN_THRESHOLD,
  SWIPE_VELOCITY_THRESHOLD,
  TAB_BAR_BASE_HEIGHT,
} from './constants';

// Types
export type {
  AvoidArea,
  PictureInPictureMapProps,
  Position,
  RouteInfo,
} from './types';
