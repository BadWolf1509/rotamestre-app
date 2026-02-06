/**
 * Hook for route cache management (stale-while-revalidate pattern)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback } from 'react';

import { logger } from '@/lib/logger';

import type { RotaHistorico, CachedRotas } from './types';

const CACHE_KEY_PREFIX = 'gestao_rotas_cache_';

interface UseRotasCacheOptions {
  unidadeId: string | null;
}

interface UseRotasCacheResult {
  getCacheKey: () => string;
  loadFromCache: () => Promise<RotaHistorico[] | null>;
  saveToCache: (data: RotaHistorico[]) => Promise<void>;
  clearCache: () => Promise<void>;
}

/**
 * Manages route cache with stale-while-revalidate pattern
 */
export function useRotasCache({
  unidadeId,
}: UseRotasCacheOptions): UseRotasCacheResult {
  const getCacheKey = useCallback(() => {
    return `${CACHE_KEY_PREFIX}${unidadeId}`;
  }, [unidadeId]);

  const loadFromCache = useCallback(async (): Promise<RotaHistorico[] | null> => {
    try {
      const cacheKey = getCacheKey();
      const cached = await AsyncStorage.getItem(cacheKey);
      if (!cached) return null;

      const { data }: CachedRotas = JSON.parse(cached);

      // Stale-while-revalidate: return data even if stale
      // Revalidation happens in background in the main hook
      return data;
    } catch (error) {
      logger.warn('Falha ao carregar cache de rotas', error);
      return null;
    }
  }, [getCacheKey]);

  const saveToCache = useCallback(
    async (data: RotaHistorico[]) => {
      try {
        const cacheKey = getCacheKey();
        const cached: CachedRotas = { data, timestamp: Date.now() };
        await AsyncStorage.setItem(cacheKey, JSON.stringify(cached));
      } catch {
        // Silently fail - cache is optional
      }
    },
    [getCacheKey]
  );

  const clearCache = useCallback(async () => {
    try {
      const cacheKey = getCacheKey();
      await AsyncStorage.removeItem(cacheKey);
    } catch {
      // Silently fail
    }
  }, [getCacheKey]);

  return {
    getCacheKey,
    loadFromCache,
    saveToCache,
    clearCache,
  };
}
