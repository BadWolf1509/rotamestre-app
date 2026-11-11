/**
 * Hook for route cache management (stale-while-revalidate pattern)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback } from 'react';

import { logger } from '@/lib/logger';
import type { IntervaloDatas } from '@/lib/periodo';

import type { RotaHistorico, CachedRotas } from './types';

const CACHE_KEY_PREFIX = 'gestao_rotas_cache_';

interface UseRotasCacheOptions {
  unidadeId: string | null;
  /** Período da lista: cada período tem a sua chave (padrão: todo). */
  periodo?: IntervaloDatas;
}

interface UseRotasCacheResult {
  getCacheKey: () => string;
  /** Dados do cache e quando foram gravados (epoch ms). */
  loadFromCache: () => Promise<CachedRotas | null>;
  saveToCache: (data: RotaHistorico[]) => Promise<void>;
  clearCache: () => Promise<void>;
}

/**
 * Manages route cache with stale-while-revalidate pattern
 */
export function useRotasCache({
  unidadeId,
  periodo,
}: UseRotasCacheOptions): UseRotasCacheResult {
  // As strings, não o objeto: a identidade dele muda a cada render.
  const de = periodo?.de ?? null;
  const ate = periodo?.ate ?? null;
  const getCacheKey = useCallback(() => {
    const sufixo = de && ate ? `${de}_${ate}` : 'todo';
    return `${CACHE_KEY_PREFIX}${unidadeId}_${sufixo}`;
  }, [unidadeId, de, ate]);

  const loadFromCache = useCallback(async (): Promise<CachedRotas | null> => {
    try {
      const cacheKey = getCacheKey();
      const cached = await AsyncStorage.getItem(cacheKey);
      if (!cached) return null;

      const { data, timestamp }: CachedRotas = JSON.parse(cached);

      // Stale-while-revalidate: return data even if stale
      // Revalidation happens in background in the main hook
      return { data, timestamp };
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
    [getCacheKey],
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
