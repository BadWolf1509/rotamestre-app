/**
 * Hook genérico para operações assíncronas
 *
 * Encapsula o padrão comum de:
 * - Estado de loading
 * - Estado de erro
 * - Estado de dados
 * - Execução manual ou automática
 *
 * @example
 * // Execução automática (immediate: true)
 * const { data, loading, error } = useAsync(
 *   () => fetchUserData(userId),
 *   { immediate: true, deps: [userId] }
 * );
 *
 * @example
 * // Execução manual
 * const { data, loading, execute } = useAsync(
 *   () => submitForm(formData),
 *   { immediate: false }
 * );
 * // Chamar execute() quando necessário
 */

import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';

export interface UseAsyncOptions {
  /** Executar automaticamente ao montar (default: true) */
  immediate?: boolean;
  /** Dependências para re-executar (apenas se immediate: true) */
  deps?: DependencyList;
  /** Callback de sucesso */
  onSuccess?: <T>(data: T) => void;
  /** Callback de erro */
  onError?: (error: Error) => void;
}

export interface UseAsyncReturn<T> {
  /** Dados retornados pela função assíncrona */
  data: T | null;
  /** Indica se a operação está em andamento */
  loading: boolean;
  /** Erro ocorrido durante a execução */
  error: Error | null;
  /** Função para executar manualmente */
  execute: () => Promise<T | null>;
  /** Reseta o estado para valores iniciais */
  reset: () => void;
  /** Indica se já foi executado pelo menos uma vez */
  hasRun: boolean;
}

/**
 * Hook para gerenciar operações assíncronas com estado de loading/error
 */
export function useAsync<T>(
  asyncFn: () => Promise<T>,
  options: UseAsyncOptions = {}
): UseAsyncReturn<T> {
  const { immediate = true, deps = [], onSuccess, onError } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState<Error | null>(null);
  const [hasRun, setHasRun] = useState(false);

  // Refs para evitar memory leaks e race conditions
  const mountedRef = useRef(true);
  const executingRef = useRef(false);
  const executeRef = useRef<() => Promise<T | null>>(() => Promise.resolve(null));

  const execute = useCallback(async (): Promise<T | null> => {
    // Evitar execuções simultâneas
    if (executingRef.current) {
      return null;
    }

    executingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const result = await asyncFn();

      // Verificar se componente ainda está montado
      if (mountedRef.current) {
        setData(result);
        setHasRun(true);
        onSuccess?.(result);
      }

      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));

      if (mountedRef.current) {
        setError(error);
        setHasRun(true);
        onError?.(error);
      }

      return null;
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
      executingRef.current = false;
    }
  }, [asyncFn, onSuccess, onError]);

  // Sync ref with latest execute function
  useEffect(() => {
    executeRef.current = execute;
  }, [execute]);

  const reset = useCallback(() => {
    setData(null);
    setLoading(false);
    setError(null);
    setHasRun(false);
  }, []);

  // Cleanup no unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Execução automática - uses ref to avoid re-execution when execute changes
  useEffect(() => {
    if (immediate) {
      executeRef.current();
    }
    // Spread deps from caller is intentional - allows hook users to provide custom dependencies
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [immediate, ...deps]);

  return {
    data,
    loading,
    error,
    execute,
    reset,
    hasRun,
  };
}

/**
 * Variante do useAsync para operações que não precisam de estado de dados
 * Útil para mutations (POST, PUT, DELETE)
 *
 * @example
 * const { loading, execute } = useAsyncAction(
 *   () => deleteItem(itemId),
 *   { onSuccess: () => showToast('Item excluído!') }
 * );
 */
export function useAsyncAction(
  asyncFn: () => Promise<void>,
  options: Omit<UseAsyncOptions, 'immediate' | 'deps'> = {}
): Pick<UseAsyncReturn<void>, 'loading' | 'error' | 'execute' | 'reset'> {
  const { onSuccess, onError } = options;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mountedRef = useRef(true);
  const executingRef = useRef(false);

  const execute = useCallback(async (): Promise<void | null> => {
    if (executingRef.current) {
      return null;
    }

    executingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      await asyncFn();

      if (mountedRef.current) {
        onSuccess?.(undefined);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));

      if (mountedRef.current) {
        setError(error);
        onError?.(error);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
      executingRef.current = false;
    }
  }, [asyncFn, onSuccess, onError]);

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return {
    loading,
    error,
    execute,
    reset,
  };
}
