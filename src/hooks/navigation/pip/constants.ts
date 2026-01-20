/**
 * Picture-in-Picture Map - Shared Constants
 *
 * Constants used by both native and web PiP components
 */

/** PiP window width in pixels */
export const PIP_WIDTH = 140;

/** PiP window height in pixels */
export const PIP_HEIGHT = 200;

/** Padding from screen edges in pixels */
export const EDGE_PADDING = 16;

/** Delay between taps to detect double-tap (ms) */
export const DOUBLE_TAP_DELAY = 300;

/** Average urban speed for ETA estimation (km/h) */
export const AVERAGE_URBAN_SPEED_KMH = 30;

/** Base height of tab bar without safe area (native only) */
export const TAB_BAR_BASE_HEIGHT = 60;

/** Threshold distance to detect swipe down (px) */
export const SWIPE_DOWN_THRESHOLD = 100;

/** Threshold distance to consider user near destination (km) */
export const NEAR_DESTINATION_THRESHOLD_KM = 0.1;
