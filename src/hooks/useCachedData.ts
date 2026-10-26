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

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DependencyList,
} from 'react';

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
  /** Indica se está carregando SEM nada para mostrar (skeleton) */
  loading: boolean;
  /** Recarga em andamento com dado da mesma chave já na tela (não é skeleton) */
  refreshing: boolean;
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
  options: UseCachedDataOptions = {},
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
  const [refreshing, setRefreshing] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Refs para controle
  const mountedRef = useRef(true);
  // Contador de requisição: toda carga nova roda e só a MAIS RECENTE escreve
  // no estado. Antes, uma guarda booleana (`fetchingRef`) fazia a carga da
  // chave nova simplesmente não rodar quando a da velha estava em voo — e a
  // resposta velha virava o dado (e o cache) da chave nova (DP-9).
  const requisicaoRef = useRef(0);
  // Chave da carga em voo: deduplica só pedidos da MESMA chave.
  const chaveEmVooRef = useRef<string | null>(null);
  // Espelho síncrono do dado e da chave a que ele pertence. O `update`
  // funcional lê daqui: o `data` da closure é o do último render, e duas
  // atualizações seguidas perdiam a primeira.
  const dataRef = useRef<T | null>(null);
  const chaveDoDadoRef = useRef<string | null>(null);
  const loadDataRef = useRef<(ignoreCache?: boolean) => Promise<void>>(
    async () => {},
  );

  const aplicar = useCallback((valor: T | null, chave: string | null) => {
    dataRef.current = valor;
    chaveDoDadoRef.current = chave;
    setData(valor);
  }, []);

  const loadData = useCallback(
    async (ignoreCache = false) => {
      if (!enabled) return;
      if (!ignoreCache && chaveEmVooRef.current === key) return;

      const minha = ++requisicaoRef.current;
      const vigente = () =>
        mountedRef.current && minha === requisicaoRef.current;
      chaveEmVooRef.current = key;
      setError(null);

      // Dado de outra chave não responde por esta (troca de loja, de rota).
      if (chaveDoDadoRef.current !== null && chaveDoDadoRef.current !== key) {
        aplicar(null, null);
        setIsStale(false);
      }

      let hasCachedData = false;

      // 1. Tentar carregar do cache primeiro (SWR)
      if (!ignoreCache && staleWhileRevalidate) {
        try {
          const cached = await getCache<T>(key);
          if (cached !== null && vigente()) {
            aplicar(cached, key);
            setIsStale(true);
            setLoading(false);
            hasCachedData = true;
            // Continua para buscar dados frescos
          }
        } catch {
          // Ignorar erros de cache
        }
      }

      // Recarga com dado da MESMA chave na tela (refresh, revalidação, evento
      // ao vivo) não vira `loading`: o consumidor troca a lista por skeleton
      // quando `loading` é true, e o dado visível sumia a cada evento (DAT-1).
      // Descartado: `refresh` nunca ligar `loading` — sem dado nenhum (1ª
      // carga falhou) a tela ficaria vazia durante a nova tentativa.
      const temDadoDaChave = chaveDoDadoRef.current === key;
      if (vigente()) {
        if (temDadoDaChave) {
          if (ignoreCache || !hasCachedData) setRefreshing(true);
        } else if (!hasCachedData || ignoreCache) {
          setLoading(true);
        }
      }

      try {
        // 2. Buscar dados frescos
        const freshData = await fetcher();

        // Carga substituída (outra chave, refresh) ou tela desmontada: a
        // resposta não vira estado nem cache.
        if (!vigente()) return;

        aplicar(freshData, key);
        setIsStale(false);
        onUpdate?.(freshData);

        // 3. Salvar no cache
        await setCache(key, freshData, ttl);
      } catch (err) {
        if (!vigente()) return;

        const fetchError = err instanceof Error ? err : new Error(String(err));
        setError(fetchError);

        // Se falhou mas tem dados do cache, manter
        // Se não tem nada, o erro será mostrado
      } finally {
        // Só a carga mais recente encerra o indicador e libera a chave.
        if (minha === requisicaoRef.current) {
          chaveEmVooRef.current = null;
          if (mountedRef.current) {
            setLoading(false);
            setRefreshing(false);
          }
        }
      }
    },
    [enabled, key, ttl, staleWhileRevalidate, fetcher, onUpdate, aplicar],
  );

  // Sync ref with latest loadData function
  useEffect(() => {
    loadDataRef.current = loadData;
  }, [loadData]);

  const refresh = useCallback(async () => {
    await loadData(true);
  }, [loadData]);

  const clear = useCallback(async () => {
    await clearCache(key);
    aplicar(null, null);
    setIsStale(false);
    setError(null);
  }, [key, aplicar]);

  const update = useCallback(
    async (newData: T | ((prev: T | null) => T)) => {
      const anterior = chaveDoDadoRef.current === key ? dataRef.current : null;
      const updatedData =
        typeof newData === 'function'
          ? (newData as (prev: T | null) => T)(anterior)
          : newData;

      aplicar(updatedData, key);
      setIsStale(false);
      await setCache(key, updatedData, ttl);
      onUpdate?.(updatedData);
    },
    [key, ttl, onUpdate, aplicar],
  );

  // Cleanup
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Execução inicial e quando deps mudam - uses ref to avoid re-execution when loadData changes
  useEffect(() => {
    if (enabled) {
      loadDataRef.current();
    }
    // Spread deps from caller is intentional - allows hook users to provide custom dependencies
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key, ...deps]);

  return {
    data,
    loading,
    refreshing,
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
  options: Omit<UseCachedDataOptions, 'staleWhileRevalidate'> = {},
): UseCachedDataReturn<T> {
  return useCachedData(key, fetcher, {
    ...options,
    staleWhileRevalidate: false,
  });
}
