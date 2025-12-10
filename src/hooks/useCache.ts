/**
 * Hook para usar cache com padrão SWR (stale-while-revalidate)
 *
 * Retorna dados em cache imediatamente enquanto busca dados frescos em background.
 * Reduz latência percebida e evita recarregamentos desnecessários.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

import {
  getCache,
  setCache,
  clearCache,
  CACHE_TTL,
} from '@/lib/cache';

interface UseCacheOptions<T> {
  /** Chave única para identificar os dados no cache */
  key: string;
  /** Função que busca os dados (chamada no cache miss ou refresh) */
  fetcher: () => Promise<T>;
  /** TTL em ms (padrão: 5 minutos) */
  ttl?: number;
  /** Se true, não busca dados automaticamente */
  skip?: boolean;
  /** Dados iniciais (usado enquanto cache e fetch não retornam) */
  initialData?: T;
  /** Callback quando dados são atualizados */
  onSuccess?: (data: T) => void;
  /** Callback quando ocorre erro */
  onError?: (error: Error) => void;
}

interface UseCacheResult<T> {
  /** Dados (do cache ou frescos) */
  data: T | null;
  /** True enquanto busca dados (apenas no primeiro load) */
  loading: boolean;
  /** True enquanto revalida em background */
  isValidating: boolean;
  /** Erro se houver */
  error: Error | null;
  /** True se dados vieram do cache */
  fromCache: boolean;
  /** Força refresh dos dados */
  refresh: () => Promise<void>;
  /** Invalida o cache (próximo acesso buscará dados frescos) */
  invalidate: () => Promise<void>;
}

export function useCache<T>(options: UseCacheOptions<T>): UseCacheResult<T> {
  const {
    key,
    fetcher,
    ttl = CACHE_TTL.USER_DATA,
    skip = false,
    initialData = null,
    onSuccess,
    onError,
  } = options;

  const [data, setData] = useState<T | null>(initialData);
  const [loading, setLoading] = useState(!skip);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [fromCache, setFromCache] = useState(false);

  const mountedRef = useRef(true);
  const fetchingRef = useRef(false);

  // Função para buscar dados
  const fetchData = useCallback(async (forceRefresh = false) => {
    if (skip || fetchingRef.current) return;

    fetchingRef.current = true;

    try {
      // 1. Verificar cache primeiro (se não for refresh forçado)
      if (!forceRefresh) {
        const cached = await getCache<T>(key);
        if (cached !== null && mountedRef.current) {
          setData(cached);
          setFromCache(true);
          setLoading(false);
          onSuccess?.(cached);

          // Revalidar em background (SWR pattern)
          setIsValidating(true);
        }
      }

      // 2. Buscar dados frescos
      const freshData = await fetcher();

      if (mountedRef.current) {
        setData(freshData);
        setFromCache(false);
        setError(null);
        await setCache(key, freshData, ttl);
        onSuccess?.(freshData);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error(`[useCache] Erro ao buscar ${key}:`, error);

      if (mountedRef.current) {
        setError(error);
        onError?.(error);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setIsValidating(false);
      }
      fetchingRef.current = false;
    }
  }, [key, fetcher, ttl, skip, onSuccess, onError]);

  // Buscar dados quando key mudar
  useEffect(() => {
    mountedRef.current = true;
    fetchData();

    return () => {
      mountedRef.current = false;
    };
  }, [fetchData]);

  // Refresh manual
  const refresh = useCallback(async () => {
    setIsValidating(true);
    await fetchData(true);
  }, [fetchData]);

  // Invalidar cache
  const invalidate = useCallback(async () => {
    await clearCache(key);
    setFromCache(false);
  }, [key]);

  return {
    data,
    loading,
    isValidating,
    error,
    fromCache,
    refresh,
    invalidate,
  };
}

/**
 * Hook simplificado para cache de dados estáticos (listas, configs)
 */
export function useStaticCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: { skip?: boolean; ttl?: number } = {}
): UseCacheResult<T> {
  return useCache<T>({
    key,
    fetcher,
    ttl: options.ttl ?? CACHE_TTL.STATIC_DATA,
    skip: options.skip,
  });
}
