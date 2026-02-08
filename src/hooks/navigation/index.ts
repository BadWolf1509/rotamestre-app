/**
 * Navigation Hooks
 *
 * Shared hooks and types for NavigationMode, PictureInPictureMap,
 * and TurnByTurnNavigation components.
 */

// NavigationMode hooks
export { useNavigationModeLogic } from './useNavigationModeLogic';
export { useNavigationFeedback } from './useNavigationFeedback';
export { useNavigationActions } from './useNavigationActions';

export type {
  NavigationModeProps,
  NavigationPreferences,
  UserLocation,
  UseNavigationModeLogicReturn,
} from './types';

// PictureInPictureMap hooks
export {
  ANDROID_MIN_NAV_BAR_HEIGHT,
  AVERAGE_URBAN_SPEED_KMH,
  calculateDistanceKm,
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
  usePiPCollisionDetection,
  usePiPRouteInfo,
  usePipDrag,
  getMapCenter,
  getMapZoom,
  buildGoogleMapsUrl,
} from './pip';

export type {
  AvoidArea,
  PictureInPictureMapProps,
  Position,
  RouteInfo,
} from './pip';

// TurnByTurnNavigation hooks
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
  useTurnByTurnFormatters,
  useTurnByTurnState,
} from './turn-by-turn';

export type {
  Coordinate as TurnByTurnCoordinate,
  Destination,
  TurnByTurnNavigationProps,
  TurnByTurnSetters,
  TurnByTurnState,
} from './turn-by-turn';
