/**
 * Picture-in-Picture Map - Shared Constants
 *
 * Constants used by both native and web PiP components.
 * Centralizes magic numbers for maintainability.
 *
 * @module PiP Constants
 */

// =============================================================================
// DIMENSIONS
// =============================================================================

/** PiP window width in pixels (collapsed state) */
export const PIP_WIDTH = 140;

/** PiP window height in pixels (collapsed state) */
export const PIP_HEIGHT = 200;

/** Padding from screen edges in pixels */
export const EDGE_PADDING = 16;

/** Base height of tab bar without safe area (native only) */
export const TAB_BAR_BASE_HEIGHT = 60;

/**
 * Minimum navigation bar height for Android 15+ edge-to-edge mode.
 * Android 15 may return insets.bottom = 0, so we enforce a minimum.
 */
export const ANDROID_MIN_NAV_BAR_HEIGHT = 34;

/**
 * Minimum safe top position (fallback when safeTopBound is too low).
 * Ensures PiP doesn't overlap with status bar on devices with small notches.
 */
export const MIN_SAFE_TOP_POSITION = 100;

// =============================================================================
// GESTURES & INTERACTIONS
// =============================================================================

/** Delay between taps to detect double-tap (ms) */
export const DOUBLE_TAP_DELAY = 300;

/** Threshold distance to detect swipe down for close gesture (px) */
export const SWIPE_DOWN_THRESHOLD = 100;

/** Velocity threshold for swipe down close gesture (native only) */
export const SWIPE_VELOCITY_THRESHOLD = 1.5;

// =============================================================================
// ANIMATIONS
// =============================================================================

/** Duration for show/hide opacity animation (ms) */
export const OPACITY_ANIMATION_DURATION = 300;

/** Duration for expand/collapse spring animation (ms, approximate) */
export const SPRING_ANIMATION_DURATION = 500;

// =============================================================================
// NAVIGATION & ROUTING
// =============================================================================

/** Average urban speed for ETA estimation (km/h) */
export const AVERAGE_URBAN_SPEED_KMH = 30;

/** Threshold distance to consider user near destination (km) - triggers pulse animation */
export const NEAR_DESTINATION_THRESHOLD_KM = 0.1;
