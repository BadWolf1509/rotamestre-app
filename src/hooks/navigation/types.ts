/**
 * Navigation Hooks - Shared Types
 *
 * Types and interfaces shared between NavigationMode native and web components
 */

import type { ParadaData } from '@/context/RouteStatusContext';
import type { Coordinate } from '@/lib/osrm';

/**
 * User location with optional heading for direction indicator
 */
export interface UserLocation {
  latitude: number;
  longitude: number;
  heading?: number;
}

/**
 * Navigation preferences loaded from storage
 */
export interface NavigationPreferences {
  soundAlerts: boolean;
  vibrationAlerts: boolean;
  showSpeedometer: boolean;
  internalNavigation: boolean;
  autoAdvance?: boolean;
  proximityRadius?: number;
}

/**
 * Props for NavigationMode component
 */
export interface NavigationModeProps {
  currentStop: ParadaData;
  nextStop?: ParadaData | null;
  paradas: ParadaData[];
  rotaId?: string;
  onComplete: () => void;
  onSkip: () => void;
  onExit: () => void;
}

/**
 * Return type for useNavigationModeLogic hook
 */
export interface UseNavigationModeLogicReturn {
  // State
  userLocation: UserLocation | null;
  speed: number;
  distance: number | null;
  eta: string | null;
  isTracking: boolean;
  showSettings: boolean;
  routePath: Coordinate[];
  preferences: NavigationPreferences;
  navigationMode: 'map' | 'turn-by-turn';
  isInitializing: boolean;

  // State setters
  setUserLocation: (location: UserLocation | null) => void;
  setSpeed: (speed: number) => void;
  setDistance: (distance: number | null) => void;
  setEta: (eta: string | null) => void;
  setIsTracking: (tracking: boolean) => void;
  setShowSettings: (show: boolean) => void;
  setRoutePath: (path: Coordinate[]) => void;
  setNavigationMode: (mode: 'map' | 'turn-by-turn') => void;
  setIsInitializing: (init: boolean) => void;

  // Derived values
  realParadas: ParadaData[];
  checkpoints: ParadaData[];
  startCheckpoint: ParadaData | null;
  endCheckpoint: ParadaData | null;
  currentStopIndex: number;
  nextStopAfterCurrent: ParadaData | null;
  pendingStops: ParadaData[];
  remainingWaypoints: Coordinate[];
  isEntrega: boolean;
  isNearDestination: boolean;

  // Functions
  formatDistance: (meters: number) => string;
  getSpeedColor: (speedKmh: number) => string;
  loadPreferences: () => Promise<void>;
  startNavigation: () => Promise<void>;
  stopNavigation: () => Promise<void>;
  updateLocationFromCoords: (
    coords: { latitude: number; longitude: number; heading?: number | null },
    speedMs: number | null
  ) => void;
}
