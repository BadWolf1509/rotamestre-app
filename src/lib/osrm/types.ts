/**
 * OSRM Type Definitions
 *
 * All interfaces used across the OSRM module.
 */

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface RouteStep {
  distance: number; // metros
  duration: number; // segundos
  instruction: string;
  maneuver: string;
  location: Coordinate;
  name?: string;
}

export interface RouteResult {
  distance: number; // metros
  duration: number; // segundos
  polyline: string; // encoded polyline
  steps: RouteStep[];
  waypoints?: Coordinate[];
  waypointOrder?: number[];
  /** Indica fallback Haversine; não representa um percurso viário confirmado. */
  is_estimated?: boolean;
}

export interface DistanceResult {
  distance: number; // metros
  duration: number; // segundos
  distanceText: string;
  durationText: string;
  /** Indica fallback Haversine; não representa um percurso viário confirmado. */
  is_estimated?: boolean;
}

export interface OSRMRouteResponse {
  code: string;
  routes: Array<{
    distance: number;
    duration: number;
    geometry: string;
    legs: Array<{
      distance: number;
      duration: number;
      steps: Array<{
        distance: number;
        duration: number;
        name: string;
        maneuver: {
          type: string;
          modifier?: string;
          location: [number, number];
        };
      }>;
    }>;
  }>;
  waypoints: Array<{
    location: [number, number];
    waypoint_index: number;
  }>;
}

/**
 * Formato compativel com GoogleDirectionsResult
 * Usado para substituir chamadas ao Google Routes API
 */
export interface DirectionsResultLeg {
  distancia_metros: number;
  duracao_segundos: number;
  endereco_inicio: string;
  endereco_fim: string;
  coordenadas_inicio: Coordinate;
  coordenadas_fim: Coordinate;
}

export interface DirectionsResult {
  polyline: string;
  distancia_total_metros: number;
  duracao_total_segundos: number;
  ordem_otimizada: number[];
  legs: DirectionsResultLeg[];
  /** Indica fallback Haversine; não representa um percurso viário confirmado. */
  is_estimated?: boolean;
}

export interface OSRMTripResponse {
  code: string;
  trips: Array<{
    distance: number;
    duration: number;
    geometry: string;
    legs: Array<{
      distance: number;
      duration: number;
      steps: Array<{
        distance: number;
        duration: number;
        name: string;
        maneuver: {
          type: string;
          modifier?: string;
          location: [number, number];
        };
      }>;
    }>;
  }>;
  waypoints: Array<{
    location: [number, number];
    waypoint_index: number;
    trips_index: number;
  }>;
}

export interface OSRMTableResponse {
  code: string;
  distances: number[][];
  durations: number[][];
  sources: Array<{ location: [number, number] }>;
  destinations: Array<{ location: [number, number] }>;
}
