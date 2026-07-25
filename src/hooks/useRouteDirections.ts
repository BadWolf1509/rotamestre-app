/**
 * Resolves the road geometry used by route maps.
 *
 * Resolution order:
 * 1. Polyline persisted with the route (works offline and is authoritative).
 * 2. Fresh local cache for the exact ordered coordinates.
 * 3. OSRM.
 * 4. Expired, but valid, road-geometry cache.
 *
 * A straight line between stops is deliberately never returned. Showing one as
 * a route is misleading and can cause a driver to interpret an inaccessible
 * segment as a drivable road.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';

import { logger } from '@/lib/logger';
import { getRoute, decodePolyline, type Coordinate } from '@/lib/osrm';

export const CACHE_PREFIX = 'route_cache_';
export const CACHE_TTL = 24 * 60 * 60 * 1000;

export interface Parada {
  id: string;
  latitude: number | null;
  longitude: number | null;
  ordem: number;
}

export interface RouteInfo {
  distanceMeters: number;
  durationSeconds: number;
}

export type RouteSource = 'stored' | 'cache' | 'stale-cache' | 'osrm' | null;

export interface UseRouteDirectionsOptions {
  /** Encoded polyline persisted in rotas.polyline. */
  encodedPolyline?: string | null;
  /** Persisted totals, already converted to meters and seconds. */
  storedRouteInfo?: RouteInfo | null;
}

export interface UseRouteDirectionsResult {
  routeCoordinates: Coordinate[];
  routeInfo: RouteInfo | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  isFromCache: boolean;
  isStale: boolean;
  source: RouteSource;
}

export interface CachedRoute {
  coordinates: Coordinate[];
  routeInfo: RouteInfo;
  timestamp: number;
}

interface ResolvedRoute {
  coordinates: Coordinate[];
  routeInfo: RouteInfo | null;
}

/** Generates a stable cache key from the ordered stop coordinates. */
export function generateCacheKey(paradas: Parada[]): string {
  const coordStr = [...paradas]
    .sort((a, b) => a.ordem - b.ordem)
    .filter((p) => p.latitude !== null && p.longitude !== null)
    .map((p) => `${p.latitude?.toFixed(5)},${p.longitude?.toFixed(5)}`)
    .join('|');

  return CACHE_PREFIX + coordStr;
}

/** Rejects malformed, out-of-range and degenerate line geometry. */
export function isValidRouteCoordinates(
  coordinates: Coordinate[] | null | undefined,
): coordinates is Coordinate[] {
  return (
    Array.isArray(coordinates) &&
    coordinates.length >= 2 &&
    coordinates.every(
      ({ latitude, longitude }) =>
        Number.isFinite(latitude) &&
        Number.isFinite(longitude) &&
        latitude >= -90 &&
        latitude <= 90 &&
        longitude >= -180 &&
        longitude <= 180,
    )
  );
}

/** Decodes a persisted/OSRM polyline and validates its geometry. */
export function decodeValidPolyline(
  encodedPolyline?: string | null,
): Coordinate[] | null {
  if (!encodedPolyline) return null;

  try {
    const coordinates = decodePolyline(encodedPolyline);
    return isValidRouteCoordinates(coordinates) ? coordinates : null;
  } catch (error) {
    logger.warn('[useRouteDirections] Polyline inválida:', error);
    return null;
  }
}

function isValidRouteInfo(value: unknown): value is RouteInfo {
  if (!value || typeof value !== 'object') return false;
  const routeInfo = value as RouteInfo;
  return (
    Number.isFinite(routeInfo.distanceMeters) &&
    routeInfo.distanceMeters >= 0 &&
    Number.isFinite(routeInfo.durationSeconds) &&
    routeInfo.durationSeconds >= 0
  );
}

function parseCachedRoute(raw: string | null): CachedRoute | null {
  if (!raw) return null;

  const parsed = JSON.parse(raw) as CachedRoute;
  if (
    !isValidRouteCoordinates(parsed.coordinates) ||
    !isValidRouteInfo(parsed.routeInfo) ||
    !Number.isFinite(parsed.timestamp)
  ) {
    return null;
  }

  return parsed;
}

async function readCachedRoute(key: string): Promise<CachedRoute | null> {
  try {
    return parseCachedRoute(await AsyncStorage.getItem(key));
  } catch (error) {
    logger.warn('[useRouteDirections] Erro ao carregar cache:', error);
    return null;
  }
}

/** Loads only a fresh route cache entry. Kept public for tests and callers. */
export async function loadFromCache(key: string): Promise<CachedRoute | null> {
  const data = await readCachedRoute(key);
  if (!data) return null;

  if (Date.now() - data.timestamp > CACHE_TTL) {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      logger.warn(
        '[useRouteDirections] Erro ao remover cache expirado:',
        error,
      );
    }
    return null;
  }

  return data;
}

/** Saves validated road geometry in local storage. */
export async function saveToCache(
  key: string,
  coordinates: Coordinate[],
  routeInfo: RouteInfo,
): Promise<void> {
  if (!isValidRouteCoordinates(coordinates) || !isValidRouteInfo(routeInfo)) {
    logger.warn('[useRouteDirections] Cache de rota inválido ignorado');
    return;
  }

  try {
    const data: CachedRoute = {
      coordinates,
      routeInfo,
      timestamp: Date.now(),
    };
    await AsyncStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    logger.warn('[useRouteDirections] Erro ao salvar cache:', error);
  }
}

async function fetchRoadRoute(
  validParadas: Parada[],
  cacheKey: string,
): Promise<ResolvedRoute> {
  const origin = validParadas[0];
  const destination = validParadas[validParadas.length - 1];
  const waypoints = validParadas.slice(1, -1);

  const route = await getRoute(
    { latitude: origin.latitude!, longitude: origin.longitude! },
    { latitude: destination.latitude!, longitude: destination.longitude! },
    waypoints.map((waypoint) => ({
      latitude: waypoint.latitude!,
      longitude: waypoint.longitude!,
    })),
    { steps: false },
  );

  const coordinates = decodeValidPolyline(route?.polyline);
  if (!route || !coordinates) {
    throw new Error('O serviço viário não retornou uma geometria válida');
  }

  const routeInfo: RouteInfo = {
    distanceMeters: route.distance,
    durationSeconds: route.duration,
  };

  if (!isValidRouteInfo(routeInfo)) {
    throw new Error('O serviço viário retornou métricas inválidas');
  }

  await saveToCache(cacheKey, coordinates, routeInfo);
  return { coordinates, routeInfo };
}

export function useRouteDirections(
  paradas: Parada[],
  options: UseRouteDirectionsOptions = {},
): UseRouteDirectionsResult {
  const { encodedPolyline, storedRouteInfo = null } = options;
  const storedDistanceMeters = storedRouteInfo?.distanceMeters;
  const storedDurationSeconds = storedRouteInfo?.durationSeconds;
  const [routeCoordinates, setRouteCoordinates] = useState<Coordinate[]>([]);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<RouteSource>(null);
  const [isStale, setIsStale] = useState(false);
  const requestVersionRef = useRef(0);

  const resolveRoute = useCallback(
    async (forceNetwork = false) => {
      const requestVersion = ++requestVersionRef.current;
      const isCurrent = () => requestVersion === requestVersionRef.current;
      const applyRoute = (
        resolved: ResolvedRoute,
        resolvedSource: Exclude<RouteSource, null>,
        stale = false,
      ) => {
        if (!isCurrent()) return;
        setRouteCoordinates(resolved.coordinates);
        setRouteInfo(resolved.routeInfo);
        setSource(resolvedSource);
        setIsStale(stale);
        setError(null);
      };

      const validParadas = paradas
        .filter(
          (p) =>
            p.latitude !== null &&
            p.longitude !== null &&
            Number.isFinite(p.latitude) &&
            Number.isFinite(p.longitude) &&
            p.latitude >= -90 &&
            p.latitude <= 90 &&
            p.longitude >= -180 &&
            p.longitude <= 180,
        )
        .sort((a, b) => a.ordem - b.ordem);

      if (validParadas.length < 2) {
        if (isCurrent()) {
          setRouteCoordinates([]);
          setRouteInfo(null);
          setSource(null);
          setIsStale(false);
          setError(null);
          setIsLoading(false);
        }
        return;
      }

      if (!forceNetwork) {
        const storedCoordinates = decodeValidPolyline(encodedPolyline);
        if (storedCoordinates) {
          const persistedInfo =
            storedDistanceMeters != null && storedDurationSeconds != null
              ? {
                  distanceMeters: storedDistanceMeters,
                  durationSeconds: storedDurationSeconds,
                }
              : null;
          applyRoute(
            { coordinates: storedCoordinates, routeInfo: persistedInfo },
            'stored',
          );
          if (isCurrent()) setIsLoading(false);
          return;
        }
      }

      const cacheKey = generateCacheKey(validParadas);
      if (!forceNetwork && isCurrent()) {
        // Prevent the previous route's geometry from lingering while the new
        // ordered stops are being resolved.
        setRouteCoordinates([]);
        setRouteInfo(null);
        setSource(null);
        setIsStale(false);
      }
      setIsLoading(true);
      setError(null);

      let cachedData: CachedRoute | null = null;
      try {
        cachedData = await readCachedRoute(cacheKey);
        if (
          !forceNetwork &&
          cachedData &&
          Date.now() - cachedData.timestamp <= CACHE_TTL
        ) {
          applyRoute(cachedData, 'cache');
          if (isCurrent()) setIsLoading(false);
          return;
        }

        const osrmRoute = await fetchRoadRoute(validParadas, cacheKey);
        applyRoute(osrmRoute, 'osrm');
      } catch (routeError) {
        logger.error(
          '[useRouteDirections] Erro ao resolver rota viária:',
          routeError,
        );

        if (cachedData) {
          applyRoute(cachedData, 'stale-cache', true);
        } else if (isCurrent()) {
          setRouteCoordinates([]);
          setRouteInfo(null);
          setSource(null);
          setIsStale(false);
          setError(
            'Trajeto viário indisponível. Verifique sua conexão e tente novamente.',
          );
        }
      } finally {
        if (isCurrent()) setIsLoading(false);
      }
    },
    [encodedPolyline, paradas, storedDistanceMeters, storedDurationSeconds],
  );

  useEffect(() => {
    void resolveRoute(false);
    return () => {
      requestVersionRef.current += 1;
    };
  }, [resolveRoute]);

  const refetch = useCallback(() => resolveRoute(true), [resolveRoute]);

  return {
    routeCoordinates,
    routeInfo,
    isLoading,
    error,
    refetch,
    isFromCache: source === 'cache' || source === 'stale-cache',
    isStale,
    source,
  };
}
