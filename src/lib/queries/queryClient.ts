/**
 * Shared query utilities for Supabase operations
 * Provides retry logic, error handling, and common query helpers
 */

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

// Re-export supabase client for convenience
export { supabase };

/**
 * Error types for better error handling
 */
export type QueryErrorType =
  | 'network'
  | 'auth'
  | 'validation'
  | 'not_found'
  | 'permission'
  | 'server'
  | 'unknown';

export interface QueryError {
  type: QueryErrorType;
  message: string;
  code?: string;
  originalError?: unknown;
}

/**
 * Query result with discriminated union for type-safe error handling
 */
export type QueryResult<T> =
  { success: true; data: T } | { success: false; error: QueryError };

/**
 * Classify Supabase error into a QueryError type
 */
export function classifyError(error: unknown): QueryError {
  if (!error) {
    return { type: 'unknown', message: 'Erro desconhecido' };
  }

  // Handle PostgrestError
  if (typeof error === 'object' && error !== null) {
    const pgError = error as {
      code?: string;
      message?: string;
      details?: string;
    };

    // Network errors
    if (
      pgError.message?.includes('network') ||
      pgError.message?.includes('fetch')
    ) {
      return {
        type: 'network',
        message: 'Erro de conexão. Verifique sua internet.',
        code: pgError.code,
        originalError: error,
      };
    }

    // Auth errors
    //
    // O prefixo aqui era `PGRST1`, que pegava a família ERRADA: os códigos de
    // autenticação do PostgREST são a família `PGRST30x` (301 JWT inválido,
    // 302 acesso anônimo negado, 303). `PGRST116` — "zero linhas", o retorno
    // normal de um `.single()` sem resultado — começa com `PGRST1` e caía aqui,
    // tornando o ramo `not_found` logo abaixo INALCANÇÁVEL.
    //
    // Efeito medido: registro que não existe mais (rota reatribuída, parada
    // removida por outro gestor) virava "Sessão expirada. Faça login
    // novamente." O motorista deslogava, relogava, e o problema continuava.
    if (
      pgError.code?.startsWith('PGRST30') ||
      pgError.message?.includes('JWT')
    ) {
      return {
        type: 'auth',
        message: 'Sessão expirada. Faça login novamente.',
        code: pgError.code,
        originalError: error,
      };
    }

    // Permission errors (RLS)
    if (pgError.code === '42501' || pgError.message?.includes('permission')) {
      return {
        type: 'permission',
        message: 'Você não tem permissão para esta ação.',
        code: pgError.code,
        originalError: error,
      };
    }

    // Not found
    if (pgError.code === 'PGRST116') {
      return {
        type: 'not_found',
        message: 'Registro não encontrado.',
        code: pgError.code,
        originalError: error,
      };
    }

    // Validation errors
    if (pgError.code?.startsWith('22') || pgError.code?.startsWith('23')) {
      return {
        type: 'validation',
        message: pgError.message || 'Dados inválidos.',
        code: pgError.code,
        originalError: error,
      };
    }

    // Server errors
    if (pgError.code?.startsWith('5')) {
      return {
        type: 'server',
        message: 'Erro no servidor. Tente novamente.',
        code: pgError.code,
        originalError: error,
      };
    }

    // Default with message
    if (pgError.message) {
      return {
        type: 'unknown',
        message: pgError.message,
        code: pgError.code,
        originalError: error,
      };
    }
  }

  // Handle Error objects
  if (error instanceof Error) {
    if (error.name === 'AbortError') {
      return {
        type: 'network',
        message: 'Requisição cancelada.',
        originalError: error,
      };
    }

    return {
      type: 'unknown',
      message: error.message,
      originalError: error,
    };
  }

  return {
    type: 'unknown',
    message: 'Erro desconhecido',
    originalError: error,
  };
}

/**
 * Retry configuration
 */
export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  retryableTypes?: QueryErrorType[];
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  baseDelayMs: 500,
  maxDelayMs: 5000,
  retryableTypes: ['network', 'server'],
};

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a query function with automatic retry for transient failures
 */
export async function withRetry<T>(
  queryFn: () => Promise<T>,
  options?: RetryOptions,
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await queryFn();
    } catch (error) {
      lastError = error;
      const classifiedError = classifyError(error);

      // Check if error is retryable
      if (!opts.retryableTypes.includes(classifiedError.type)) {
        throw error; // Not retryable, throw immediately
      }

      // Don't retry on last attempt
      if (attempt === opts.maxAttempts) {
        break;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        opts.baseDelayMs * Math.pow(2, attempt - 1),
        opts.maxDelayMs,
      );

      logger.warn(
        `Query failed (attempt ${attempt}/${opts.maxAttempts}), retrying in ${delay}ms...`,
        {
          errorType: classifiedError.type,
          message: classifiedError.message,
        },
      );

      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Wrap a query function to return QueryResult instead of throwing
 */
export async function safeQuery<T>(
  queryFn: () => Promise<T>,
): Promise<QueryResult<T>> {
  try {
    const data = await queryFn();
    return { success: true, data };
  } catch (error) {
    const queryError = classifyError(error);
    logger.error('Query failed:', { error: queryError });
    return { success: false, error: queryError };
  }
}

/**
 * Common select fields for rotas table
 */
export const ROTA_SELECT_FIELDS = {
  minimal: 'id, status, data, titulo',
  list: 'id, status, data, titulo, distancia_total, duracao_total_minutos, motorista_id, criado_em, concluida_em',
  full: `
    id, status, data, titulo, distancia_total, duracao_total_minutos,
    motorista_id, unidade_id, criado_por, criado_em, iniciada_em, concluida_em, observacoes,
    motorista:usuarios!rotas_motorista_id_fkey(id, nome, avatar_url, telefone),
    unidade:unidades(id, nome, cidade)
  `,
} as const;

/**
 * Common select fields for paradas table
 */
export const PARADA_SELECT_FIELDS = {
  minimal: 'id, rota_id, status, ordem',
  list: 'id, rota_id, status, ordem, tipo, endereco, destinatario, is_checkpoint, concluida_em',
  full: `
    id, rota_id, status, ordem, tipo, endereco, destinatario, telefone,
    observacoes, is_checkpoint, latitude, longitude, foto_url, concluida_em, criado_em
  `,
} as const;

/**
 * Common select fields for usuarios table
 */
export const USUARIO_SELECT_FIELDS = {
  minimal: 'id, nome, papel',
  list: 'id, nome, papel, email, telefone, avatar_url, ativo',
  full: `
    id, nome, papel, email, telefone, avatar_url, ativo, criado_em, ultimo_acesso,
    usuario_unidades(
      id, usuario_id, unidade_id, papel, is_principal, ativo,
      unidades(id, nome, cidade, ativa)
    )
  `,
} as const;

/**
 * Build cache key for queries
 */
export function buildCacheKey(
  namespace: string,
  ...parts: (string | number | undefined)[]
): string {
  const validParts = parts.filter((p): p is string | number => p !== undefined);
  return [namespace, ...validParts].join(':');
}
