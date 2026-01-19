/**
 * OSRM (Open Source Routing Machine) Service
 *
 * Substitui Google Routes API para reduzir custos
 * Usa o demo server público: router.project-osrm.org
 *
 * Rate limits:
 * - Demo server: 1 request/segundo
 * - Cache: 5 minutos para reduzir chamadas
 *
 * @see https://project-osrm.org/docs/v5.5.1/api/
 * @see https://github.com/Project-OSRM/osrm-backend/wiki/Api-usage-policy
 */

import { decode } from '@mapbox/polyline';

// ============================================================================
// CONFIGURATION
// ============================================================================

const OSRM_BASE_URL = 'https://router.project-osrm.org';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos
const MIN_REQUEST_INTERVAL = 1100; // 1.1 segundos entre requests (rate limit: 1/s)
const REQUEST_TIMEOUT = 10000; // 10 segundos

// ============================================================================
// TYPES
// ============================================================================

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
}

export interface DistanceResult {
  distance: number; // metros
  duration: number; // segundos
  distanceText: string;
  durationText: string;
}

interface OSRMRouteResponse {
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

// ============================================================================
// CACHE & RATE LIMITING
// ============================================================================

const cache = new Map<string, { data: unknown; timestamp: number }>();
let lastRequestTime = 0;

function getCacheKey(type: string, coords: Coordinate[]): string {
  const coordStr = coords
    .map(c => `${c.latitude.toFixed(4)},${c.longitude.toFixed(4)}`)
    .join('|');
  return `${type}:${coordStr}`;
}

function getFromCache<T>(key: string): T | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data as T;
  }
  cache.delete(key);
  return null;
}

function setCache(key: string, data: unknown): void {
  cache.set(key, { data, timestamp: Date.now() });

  // Limpar cache antigo (max 100 entries)
  if (cache.size > 100) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
}

async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise(resolve =>
      setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest)
    );
  }

  lastRequestTime = Date.now();
}

// ============================================================================
// HAVERSINE (FALLBACK)
// ============================================================================

/**
 * Calcula distância em linha reta usando fórmula de Haversine
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
 * Estima distância de rota baseado em Haversine (linha reta × 1.3)
 */
export function estimateRouteDistance(origin: Coordinate, destination: Coordinate): DistanceResult {
  const straightLine = calculateHaversineDistance(
    origin.latitude,
    origin.longitude,
    destination.latitude,
    destination.longitude
  );

  // Fator de correção: rotas são ~30% mais longas que linha reta
  const distance = Math.round(straightLine * 1.3);
  // Velocidade média urbana: ~30 km/h
  const duration = Math.round((distance / 1000) * 2 * 60); // segundos

  return {
    distance,
    duration,
    distanceText: formatDistance(distance),
    durationText: formatDuration(duration),
  };
}

// ============================================================================
// FORMATTING
// ============================================================================

export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return 'menos de 1 min';
  if (seconds < 3600) {
    const minutes = Math.round(seconds / 60);
    return `${minutes} min`;
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`;
}

// ============================================================================
// MANEUVER TRANSLATION
// ============================================================================

const MANEUVER_TRANSLATIONS: Record<string, Record<string, string>> = {
  turn: {
    left: 'Vire à esquerda',
    right: 'Vire à direita',
    'sharp left': 'Vire acentuadamente à esquerda',
    'sharp right': 'Vire acentuadamente à direita',
    'slight left': 'Pegue à esquerda',
    'slight right': 'Pegue à direita',
    straight: 'Continue em frente',
    uturn: 'Faça o retorno',
  },
  'new name': {
    default: 'Continue em',
  },
  depart: {
    default: 'Siga em direção a',
  },
  arrive: {
    default: 'Você chegou ao destino',
  },
  merge: {
    default: 'Entre na via',
  },
  'on ramp': {
    default: 'Entre na rampa',
  },
  'off ramp': {
    default: 'Pegue a saída',
  },
  fork: {
    left: 'Mantenha-se à esquerda',
    right: 'Mantenha-se à direita',
  },
  'end of road': {
    left: 'No final da rua, vire à esquerda',
    right: 'No final da rua, vire à direita',
  },
  continue: {
    default: 'Continue',
  },
  roundabout: {
    default: 'Na rotatória',
  },
  rotary: {
    default: 'Na rotatória',
  },
  'roundabout turn': {
    default: 'Na rotatória',
  },
  notification: {
    default: '',
  },
};

function translateManeuver(type: string, modifier?: string, streetName?: string): string {
  const typeTranslations = MANEUVER_TRANSLATIONS[type];

  if (!typeTranslations) {
    return streetName ? `Continue para ${streetName}` : 'Continue';
  }

  let instruction = typeTranslations[modifier || ''] || typeTranslations.default || 'Continue';

  if (streetName && streetName !== '' && type !== 'arrive') {
    instruction += ` ${streetName}`;
  }

  return instruction;
}

// ============================================================================
// OSRM API CALLS
// ============================================================================

/**
 * Obtém rota entre dois ou mais pontos
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
      console.warn('OSRM: No route found, using Haversine fallback');
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
    console.error('OSRM getRoute error:', error);
    // Fallback to Haversine
    return createFallbackRoute(origin, destination, waypoints);
  }
}

/**
 * Cria rota de fallback usando Haversine
 */
function createFallbackRoute(
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
    totalDistance += dist * 1.3; // Fator de correção
    totalDuration += (dist * 1.3 / 1000) * 2 * 60; // 30 km/h média
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
 * Calcula distância e duração entre dois pontos (para useDistanceToStop)
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
    console.error('OSRM getDistance error:', error);
    return estimateRouteDistance(origin, destination);
  }
}

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
    console.error('OSRM optimizeWaypoints error:', error);
    return null;
  }
}

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
    console.error('Error decoding polyline:', error);
    return [];
  }
}

/**
 * Limpa o cache manualmente
 */
export function clearCache(): void {
  cache.clear();
}

/**
 * Retorna estatísticas do cache
 */
export function getCacheStats(): { size: number; oldestEntry: number | null } {
  let oldest: number | null = null;

  cache.forEach((value) => {
    if (oldest === null || value.timestamp < oldest) {
      oldest = value.timestamp;
    }
  });

  return {
    size: cache.size,
    oldestEntry: oldest ? Date.now() - oldest : null,
  };
}

// ============================================================================
// GOOGLE DIRECTIONS FORMAT ADAPTER
// ============================================================================

/**
 * Formato compatível com GoogleDirectionsResult
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
}

interface OSRMTripResponse {
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

/**
 * Obtém rota otimizada no formato compatível com Google Directions
 *
 * Esta função substitui googleMapsService.getDirections para economia de custos.
 * Usa OSRM Trip API para otimização (TSP) e Route API para rotas simples.
 *
 * @param origin - Ponto de origem
 * @param destination - Ponto de destino
 * @param waypoints - Pontos intermediários (opcional)
 * @param optimize - Se true, otimiza a ordem dos waypoints (padrão: true)
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
    // Verificar se é rota circular (origem == destino)
    const isCircular =
      Math.abs(origin.latitude - destination.latitude) < 0.0001 &&
      Math.abs(origin.longitude - destination.longitude) < 0.0001;

    // Se tem waypoints e quer otimizar, usar Trip API
    if (waypoints && waypoints.length > 0 && optimize && isCircular) {
      return await getOptimizedCircularRoute(origin, waypoints, cacheKey);
    }

    // Caso contrário, usar Route API simples
    return await getSimpleRoute(origin, destination, waypoints, cacheKey);
  } catch (error) {
    console.error('OSRM getOptimizedDirections error:', error);
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

  // Trip API: origem + waypoints, roundtrip=true para voltar à origem
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
      console.warn('OSRM Trip: No route found, falling back');
      return createFallbackDirections(origin, origin, waypoints);
    }

    const trip = data.trips[0];

    // Extrair ordem otimizada dos waypoints (excluindo origem que é índice 0)
    // waypoint_index indica a posição no array de entrada
    const waypointOrder = data.waypoints
      .filter(wp => wp.waypoint_index > 0) // Excluir origem
      .sort((a, b) => {
        // Ordenar pela ordem em que aparecem na trip
        const aLegIndex = data.waypoints.findIndex(w => w.waypoint_index === a.waypoint_index);
        const bLegIndex = data.waypoints.findIndex(w => w.waypoint_index === b.waypoint_index);
        return aLegIndex - bLegIndex;
      })
      .map(wp => wp.waypoint_index - 1); // Ajustar índice (remover offset da origem)

    // Construir legs
    const legs: DirectionsResultLeg[] = trip.legs.map((leg, index) => {
      const startWp = data.waypoints[index];
      const endWp = data.waypoints[index + 1] || data.waypoints[0]; // Volta à origem

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
 * Rota simples (não circular ou sem otimização)
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

    // Para rota simples, a ordem é a mesma da entrada
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

/**
 * Cria resultado de fallback usando Haversine
 */
function createFallbackDirections(
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
    ) * 1.3; // Fator de correção

    const duration = (dist / 1000) * 2 * 60; // 30 km/h média

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
