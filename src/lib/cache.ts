/**
 * Cache System with TTL (Time To Live)
 *
 * Multi-tier caching strategy:
 * 1. Memory cache (Map) - Fast access, volatile
 * 2. AsyncStorage - Persistent across app restarts
 *
 * Features:
 * - Automatic expiration based on TTL
 * - Memory-first lookup for performance
 * - Persistence to survive app restarts
 * - SWR pattern support via getCacheWithFetch()
 * - Automatic cache invalidation for related entities
 *
 * TTL Guidelines:
 * - USER_DATA: 5 min - User profile, permissions
 * - DASHBOARD: 2 min - Frequently changing metrics
 * - ROUTES_LIST: 3 min - Route listings
 * - MOTORISTAS: 10 min - Driver list (rarely changes)
 * - STATIC_DATA: 30 min - Configuration, lookup tables
 * - SHORT: 1 min - Very dynamic data
 * - AUTOCOMPLETE: 5 min - Address autocomplete results
 * - GEOCODING: 30 min - Geocoding results (addresses don't change)
 * - ROUTE_OPTIMIZATION: 2 min - OSRM route calculations
 *
 * @example
 * ```ts
 * import { getCache, setCache, CACHE_TTL, CACHE_KEYS } from '@/lib/cache';
 *
 * // Simple usage
 * const cached = await getCache<User>('user_123');
 * if (!cached) {
 *   const user = await fetchUser('123');
 *   await setCache('user_123', user, CACHE_TTL.USER_DATA);
 * }
 *
 * // Using standardized keys
 * const dashboardKey = CACHE_KEYS.DASHBOARD(unidadeId);
 * const data = await getCache(dashboardKey);
 *
 * // SWR pattern
 * const { data, fromCache } = await getCacheWithFetch(
 *   'rotas_list',
 *   () => fetchRotas(),
 *   { ttl: CACHE_TTL.ROUTES_LIST }
 * );
 * ```
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { logger } from './logger';

// Prefixo para identificar cache vs outros dados do AsyncStorage
const CACHE_PREFIX = '@cache_';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // em milissegundos
}

interface CacheOptions {
  ttl?: number; // TTL em milissegundos (padrão: 5 minutos)
  forceRefresh?: boolean; // Ignorar cache e forçar refresh
}

// TTLs padrão para diferentes tipos de dados
export const CACHE_TTL = {
  USER_DATA: 5 * 60 * 1000,      // 5 minutos
  DASHBOARD: 2 * 60 * 1000,      // 2 minutos
  ROUTES_LIST: 3 * 60 * 1000,    // 3 minutos
  MOTORISTAS: 10 * 60 * 1000,    // 10 minutos
  STATIC_DATA: 30 * 60 * 1000,   // 30 minutos
  SHORT: 1 * 60 * 1000,          // 1 minuto
  AUTOCOMPLETE: 5 * 60 * 1000,   // 5 minutos - autocomplete de endereços
  GEOCODING: 30 * 60 * 1000,     // 30 minutos - geocoding (endereços não mudam)
  ROUTE_OPTIMIZATION: 2 * 60 * 1000, // 2 minutos - otimização de rotas OSRM
} as const;

// Cache em memória para acesso rápido (sem I/O)
const memoryCache = new Map<string, CacheEntry<unknown>>();

/**
 * Verifica se uma entrada de cache ainda é válida
 */
function isValid<T>(entry: CacheEntry<T> | null): boolean {
  if (!entry) return false;
  const now = Date.now();
  return now - entry.timestamp < entry.ttl;
}

/**
 * Retrieves data from cache with automatic expiration check.
 *
 * Lookup order:
 * 1. Memory cache (instant)
 * 2. AsyncStorage (if not in memory)
 *
 * If data is found in AsyncStorage but not memory, it's restored to memory
 * for faster subsequent access.
 *
 * @param key - Cache key (without prefix)
 * @returns Cached data or null if not found/expired
 *
 * @example
 * ```ts
 * const user = await getCache<User>('user_123');
 * if (user) {
 *   console.log('Cache hit:', user.nome);
 * }
 * ```
 */
export async function getCache<T>(key: string): Promise<T | null> {
  const cacheKey = CACHE_PREFIX + key;

  // 1. Verificar memória primeiro (mais rápido)
  const memEntry = memoryCache.get(cacheKey) as CacheEntry<T> | undefined;
  if (memEntry && isValid(memEntry)) {
    return memEntry.data;
  }

  // 2. Se não estiver em memória, verificar AsyncStorage
  try {
    const stored = await AsyncStorage.getItem(cacheKey);
    if (!stored) return null;

    const entry = JSON.parse(stored) as CacheEntry<T>;
    if (!isValid(entry)) {
      // Cache expirado - remover
      await AsyncStorage.removeItem(cacheKey);
      memoryCache.delete(cacheKey);
      return null;
    }

    // Restaurar na memória para próximos acessos
    memoryCache.set(cacheKey, entry);
    return entry.data;
  } catch (error) {
    logger.warn('[Cache] Erro ao ler cache:', error);
    return null;
  }
}

/**
 * Stores data in cache with specified TTL.
 *
 * Data is stored in both:
 * 1. Memory cache (for fast access)
 * 2. AsyncStorage (for persistence)
 *
 * @param key - Cache key (without prefix)
 * @param data - Data to cache
 * @param ttl - Time to live in milliseconds (default: 5 minutes)
 *
 * @example
 * ```ts
 * await setCache('user_123', userData, CACHE_TTL.USER_DATA);
 * await setCache('geocode_result', coords, CACHE_TTL.GEOCODING);
 * ```
 */
export async function setCache<T>(
  key: string,
  data: T,
  ttl: number = CACHE_TTL.USER_DATA
): Promise<void> {
  const cacheKey = CACHE_PREFIX + key;
  const entry: CacheEntry<T> = {
    data,
    timestamp: Date.now(),
    ttl,
  };

  // 1. Salvar em memória (acesso imediato)
  memoryCache.set(cacheKey, entry as CacheEntry<unknown>);

  // 2. Persistir no AsyncStorage (sobrevive restart do app)
  try {
    await AsyncStorage.setItem(cacheKey, JSON.stringify(entry));
  } catch (error) {
    logger.warn('[Cache] Erro ao salvar cache:', error);
  }
}

/**
 * Remove uma entrada específica do cache
 */
export async function clearCache(key: string): Promise<void> {
  const cacheKey = CACHE_PREFIX + key;
  memoryCache.delete(cacheKey);

  try {
    await AsyncStorage.removeItem(cacheKey);
  } catch (error) {
    logger.warn('[Cache] Erro ao limpar cache:', error);
  }
}

/**
 * Remove todas as entradas do cache
 */
export async function clearAllCache(): Promise<void> {
  memoryCache.clear();

  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(k => k.startsWith(CACHE_PREFIX));
    if (cacheKeys.length > 0) {
      await AsyncStorage.multiRemove(cacheKeys);
    }
  } catch (error) {
    logger.warn('[Cache] Erro ao limpar todo cache:', error);
  }
}

/**
 * Remove entradas expiradas do cache (garbage collection)
 */
export async function cleanExpiredCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(k => k.startsWith(CACHE_PREFIX));

    const toRemove: string[] = [];

    for (const key of cacheKeys) {
      const stored = await AsyncStorage.getItem(key);
      if (stored) {
        const entry = JSON.parse(stored) as CacheEntry<unknown>;
        if (!isValid(entry)) {
          toRemove.push(key);
          memoryCache.delete(key);
        }
      }
    }

    if (toRemove.length > 0) {
      await AsyncStorage.multiRemove(toRemove);
    }
  } catch (error) {
    logger.warn('[Cache] Erro ao limpar cache expirado:', error);
  }
}

/**
 * Fetches data with cache-first strategy (SWR pattern).
 *
 * Behavior:
 * 1. If cache exists and valid → return cached data immediately
 * 2. If cache miss or forceRefresh → call fetcher, cache result, return
 *
 * This is NOT true SWR (doesn't revalidate in background), but provides
 * the cache-first benefit for better UX.
 *
 * @param key - Cache key (without prefix)
 * @param fetcher - Async function to fetch fresh data
 * @param options - Cache options (ttl, forceRefresh)
 * @returns Object with data and fromCache flag
 *
 * @example
 * ```ts
 * // Normal usage - returns cached data if available
 * const { data: rotas, fromCache } = await getCacheWithFetch(
 *   'rotas_list',
 *   () => supabase.from('rotas').select('*'),
 *   { ttl: CACHE_TTL.ROUTES_LIST }
 * );
 *
 * // Force refresh - ignores cache
 * const { data } = await getCacheWithFetch(
 *   'rotas_list',
 *   () => supabase.from('rotas').select('*'),
 *   { forceRefresh: true }
 * );
 * ```
 */
export async function getCacheWithFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {}
): Promise<{ data: T; fromCache: boolean }> {
  const { ttl = CACHE_TTL.USER_DATA, forceRefresh = false } = options;

  // Se forçar refresh, buscar dados frescos
  if (forceRefresh) {
    const freshData = await fetcher();
    await setCache(key, freshData, ttl);
    return { data: freshData, fromCache: false };
  }

  // Tentar obter do cache
  const cached = await getCache<T>(key);
  if (cached !== null) {
    return { data: cached, fromCache: true };
  }

  // Cache miss - buscar dados frescos
  const freshData = await fetcher();
  await setCache(key, freshData, ttl);
  return { data: freshData, fromCache: false };
}

/**
 * Invalidates related caches when data changes.
 *
 * Call this after mutations (create/update/delete) to ensure
 * dependent views show fresh data.
 *
 * Entity → Invalidated Caches:
 * - rotas: dashboard, rotas_list, kpis
 * - paradas: dashboard, rotas_list
 * - usuarios: user_data, motoristas
 * - incidentes: dashboard, incidentes_list
 *
 * @param entity - The entity type that changed
 *
 * @example
 * ```ts
 * // After creating a new route
 * await supabase.from('rotas').insert(newRota);
 * await invalidateRelatedCaches('rotas');
 *
 * // After updating a stop
 * await supabase.from('paradas').update({ status: 'concluida' });
 * await invalidateRelatedCaches('paradas');
 * ```
 */
export async function invalidateRelatedCaches(entity: 'rotas' | 'paradas' | 'usuarios' | 'incidentes'): Promise<void> {
  const relatedKeys: Record<string, string[]> = {
    rotas: ['dashboard', 'rotas_list', 'kpis'],
    paradas: ['dashboard', 'rotas_list'],
    usuarios: ['user_data', 'motoristas'],
    incidentes: ['dashboard', 'incidentes_list'],
  };

  const keysToInvalidate = relatedKeys[entity] || [];

  for (const key of keysToInvalidate) {
    await clearCache(key);
  }
}

// Chaves de cache padronizadas
export const CACHE_KEYS = {
  USER_DATA: (userId: string) => `user_${userId}`,
  DASHBOARD: (unidadeId: string) => `dashboard_${unidadeId}`,
  ROTAS_LIST: (unidadeId: string) => `rotas_${unidadeId}`,
  MOTORISTAS: (unidadeId: string) => `motoristas_${unidadeId}`,
  INCIDENTES: (unidadeId: string) => `incidentes_${unidadeId}`,
} as const;
