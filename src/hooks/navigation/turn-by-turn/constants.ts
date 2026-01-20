/**
 * Turn-by-Turn Navigation - Shared Constants
 *
 * Constants used by both native and web TurnByTurn components
 */

/** Default proximity radius for arrival detection (meters) */
export const DEFAULT_PROXIMITY_RADIUS = 30;

/** Default voice navigation enabled state */
export const DEFAULT_VOICE_ENABLED = true;

/** Default screen sleep prevention state */
export const DEFAULT_PREVENT_SCREEN_SLEEP = true;

/** Default vibration alerts enabled state */
export const DEFAULT_VIBRATION_ALERTS = true;

/** Off-route warning threshold (meters) */
export const OFF_ROUTE_WARNING_THRESHOLD = 100;

/** Off-route critical threshold (meters) */
export const OFF_ROUTE_CRITICAL_THRESHOLD = 200;

/** Delay before calling onArrive callback (ms) */
export const ARRIVAL_CALLBACK_DELAY = 2000;

/** Minimum distance change to trigger animation (meters) */
export const MIN_DISTANCE_FOR_ANIMATION = 5;

/** Minimum heading change to trigger animation (degrees) */
export const MIN_HEADING_CHANGE_FOR_ANIMATION = 5;
