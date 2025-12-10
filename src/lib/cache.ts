/**
 * Sistema de Cache com TTL (Time To Live)
 * Padrão SWR (stale-while-revalidate)
 *
 * Uso:
 * - Dados de usuário: TTL de 5 minutos
 * - Dados de dashboard: TTL de 2 minutos (muda com frequência)
 * - Dados estáticos: TTL de 30 minutos
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

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
 * Obtém dados do cache (memória primeiro, depois AsyncStorage)
 * Retorna null se cache expirou ou não existe
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
    console.warn('[Cache] Erro ao ler cache:', error);
    return null;
  }
}

/**
 * Salva dados no cache (memória e AsyncStorage)
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
    console.warn('[Cache] Erro ao salvar cache:', error);
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
    console.warn('[Cache] Erro ao limpar cache:', error);
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
    console.warn('[Cache] Erro ao limpar todo cache:', error);
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
      console.log(`[Cache] Removidas ${toRemove.length} entradas expiradas`);
    }
  } catch (error) {
    console.warn('[Cache] Erro ao limpar cache expirado:', error);
  }
}

/**
 * Hook pattern: Busca dados com cache (SWR)
 * Retorna dados em cache imediatamente, depois atualiza em background
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
 * Invalida caches relacionados quando dados mudam
 * Ex: Quando uma rota é criada, invalida cache do dashboard
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
