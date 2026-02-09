/**
 * OSRM API Functions
 *
 * All OSRM HTTP API calls: routing, distance, optimization, polyline decoding.
 *
 * @see https://project-osrm.org/docs/v5.5.1/api/
 * @see https://github.com/Project-OSRM/osrm-backend/wiki/Api-usage-policy
 */

import { decode } from '@mapbox/polyline';

import { logger } from '@/lib/logger';

import { getCacheKey, getFromCache, setCache, waitForRateLimit } from './cache';
import { createFallbackRoute, createFallbackDirections, estimateRouteDistance } from './fallback';
import { formatDistance, formatDuration, translateManeuver } from './formatting';

import type {
  Coordinate,
  RouteStep,
  RouteResult,
  DistanceResult,
  DirectionsResult,
  DirectionsResultLeg,
  OSRMRouteResponse,
  OSRMTripResponse,
} from './types';

// ============================================================================
// CONFIGURATION
// ============================================================================

const OSRM_BASE_URL = 'https://router.project-osrm.org';
const REQUEST_TIMEOUT = 10000; // 10 segundos

// ============================================================================
// ROUTE API
// ============================================================================

/**
 * Obtem rota entre dois ou mais pontos
 */
export async function getRoute(
  origin: Coordinate,
  destination: Coordinate,
  waypoints?: Coordinate[],
  options?: {
    optimize?: boolean;
    steps?: boolean;
  }
): Promise<RouteResult | null> {
  const allCoords = [origin, ...(waypoints || []), destination];
  const cacheKey = getCacheKey('route', allCoords);

  // Check cache
  const cached = getFromCache<RouteResult>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    await waitForRateLimit();

    // Build coordinates string: lon,lat;lon,lat;...
    const coordsStr = allCoords
      .map(c => `${c.longitude},${c.latitude}`)
      .join(';');

    const params = new URLSearchParams({
      overview: 'full',
      geometries: 'polyline',
      steps: options?.steps !== false ? 'true' : 'false',
    });

    const url = `${OSRM_BASE_URL}/route/v1/driving/${coordsStr}?${params}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'RotaMestre/1.0 (https://app.rotamestre.tec.br)',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`OSRM error: ${response.status}`);
    }

    const data: OSRMRouteResponse = await response.json();

    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      logger.warn('OSRM: No route found, using Haversine fallback');
      return createFallbackRoute(origin, destination, waypoints);
    }

    const route = data.routes[0];
    const steps: RouteStep[] = [];

    // Process steps from all legs
    for (const leg of route.legs) {
      for (const step of leg.steps) {
        steps.push({
          distance: step.distance,
          duration: step.duration,
          instruction: translateManeuver(
            step.maneuver.type,
            step.maneuver.modifier,
            step.name
          ),
          maneuver: `${step.maneuver.type}-${step.maneuver.modifier || ''}`,
          location: {
            latitude: step.maneuver.location[1],
            longitude: step.maneuver.location[0],
          },
          name: step.name,
        });
      }
    }

    const result: RouteResult = {
      distance: route.distance,
      duration: route.duration,
      polyline: route.geometry,
      steps,
      waypoints: data.waypoints.map(wp => ({
        latitude: wp.location[1],
        longitude: wp.location[0],
      })),
      waypointOrder: data.waypoints.map(wp => wp.waypoint_index),
    };

    setCache(cacheKey, result);
    return result;
  } catch (error) {
    logger.error('OSRM getRoute error:', error);
    // Fallback to Haversine
    return createFallbackRoute(origin, destination, waypoints);
  }
}

// ============================================================================
// DISTANCE API
// ============================================================================

/**
 * Calcula distancia e duracao entre dois pontos (para useDistanceToStop)
 */
export async function getDistance(
  origin: Coordinate,
  destination: Coordinate
): Promise<DistanceResult> {
  const cacheKey = getCacheKey('distance', [origin, destination]);

  // Check cache
  const cached = getFromCache<DistanceResult>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    await waitForRateLimit();

    const coordsStr = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
    const url = `${OSRM_BASE_URL}/route/v1/driving/${coordsStr}?overview=false&steps=false`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'RotaMestre/1.0 (https://app.rotamestre.tec.br)',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`OSRM error: ${response.status}`);
    }

    const data: OSRMRouteResponse = await response.json();

    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      return estimateRouteDistance(origin, destination);
    }

    const route = data.routes[0];
    const result: DistanceResult = {
      distance: route.distance,
      duration: route.duration,
      distanceText: formatDistance(route.distance),
      durationText: formatDuration(route.duration),
    };

    setCache(cacheKey, result);
    return result;
  } catch (error) {
    logger.error('OSRM getDistance error:', error);
    return estimateRouteDistance(origin, destination);
  }
}

// ============================================================================
// TRIP (OPTIMIZATION) API
// ============================================================================

/**
 * Otimiza ordem de waypoints (Trip API - TSP)
 */
export async function optimizeWaypoints(
  waypoints: Coordinate[]
): Promise<{ order: number[]; distance: number; duration: number } | null> {
  if (waypoints.length < 2) {
    return { order: waypoints.map((_, i) => i), distance: 0, duration: 0 };
  }

  const cacheKey = getCacheKey('optimize', waypoints);

  // Check cache
  const cached = getFromCache<{ order: number[]; distance: number; duration: number }>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    await waitForRateLimit();

    const coordsStr = waypoints
      .map(c => `${c.longitude},${c.latitude}`)
      .join(';');

    // Trip API resolve o TSP
    const url = `${OSRM_BASE_URL}/trip/v1/driving/${coordsStr}?roundtrip=false&source=first&destination=last`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'RotaMestre/1.0 (https://app.rotamestre.tec.br)',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`OSRM error: ${response.status}`);
    }

    const data = await response.json();

    if (data.code !== 'Ok' || !data.waypoints) {
      return null;
    }

    const order = data.waypoints.map((wp: { waypoint_index: number }) => wp.waypoint_index);
    const trip = data.trips?.[0];

    const result = {
      order,
      distance: trip?.distance || 0,
      duration: trip?.duration || 0,
    };

    setCache(cacheKey, result);
    return result;
  } catch (error) {
    logger.error('OSRM optimizeWaypoints error:', error);
    return null;
  }
}

// ============================================================================
// POLYLINE
// ============================================================================

/**
 * Decodifica polyline para coordenadas
 */
export function decodePolyline(encoded: string): Coordinate[] {
  if (!encoded) return [];

  try {
    const decoded = decode(encoded, 5);
    return decoded.map(([lat, lng]) => ({
      latitude: lat,
      longitude: lng,
    }));
  } catch (error) {
    logger.error('Error decoding polyline', error);
    return [];
  }
}

// ============================================================================
// DIRECTIONS (GOOGLE-COMPATIBLE FORMAT)
// ============================================================================

/**
 * Obtem rota otimizada no formato compativel com Google Directions
 *
 * Esta funcao substitui googleMapsService.getDirections para economia de custos.
 * Usa OSRM Trip API para otimizacao (TSP) e Route API para rotas simples.
 *
 * @param origin - Ponto de origem
 * @param destination - Ponto de destino
 * @param waypoints - Pontos intermediarios (opcional)
 * @param optimize - Se true, otimiza a ordem dos waypoints (padrao: true)
 * @returns Resultado no formato GoogleDirectionsResult ou null se falhar
 */
export async function getOptimizedDirections(
  origin: Coordinate,
  destination: Coordinate,
  waypoints?: Coordinate[],
  optimize: boolean = true
): Promise<DirectionsResult | null> {
  const allCoords = [origin, ...(waypoints || []), destination];
  const cacheKey = getCacheKey(`directions-${optimize}`, allCoords);

  // Check cache
  const cached = getFromCache<DirectionsResult>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    // Verificar se e rota circular (origem == destino)
    const isCircular =
      Math.abs(origin.latitude - destination.latitude) < 0.0001 &&
      Math.abs(origin.longitude - destination.longitude) < 0.0001;

    // Se tem waypoints e quer otimizar, usar Trip API
    if (waypoints && waypoints.length > 0 && optimize && isCircular) {
      return await getOptimizedCircularRoute(origin, waypoints, cacheKey);
    }

    // Caso contrario, usar Route API simples
    return await getSimpleRoute(origin, destination, waypoints, cacheKey);
  } catch (error) {
    logger.error('OSRM getOptimizedDirections error:', error);
    // Fallback com Haversine
    return createFallbackDirections(origin, destination, waypoints);
  }
}

/**
 * Rota circular otimizada usando Trip API (TSP)
 */
async function getOptimizedCircularRoute(
  origin: Coordinate,
  waypoints: Coordinate[],
  cacheKey: string
): Promise<DirectionsResult | null> {
  await waitForRateLimit();

  // Trip API: origem + waypoints, roundtrip=true para voltar a origem
  const allPoints = [origin, ...waypoints];
  const coordsStr = allPoints
    .map(c => `${c.longitude},${c.latitude}`)
    .join(';');

  const url = `${OSRM_BASE_URL}/trip/v1/driving/${coordsStr}?roundtrip=true&source=first&geometries=polyline&overview=full&steps=false`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'RotaMestre/1.0 (https://app.rotamestre.tec.br)',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`OSRM Trip error: ${response.status}`);
    }

    const data: OSRMTripResponse = await response.json();

    if (data.code !== 'Ok' || !data.trips || data.trips.length === 0) {
      logger.warn('OSRM Trip: No route found, falling back');
      return createFallbackDirections(origin, origin, waypoints);
    }

    const trip = data.trips[0];

    // Extrair ordem otimizada dos waypoints
    // IMPORTANTE: data.waypoints mantem a ORDEM DE ENTRADA
    // waypoint_index indica a POSICAO NA TRIP OTIMIZADA
    //
    // Exemplo: entrada [origem, A, B, C], trip otimizada visita na ordem [origem, B, A, C]
    // data.waypoints[0] (origem): waypoint_index = 0
    // data.waypoints[1] (A): waypoint_index = 2 (visitado em 3o lugar)
    // data.waypoints[2] (B): waypoint_index = 1 (visitado em 2o lugar)
    // data.waypoints[3] (C): waypoint_index = 3 (visitado em 4o lugar)
    //
    // Para obter a ordem otimizada, ordenamos pelo waypoint_index e pegamos os indices originais
    const waypointsComIndice = data.waypoints
      .map((wp, indiceOriginal) => ({ indiceOriginal, posicaoNaTrip: wp.waypoint_index }))
      .filter(wp => wp.indiceOriginal > 0); // Excluir origem (indice 0)

    // Ordenar pela posicao na trip otimizada
    waypointsComIndice.sort((a, b) => a.posicaoNaTrip - b.posicaoNaTrip);

    // Extrair indices originais (ajustados: -1 porque origem nao conta nas paradas)
    const waypointOrder = waypointsComIndice.map(wp => wp.indiceOriginal - 1);

    // Construir legs
    const legs: DirectionsResultLeg[] = trip.legs.map((leg, index) => {
      const startWp = data.waypoints[index];
      const endWp = data.waypoints[index + 1] || data.waypoints[0]; // Volta a origem

      return {
        distancia_metros: leg.distance,
        duracao_segundos: leg.duration,
        endereco_inicio: '',
        endereco_fim: '',
        coordenadas_inicio: {
          latitude: startWp.location[1],
          longitude: startWp.location[0],
        },
        coordenadas_fim: {
          latitude: endWp.location[1],
          longitude: endWp.location[0],
        },
      };
    });

    const result: DirectionsResult = {
      polyline: trip.geometry,
      distancia_total_metros: trip.distance,
      duracao_total_segundos: trip.duration,
      ordem_otimizada: waypointOrder,
      legs,
    };

    setCache(cacheKey, result);
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Rota simples (nao circular ou sem otimizacao)
 */
async function getSimpleRoute(
  origin: Coordinate,
  destination: Coordinate,
  waypoints: Coordinate[] | undefined,
  cacheKey: string
): Promise<DirectionsResult | null> {
  await waitForRateLimit();

  const allCoords = [origin, ...(waypoints || []), destination];
  const coordsStr = allCoords
    .map(c => `${c.longitude},${c.latitude}`)
    .join(';');

  const url = `${OSRM_BASE_URL}/route/v1/driving/${coordsStr}?overview=full&geometries=polyline&steps=false`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'RotaMestre/1.0 (https://app.rotamestre.tec.br)',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`OSRM Route error: ${response.status}`);
    }

    const data: OSRMRouteResponse = await response.json();

    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      return createFallbackDirections(origin, destination, waypoints);
    }

    const route = data.routes[0];

    // Para rota simples, a ordem e a mesma da entrada
    const waypointOrder = (waypoints || []).map((_, i) => i);

    // Construir legs
    const legs: DirectionsResultLeg[] = route.legs.map((leg, index) => {
      const startCoord = allCoords[index];
      const endCoord = allCoords[index + 1];

      return {
        distancia_metros: leg.distance,
        duracao_segundos: leg.duration,
        endereco_inicio: '',
        endereco_fim: '',
        coordenadas_inicio: startCoord,
        coordenadas_fim: endCoord,
      };
    });

    const result: DirectionsResult = {
      polyline: route.geometry,
      distancia_total_metros: route.distance,
      duracao_total_segundos: route.duration,
      ordem_otimizada: waypointOrder,
      legs,
    };

    setCache(cacheKey, result);
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}
