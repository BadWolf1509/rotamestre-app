/**
 * Hook useRouteDirections
 * Busca a rota real do Google Directions API usando fetch direto
 * e decodifica a polyline para uso no react-native-maps
 * Com cache em AsyncStorage para modo offline
 */
import polyline from '@mapbox/polyline';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
const CACHE_PREFIX = 'route_cache_';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 horas em ms

interface Coordinate {
  latitude: number;
  longitude: number;
}

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
    console.warn('[useRouteDirections] Erro ao carregar cache:', error);
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
    console.warn('[useRouteDirections] Erro ao salvar cache:', error);
  }
}

/**
 * Hook para buscar e decodificar a rota real entre paradas usando Google Directions API
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

    // Se não tiver API key, usar fallback de linhas retas
    if (!GOOGLE_MAPS_API_KEY) {
      console.warn('[useRouteDirections] Sem API key, usando linhas retas');
      setRouteCoordinates(
        validParadas.map((p) => ({
          latitude: p.latitude!,
          longitude: p.longitude!,
        }))
      );
      setIsFromCache(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Tentar carregar do cache primeiro
      const cachedData = await loadFromCache(cacheKey);
      if (cachedData) {
        console.log('[useRouteDirections] Usando rota do cache');
        setRouteCoordinates(cachedData.coordinates);
        setRouteInfo(cachedData.routeInfo);
        setIsFromCache(true);
        setIsLoading(false);

        // Buscar atualização em background (sem mostrar loading)
        fetchFromAPI(validParadas, cacheKey, false);
        return;
      }

      // Sem cache, buscar da API
      await fetchFromAPI(validParadas, cacheKey, true);
    } catch (err) {
      console.error('[useRouteDirections] Erro:', err);
      setError(err instanceof Error ? err.message : 'Erro ao buscar rota');

      // Tentar carregar cache expirado como fallback
      try {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          const data: CachedRoute = JSON.parse(cached);
          setRouteCoordinates(data.coordinates);
          setRouteInfo(data.routeInfo);
          setIsFromCache(true);
          console.log('[useRouteDirections] Usando cache expirado como fallback offline');
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

  // Função interna para buscar da API
  const fetchFromAPI = async (
    validParadas: Parada[],
    cacheKey: string,
    updateState: boolean
  ) => {
    try {
      const origin = validParadas[0];
      const destination = validParadas[validParadas.length - 1];
      const waypoints = validParadas.slice(1, -1);

      let waypointsStr: string | undefined;
      if (waypoints.length > 0) {
        waypointsStr = waypoints
          .map((wp) => `${wp.latitude},${wp.longitude}`)
          .join('|');
      }

      let data;

      if (Platform.OS === 'web') {
        // Web: usar Edge Function para evitar CORS
        const { data: edgeData, error } = await supabase.functions.invoke('google-directions', {
          body: {
            origin: `${origin.latitude},${origin.longitude}`,
            destination: `${destination.latitude},${destination.longitude}`,
            waypoints: waypointsStr,
            mode: 'driving',
          },
        });

        if (error) throw error;
        data = edgeData;
      } else {
        // Mobile: chamar API diretamente (sem CORS)
        let waypointsParam = '';
        if (waypointsStr) {
          waypointsParam = `&waypoints=${waypointsStr}`;
        }

        const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}${waypointsParam}&key=${GOOGLE_MAPS_API_KEY}`;

        const response = await fetch(url);
        data = await response.json();
      }

      if (data.status === 'OK' && data.routes.length > 0) {
        const route = data.routes[0];

        const encodedPolyline = route.overview_polyline.points;
        const decodedPoints = polyline.decode(encodedPolyline);

        const coordinates: Coordinate[] = decodedPoints.map(([lat, lng]: [number, number]) => ({
          latitude: lat,
          longitude: lng,
        }));

        const distanceMeters = route.legs.reduce(
          (acc: number, leg: { distance: { value: number } }) => acc + leg.distance.value,
          0
        );
        const durationSeconds = route.legs.reduce(
          (acc: number, leg: { duration: { value: number } }) => acc + leg.duration.value,
          0
        );

        const newRouteInfo = { distanceMeters, durationSeconds };

        // Salvar no cache
        await saveToCache(cacheKey, coordinates, newRouteInfo);

        if (updateState) {
          setRouteCoordinates(coordinates);
          setRouteInfo(newRouteInfo);
          setIsFromCache(false);
        }
      } else if (updateState) {
        console.warn('[useRouteDirections] API retornou status:', data.status);
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
        console.error('[useRouteDirections] Erro na API:', err);
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
