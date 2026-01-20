/**
 * Turn-by-Turn Navigation - Shared Types
 *
 * Types and interfaces shared between native and web TurnByTurn components
 */

import type { NavigationInstruction } from '@/services/turnByTurnNavigation';

/**
 * Location coordinates
 */
export interface Coordinate {
  latitude: number;
  longitude: number;
}

/**
 * Destination with address
 */
export interface Destination extends Coordinate {
  address: string;
}

/**
 * Props for TurnByTurnNavigation component
 */
export interface TurnByTurnNavigationProps {
  origin: Coordinate;
  destination: Destination;
  waypoints?: Coordinate[];
  onArrive: () => void;
  onExit: () => void;
}

/**
 * Navigation state returned by useTurnByTurnState hook
 */
export interface TurnByTurnState {
  userLocation: Coordinate;
  speed: number;
  heading: number;
  currentInstruction: NavigationInstruction | null;
  nextInstruction: NavigationInstruction | null;
  distanceToTurn: number;
  routeCoordinates: Coordinate[];
  remainingDistance: number;
  remainingTime: number;
  progress: number;
  voiceEnabled: boolean;
  isLoading: boolean;
  isRouteReady: boolean;
  proximityRadius: number;
  preventScreenSleep: boolean;
  vibrationAlerts: boolean;
  mapView: 'north-up' | 'heading-up';
}

/**
 * State setters returned by useTurnByTurnState hook
 */
export interface TurnByTurnSetters {
  setUserLocation: (location: Coordinate) => void;
  setSpeed: (speed: number) => void;
  setHeading: (heading: number) => void;
  setCurrentInstruction: (instruction: NavigationInstruction | null) => void;
  setNextInstruction: (instruction: NavigationInstruction | null) => void;
  setDistanceToTurn: (distance: number) => void;
  setRouteCoordinates: (coordinates: Coordinate[]) => void;
  setRemainingDistance: (distance: number) => void;
  setRemainingTime: (time: number) => void;
  setProgress: (progress: number) => void;
  setVoiceEnabled: (enabled: boolean) => void;
  setIsLoading: (loading: boolean) => void;
  setIsRouteReady: (ready: boolean) => void;
  setProximityRadius: (radius: number) => void;
  setPreventScreenSleep: (prevent: boolean) => void;
  setVibrationAlerts: (enabled: boolean) => void;
  setMapView: (view: 'north-up' | 'heading-up') => void;
}
