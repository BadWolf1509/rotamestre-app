/**
 * ============================================
 * Application Constants
 * ============================================
 *
 * Centralized configuration values for timings, limits, and other app-wide constants.
 * Use these instead of magic numbers throughout the codebase.
 */

// ============================================================================
// DEBOUNCE TIMINGS (milliseconds)
// ============================================================================

export const DEBOUNCE = {
  /** Address autocomplete search delay */
  ADDRESS_AUTOCOMPLETE: 1000,

  /** Generic search input delay */
  SEARCH_INPUT: 500,

  /** Location update broadcast interval */
  LOCATION_UPDATE: 3000,

  /** Form field validation delay */
  FORM_VALIDATION: 300,

  /** Window resize handler delay */
  RESIZE: 150,
} as const;

// ============================================================================
// TIMEOUTS (milliseconds)
// ============================================================================

export const TIMEOUT = {
  /** API request timeout */
  API_REQUEST: 30_000,

  /** Geocoding API timeout */
  GEOCODING: 10_000,

  /** Image upload timeout */
  IMAGE_UPLOAD: 60_000,

  /** Toast auto-dismiss duration */
  TOAST_DEFAULT: 4_000,

  /** Toast auto-dismiss for errors */
  TOAST_ERROR: 6_000,

  /** Animation durations */
  ANIMATION_FAST: 150,
  ANIMATION_NORMAL: 300,
  ANIMATION_SLOW: 500,
} as const;

// ============================================================================
// CACHE TTL (milliseconds)
// ============================================================================

export const CACHE_TTL = {
  /** User data cache (5 minutes) */
  USER_DATA: 5 * 60 * 1000,

  /** Route data cache (2 minutes) */
  ROUTE_DATA: 2 * 60 * 1000,

  /** Address autocomplete results (10 minutes) */
  AUTOCOMPLETE: 10 * 60 * 1000,

  /** Geocoding results (1 hour) */
  GEOCODING: 60 * 60 * 1000,

  /** Static data like status labels (1 day) */
  STATIC_DATA: 24 * 60 * 60 * 1000,
} as const;

// ============================================================================
// LIMITS
// ============================================================================

export const LIMITS = {
  /** Maximum stops per route */
  MAX_STOPS_PER_ROUTE: 50,

  /** Maximum photo file size in KB */
  MAX_PHOTO_SIZE_KB: 500,

  /** Maximum characters in observation field */
  MAX_OBSERVATION_LENGTH: 300,

  /** Maximum characters in address field */
  MAX_ADDRESS_LENGTH: 500,

  /** Minimum characters for autocomplete search */
  MIN_SEARCH_LENGTH: 3,

  /** Maximum autocomplete suggestions to show */
  MAX_AUTOCOMPLETE_SUGGESTIONS: 5,

  /** Default pagination page size */
  DEFAULT_PAGE_SIZE: 20,

  /** Maximum pagination page size */
  MAX_PAGE_SIZE: 100,

  /** Maximum routes to fetch in history */
  MAX_ROUTES_HISTORY: 100,

  /** Maximum retries for API requests */
  MAX_API_RETRIES: 3,
} as const;

// ============================================================================
// DISTANCE & LOCATION
// ============================================================================

export const LOCATION = {
  /** Default map zoom level */
  DEFAULT_ZOOM: 14,

  /** Zoom level for route view */
  ROUTE_ZOOM: 12,

  /** Zoom level for single address */
  ADDRESS_ZOOM: 16,

  /** Distance threshold for "arrived" detection (meters) */
  ARRIVAL_THRESHOLD_METERS: 100,

  /** Distance threshold for off-route detection (meters) */
  OFF_ROUTE_THRESHOLD_METERS: 200,

  /** Minimum accuracy for GPS readings (meters) */
  MIN_GPS_ACCURACY_METERS: 50,

  /** Default location (João Pessoa, PB - center of Brazil NE) */
  DEFAULT_LATITUDE: -7.12,
  DEFAULT_LONGITUDE: -34.85,
} as const;

// ============================================================================
// UI CONSTANTS
// ============================================================================

export const UI = {
  /** Minimum touch target size (accessibility) */
  MIN_TOUCH_TARGET: 44,

  /** Default border radius */
  BORDER_RADIUS_SM: 4,
  BORDER_RADIUS_MD: 8,
  BORDER_RADIUS_LG: 12,
  BORDER_RADIUS_FULL: 9999,

  /** Skeleton loading animation count */
  SKELETON_ROWS: 5,

  /** Responsive breakpoints */
  BREAKPOINT_MOBILE: 768,
  BREAKPOINT_TABLET: 1024,
  BREAKPOINT_DESKTOP: 1280,
} as const;

// ============================================================================
// VALIDATION PATTERNS
// ============================================================================

export const PATTERNS = {
  /** Brazilian CEP pattern */
  CEP: /^\d{5}-?\d{3}$/,

  /** Brazilian phone pattern (with or without country code) */
  PHONE: /^(?:\+55\s?)?(?:\(?\d{2}\)?\s?)?\d{4,5}-?\d{4}$/,

  /** Email pattern */
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,

  /** Brazilian CNPJ pattern */
  CNPJ: /^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$/,
} as const;

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type DebounceKey = keyof typeof DEBOUNCE;
export type TimeoutKey = keyof typeof TIMEOUT;
export type CacheTTLKey = keyof typeof CACHE_TTL;
export type LimitKey = keyof typeof LIMITS;
export type LocationKey = keyof typeof LOCATION;
export type UIKey = keyof typeof UI;
