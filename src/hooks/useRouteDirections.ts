/**
 * Hook useRouteDirections
 *
 * MIGRADO PARA OSRM (Open Source Routing Machine)
 * - Custo: GRATUITO (vs ~R$900/mês do Google Routes API)
 * - Cache: AsyncStorage para modo offline
 * - Fallback: Linhas retas se OSRM falhar
 *
 * @see src/lib/osrm.ts
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useCallback } from 'react';

import { logger } from '@/lib/logger';
import { getRoute, decodePolyline, type Coordinate } from '@/lib/osrm';

const CACHE_PREFIX = 'route_cache_';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 horas em ms

interface Parada {
  id: string;
  latitude: number | null;
  longitude: number | null;
  ordem: number;
}

interface RouteInfo {
  distanceMeters: number;
  durationSeconds: number;
}

interface UseRouteDirectionsResult {
  routeCoordinates: Coordinate[];
  routeInfo: RouteInfo | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  isFromCache: boolean;
}

interface CachedRoute {
  coordinates: Coordinate[];
  routeInfo: RouteInfo;
  timestamp: number;
}

/**
 * Gera uma chave de cache baseada nas coordenadas das paradas
 */
function generateCacheKey(paradas: Parada[]): string {
  const sortedParadas = [...paradas].sort((a, b) => a.ordem - b.ordem);
  const coordStr = sortedParadas
    .filter((p) => p.latitude !== null && p.longitude !== null)
    .map((p) => `${p.latitude?.toFixed(5)},${p.longitude?.toFixed(5)}`)
    .join('|');
  return CACHE_PREFIX + coordStr;
}

/**
 * Carrega rota do cache
 */
async function loadFromCache(key: string): Promise<CachedRoute | null> {
  try {
    const cached = await AsyncStorage.getItem(key);
    if (!cached) return null;

    const data: CachedRoute = JSON.parse(cached);

    // Verificar se o cache ainda é válido
    if (Date.now() - data.timestamp > CACHE_TTL) {
      await AsyncStorage.removeItem(key);
      return null;
    }

    return data;
  } catch (error) {
    logger.warn('[useRouteDirections] Erro ao carregar cache:', error);
    return null;
  }
}

/**
 * Salva rota no cache
 */
async function saveToCache(key: string, coordinates: Coordinate[], routeInfo: RouteInfo): Promise<void> {
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

/**
 * Hook para buscar e decodificar a rota real entre paradas usando OSRM (gratuito!)
 *
 * @param paradas - Array de paradas com coordenadas
 * @returns Coordenadas decodificadas da polyline, informações da rota e estados
 */
export function useRouteDirections(paradas: Parada[]): UseRouteDirectionsResult {
  const [routeCoordinates, setRouteCoordinates] = useState<Coordinate[]>([]);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);

  const fetchRoute = useCallback(async () => {
    // Filtrar paradas com coordenadas válidas e ordenar
    const validParadas = paradas
      .filter((p) => p.latitude !== null && p.longitude !== null)
      .sort((a, b) => a.ordem - b.ordem);

    if (validParadas.length < 2) {
      setRouteCoordinates([]);
      setRouteInfo(null);
      setIsFromCache(false);
      return;
    }

    // Gerar chave de cache
    const cacheKey = generateCacheKey(validParadas);

    setIsLoading(true);
    setError(null);

    try {
      // Tentar carregar do cache primeiro
      const cachedData = await loadFromCache(cacheKey);
      if (cachedData) {
        setRouteCoordinates(cachedData.coordinates);
        setRouteInfo(cachedData.routeInfo);
        setIsFromCache(true);
        setIsLoading(false);

        // Só buscar atualização em background se cache estiver próximo de expirar
        // (menos de 1 hora restante) - evita chamadas desnecessárias
        const cacheAge = Date.now() - cachedData.timestamp;
        const oneHour = 60 * 60 * 1000;
        const shouldRefresh = cacheAge > CACHE_TTL - oneHour;

        if (shouldRefresh) {
          fetchFromOSRM(validParadas, cacheKey, false);
        }
        return;
      }

      // Sem cache, buscar do OSRM
      await fetchFromOSRM(validParadas, cacheKey, true);
    } catch (err) {
      logger.error('[useRouteDirections] Erro:', err);
      setError(err instanceof Error ? err.message : 'Erro ao buscar rota');

      // Tentar carregar cache expirado como fallback
      try {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          const data: CachedRoute = JSON.parse(cached);
          setRouteCoordinates(data.coordinates);
          setRouteInfo(data.routeInfo);
          setIsFromCache(true);
          setIsLoading(false);
          return;
        }
      } catch {
        // Ignora erro de cache
      }

      // Fallback final: linhas retas
      setRouteCoordinates(
        validParadas.map((p) => ({
          latitude: p.latitude!,
          longitude: p.longitude!,
        }))
      );
      setIsFromCache(false);
    } finally {
      setIsLoading(false);
    }
  }, [paradas]);

  // Função interna para buscar do OSRM (gratuito!)
  const fetchFromOSRM = async (
    validParadas: Parada[],
    cacheKey: string,
    updateState: boolean
  ) => {
    try {
      const origin = validParadas[0];
      const destination = validParadas[validParadas.length - 1];
      const waypoints = validParadas.slice(1, -1);

      // Converter para formato OSRM
      const originCoord: Coordinate = {
        latitude: origin.latitude!,
        longitude: origin.longitude!,
      };
      const destCoord: Coordinate = {
        latitude: destination.latitude!,
        longitude: destination.longitude!,
      };
      const waypointCoords: Coordinate[] = waypoints.map((wp) => ({
        latitude: wp.latitude!,
        longitude: wp.longitude!,
      }));

      // Buscar rota do OSRM (gratuito!)
      const route = await getRoute(originCoord, destCoord, waypointCoords, { steps: false });

      if (route && route.polyline) {
        // Decodificar polyline
        const coordinates = decodePolyline(route.polyline);

        const newRouteInfo: RouteInfo = {
          distanceMeters: route.distance,
          durationSeconds: route.duration,
        };

        // Salvar no cache
        await saveToCache(cacheKey, coordinates, newRouteInfo);

        if (updateState) {
          setRouteCoordinates(coordinates);
          setRouteInfo(newRouteInfo);
          setIsFromCache(false);
        }
        return;
      }

      // Fallback se OSRM não retornou rotas válidas
      if (updateState) {
        logger.warn('[useRouteDirections] OSRM não retornou rotas válidas, usando linhas retas');
        setRouteCoordinates(
          validParadas.map((p) => ({
            latitude: p.latitude!,
            longitude: p.longitude!,
          }))
        );
        setRouteInfo(null);
        setIsFromCache(false);
      }
    } catch (err) {
      if (updateState) {
        logger.error('[useRouteDirections] Erro no OSRM:', err);
        setRouteCoordinates(
          validParadas.map((p) => ({
            latitude: p.latitude!,
            longitude: p.longitude!,
          }))
        );
        setIsFromCache(false);
      }
    }
  };

  useEffect(() => {
    fetchRoute();
  }, [fetchRoute]);

  return {
    routeCoordinates,
    routeInfo,
    isLoading,
    error,
    refetch: fetchRoute,
    isFromCache,
  };
}
