/**
 * Picture-in-Picture Map - Shared Types
 *
 * Types and interfaces shared between native and web PiP components
 */

/**
 * Position in screen coordinates
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * Area to avoid (e.g., FAB, bottom sheet)
 */
export interface AvoidArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Route information calculated from user location and destination
 */
export interface RouteInfo {
  /** Distance in kilometers */
  distanceKm: number;
  /** Estimated time in minutes */
  estimatedMinutes: number;
  /** Formatted distance text (e.g., "250 m" or "1.5 km") */
  distanceText: string;
  /** Formatted time text (e.g., "5 min" or "1h30") */
  timeText: string;
}

/**
 * Props for PictureInPictureMap component
 */
export interface PictureInPictureMapProps {
  visible: boolean;
  userLocation: { latitude: number; longitude: number } | null;
  destination: {
    latitude: number;
    longitude: number;
    address: string;
  } | null;
  onClose: () => void;
  onExpand: () => void;
  /** Progress of the route: completed stops / total */
  progress?: { completed: number; total: number };
  /** Current stop order number */
  currentStopOrder?: number;
  /** Current stop type (delivery or pickup) */
  stopType?: 'entrega' | 'retirada';
  /** User heading in degrees (0-360, where 0 = North) */
  userHeading?: number;
  /** Next navigation instruction */
  nextInstruction?: string;
  /** Areas to avoid - PiP repositions automatically */
  avoidAreas?: AvoidArea[];
}
