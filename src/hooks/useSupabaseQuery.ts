/**
 * Hook para queries Supabase com cache e SWR pattern
 *
 * Encapsula:
 * - Query builder do Supabase
 * - Cache com TTL configurável
 * - Stale-while-revalidate (mostra cache imediatamente, atualiza em background)
 * - Tratamento de erros padronizado
 * - Refetch manual
 *
 * @example
 * const { data, loading, error, refetch } = useSupabaseQuery(
 *   () => supabase.from('rotas').select('*').eq('unidade_id', unidadeId),
 *   {
 *     cacheKey: `rotas_${unidadeId}`,
 *     cacheTTL: CACHE_TTL.ROUTES_LIST,
 *     enabled: !!unidadeId,
 *   }
 * );
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { getCache, setCache, clearCache, CACHE_TTL } from '@/lib/cache';

export interface UseSupabaseQueryOptions {
  /** Chave única para cache (se não fornecida, não usa cache) */
  cacheKey?: string;
  /** TTL do cache em ms (default: 5 minutos) */
  cacheTTL?: number;
  /** Se false, não executa a query (útil para queries condicionais) */
  enabled?: boolean;
  /** Usar stale-while-revalidate (mostra cache antigo enquanto busca novo) */
  staleWhileRevalidate?: boolean;
  /** Callback de sucesso */
  onSuccess?: <T>(data: T) => void;
  /** Callback de erro */
  onError?: (error: string) => void;
}

export interface UseSupabaseQueryReturn<T> {
  /** Dados retornados pela query */
  data: T | null;
  /** Indica se a query está em andamento */
  loading: boolean;
  /** Mensagem de erro (se houver) */
  error: string | null;
  /** Indica se os dados vieram do cache */
  fromCache: boolean;
  /** Refaz a query (ignorando cache) */
  refetch: () => Promise<void>;
  /** Atualiza os dados localmente (otimistic update) */
  mutate: (newData: T | ((prev: T | null) => T)) => void;
  /** Invalida o cache */
  invalidate: () => Promise<void>;
}

// Tipo genérico para query builders do Supabase
interface SupabaseQueryResult<T> {
  data: T | null;
  error: { message: string } | null;
}

type SupabaseQueryFn<T> = () => PromiseLike<SupabaseQueryResult<T>>;

/**
 * Hook para queries Supabase com cache integrado
 */
export function useSupabaseQuery<T>(
  queryFn: SupabaseQueryFn<T>,
  options: UseSupabaseQueryOptions = {}
): UseSupabaseQueryReturn<T> {
  const {
    cacheKey,
    cacheTTL = CACHE_TTL.USER_DATA,
    enabled = true,
    staleWhileRevalidate = true,
    onSuccess,
    onError,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);

  // Refs para controle
  const mountedRef = useRef(true);
  const fetchingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const executeQueryRef = useRef<(ignoreCache?: boolean) => Promise<void>>(async () => {});

  const executeQuery = useCallback(
    async (ignoreCache = false) => {
      if (!enabled) return;

      // Evitar múltiplas execuções simultâneas
      if (fetchingRef.current) return;

      // Cancelar request anterior se houver
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      fetchingRef.current = true;

      // 1. Tentar carregar do cache primeiro (se não ignorar)
      if (cacheKey && !ignoreCache && staleWhileRevalidate) {
        try {
          const cached = await getCache<T>(cacheKey);
          if (cached !== null && mountedRef.current) {
            setData(cached);
            setFromCache(true);
            setLoading(false);
            // Continua para buscar dados frescos em background
          }
        } catch {
          // Ignorar erros de cache
        }
      }

      if (!fromCache || ignoreCache) {
        setLoading(true);
      }
      setError(null);

      try {
        // 2. Executar query
        const result = await queryFn();

        if (!mountedRef.current) return;

        if (result.error) {
          throw new Error(result.error.message);
        }

        const queryData = result.data;

        setData(queryData);
        setFromCache(false);
        onSuccess?.(queryData);

        // 3. Salvar no cache
        if (cacheKey && queryData !== null) {
          await setCache(cacheKey, queryData, cacheTTL);
        }
      } catch (err) {
        if (!mountedRef.current) return;

        const errorMessage =
          err instanceof Error ? err.message : 'Erro desconhecido';
        setError(errorMessage);
        onError?.(errorMessage);
      } finally {
        if (mountedRef.current) {
          setLoading(false);
          fetchingRef.current = false;
        }
      }
    },
    [
      enabled,
      cacheKey,
      cacheTTL,
      staleWhileRevalidate,
      queryFn,
      onSuccess,
      onError,
      fromCache,
    ]
  );

  // Sync ref with latest executeQuery function
  useEffect(() => {
    executeQueryRef.current = executeQuery;
  }, [executeQuery]);

  const refetch = useCallback(async () => {
    await executeQuery(true); // ignoreCache = true
  }, [executeQuery]);

  const mutate = useCallback(
    (newData: T | ((prev: T | null) => T)) => {
      setData((prev) => {
        const updated =
          typeof newData === 'function'
            ? (newData as (prev: T | null) => T)(prev)
            : newData;

        // Atualizar cache também
        if (cacheKey) {
          setCache(cacheKey, updated, cacheTTL);
        }

        return updated;
      });
    },
    [cacheKey, cacheTTL]
  );

  const invalidate = useCallback(async () => {
    if (cacheKey) {
      await clearCache(cacheKey);
    }
    setData(null);
    setFromCache(false);
  }, [cacheKey]);

  // Cleanup no unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Execução inicial - uses ref to avoid re-execution when executeQuery changes
  useEffect(() => {
    if (enabled) {
      executeQueryRef.current();
    }
  }, [enabled]);

  return {
    data,
    loading,
    error,
    fromCache,
    refetch,
    mutate,
    invalidate,
  };
}

/**
 * Hook simplificado para queries sem cache
 * Útil para dados que mudam frequentemente
 */
export function useSupabaseQueryNoCache<T>(
  queryFn: SupabaseQueryFn<T>,
  options: Omit<UseSupabaseQueryOptions, 'cacheKey' | 'cacheTTL' | 'staleWhileRevalidate'> = {}
): Omit<UseSupabaseQueryReturn<T>, 'fromCache' | 'invalidate'> {
  const result = useSupabaseQuery(queryFn, {
    ...options,
    cacheKey: undefined,
    staleWhileRevalidate: false,
  });

  return {
    data: result.data,
    loading: result.loading,
    error: result.error,
    refetch: result.refetch,
    mutate: result.mutate,
  };
}
