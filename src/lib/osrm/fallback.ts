/**
 * OSRM Fallback Functions
 *
 * Haversine distance calculations and fallback route/directions
 * used when OSRM API is unavailable.
 */

import { formatDistance, formatDuration } from './formatting';

import type { Coordinate, DistanceResult, RouteResult, DirectionsResult, DirectionsResultLeg } from './types';

// ============================================================================
// HAVERSINE
// ============================================================================

/**
 * Calcula distancia em linha reta usando formula de Haversine
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const EARTH_RADIUS = 6371000; // metros
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS * c;
}

/**
 * Estima distancia de rota baseado em Haversine (linha reta x 1.3)
 */
export function estimateRouteDistance(origin: Coordinate, destination: Coordinate): DistanceResult {
  const straightLine = calculateHaversineDistance(
    origin.latitude,
    origin.longitude,
    destination.latitude,
    destination.longitude
  );

  // Fator de correcao: rotas sao ~30% mais longas que linha reta
  const distance = Math.round(straightLine * 1.3);
  // Velocidade media urbana: ~30 km/h
  const duration = Math.round((distance / 1000) * 2 * 60); // segundos

  return {
    distance,
    duration,
    distanceText: formatDistance(distance),
    durationText: formatDuration(duration),
  };
}

// ============================================================================
// FALLBACK ROUTE & DIRECTIONS
// ============================================================================

/**
 * Cria rota de fallback usando Haversine
 */
export function createFallbackRoute(
  origin: Coordinate,
  destination: Coordinate,
  waypoints?: Coordinate[]
): RouteResult {
  const allCoords = [origin, ...(waypoints || []), destination];
  let totalDistance = 0;
  let totalDuration = 0;

  for (let i = 0; i < allCoords.length - 1; i++) {
    const dist = calculateHaversineDistance(
      allCoords[i].latitude,
      allCoords[i].longitude,
      allCoords[i + 1].latitude,
      allCoords[i + 1].longitude
    );
    totalDistance += dist * 1.3; // Fator de correcao
    totalDuration += (dist * 1.3 / 1000) * 2 * 60; // 30 km/h media
  }

  return {
    distance: Math.round(totalDistance),
    duration: Math.round(totalDuration),
    polyline: '', // Sem polyline no fallback
    steps: [
      {
        distance: totalDistance,
        duration: totalDuration,
        instruction: 'Siga em direção ao destino',
        maneuver: 'depart',
        location: origin,
      },
      {
        distance: 0,
        duration: 0,
        instruction: 'Você chegou ao destino',
        maneuver: 'arrive',
        location: destination,
      },
    ],
  };
}

/**
 * Cria resultado de fallback usando Haversine
 */
export function createFallbackDirections(
  origin: Coordinate,
  destination: Coordinate,
  waypoints?: Coordinate[]
): DirectionsResult {
  const allCoords = [origin, ...(waypoints || []), destination];
  let totalDistance = 0;
  let totalDuration = 0;
  const legs: DirectionsResultLeg[] = [];

  for (let i = 0; i < allCoords.length - 1; i++) {
    const dist = calculateHaversineDistance(
      allCoords[i].latitude,
      allCoords[i].longitude,
      allCoords[i + 1].latitude,
      allCoords[i + 1].longitude
    ) * 1.3; // Fator de correcao

    const duration = (dist / 1000) * 2 * 60; // 30 km/h media

    totalDistance += dist;
    totalDuration += duration;

    legs.push({
      distancia_metros: Math.round(dist),
      duracao_segundos: Math.round(duration),
      endereco_inicio: '',
      endereco_fim: '',
      coordenadas_inicio: allCoords[i],
      coordenadas_fim: allCoords[i + 1],
    });
  }

  return {
    polyline: '',
    distancia_total_metros: Math.round(totalDistance),
    duracao_total_segundos: Math.round(totalDuration),
    ordem_otimizada: (waypoints || []).map((_, i) => i),
    legs,
  };
}
