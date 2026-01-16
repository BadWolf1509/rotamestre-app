/**
 * Hook para dados com cache e SWR pattern
 *
 * Implementa Stale-While-Revalidate:
 * - Retorna dados do cache imediatamente (se disponíveis)
 * - Busca dados frescos em background
 * - Atualiza quando dados frescos chegam
 *
 * @example
 * const { data, loading, isStale, refresh } = useCachedData(
 *   'user_stats',
 *   () => fetchUserStats(userId),
 *   { ttl: CACHE_TTL.DASHBOARD }
 * );
 */

import { useCallback, useEffect, useRef, useState, DependencyList } from 'react';

import { getCache, setCache, clearCache, CACHE_TTL } from '@/lib/cache';

export interface UseCachedDataOptions {
  /** TTL do cache em ms (default: 5 minutos) */
  ttl?: number;
  /** Se false, não executa automaticamente */
  enabled?: boolean;
  /** Se true, mostra dados do cache enquanto busca novos (default: true) */
  staleWhileRevalidate?: boolean;
  /** Dependências para re-executar (como useEffect deps) */
  deps?: DependencyList;
  /** Callback quando dados são atualizados */
  onUpdate?: <T>(data: T) => void;
}

export interface UseCachedDataReturn<T> {
  /** Dados (do cache ou frescos) */
  data: T | null;
  /** Indica se está carregando */
  loading: boolean;
  /** Indica se os dados atuais são do cache (stale) */
  isStale: boolean;
  /** Erro ocorrido */
  error: Error | null;
  /** Força refresh (ignora cache) */
  refresh: () => Promise<void>;
  /** Limpa cache e dados */
  clear: () => Promise<void>;
  /** Atualiza dados localmente e no cache */
  update: (newData: T | ((prev: T | null) => T)) => Promise<void>;
}

/**
 * Hook para dados com cache SWR
 */
export function useCachedData<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: UseCachedDataOptions = {}
): UseCachedDataReturn<T> {
  const {
    ttl = CACHE_TTL.USER_DATA,
    enabled = true,
    staleWhileRevalidate = true,
    deps = [],
    onUpdate,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [isStale, setIsStale] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Refs para controle
  const mountedRef = useRef(true);
  const fetchingRef = useRef(false);
  const keyRef = useRef(key);

  // Atualizar ref da key
  useEffect(() => {
    keyRef.current = key;
  }, [key]);

  const loadData = useCallback(
    async (ignoreCache = false) => {
      if (!enabled) return;
      if (fetchingRef.current) return;

      fetchingRef.current = true;
      setError(null);

      let hasCachedData = false;

      // 1. Tentar carregar do cache primeiro (SWR)
      if (!ignoreCache && staleWhileRevalidate) {
        try {
          const cached = await getCache<T>(key);
          if (cached !== null && mountedRef.current) {
            setData(cached);
            setIsStale(true);
            setLoading(false);
            hasCachedData = true;
            // Continua para buscar dados frescos
          }
        } catch {
          // Ignorar erros de cache
        }
      }

      // Se não tem cache, mostrar loading
      if (!hasCachedData || ignoreCache) {
        setLoading(true);
      }

      try {
        // 2. Buscar dados frescos
        const freshData = await fetcher();

        if (!mountedRef.current) return;

        setData(freshData);
        setIsStale(false);
        onUpdate?.(freshData);

        // 3. Salvar no cache
        await setCache(key, freshData, ttl);
      } catch (err) {
        if (!mountedRef.current) return;

        const fetchError = err instanceof Error ? err : new Error(String(err));
        setError(fetchError);

        // Se falhou mas tem dados do cache, manter
        // Se não tem nada, o erro será mostrado
      } finally {
        if (mountedRef.current) {
          setLoading(false);
          fetchingRef.current = false;
        }
      }
    },
    [enabled, key, ttl, staleWhileRevalidate, fetcher, onUpdate]
  );

  const refresh = useCallback(async () => {
    await loadData(true);
  }, [loadData]);

  const clear = useCallback(async () => {
    await clearCache(key);
    setData(null);
    setIsStale(false);
    setError(null);
  }, [key]);

  const update = useCallback(
    async (newData: T | ((prev: T | null) => T)) => {
      const updatedData =
        typeof newData === 'function'
          ? (newData as (prev: T | null) => T)(data)
          : newData;

      setData(updatedData);
      setIsStale(false);
      await setCache(key, updatedData, ttl);
      onUpdate?.(updatedData);
    },
    [key, ttl, data, onUpdate]
  );

  // Cleanup
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Execução inicial e quando deps mudam
  useEffect(() => {
    if (enabled) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key, ...deps]);

  return {
    data,
    loading,
    isStale,
    error,
    refresh,
    clear,
    update,
  };
}

/**
 * Variante que não usa SWR - sempre espera dados frescos
 */
export function useFreshData<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: Omit<UseCachedDataOptions, 'staleWhileRevalidate'> = {}
): UseCachedDataReturn<T> {
  return useCachedData(key, fetcher, {
    ...options,
    staleWhileRevalidate: false,
  });
}
