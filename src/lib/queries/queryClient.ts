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
  | 'timeout'
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

  // Timeout do NOSSO wrapper (fetchComTimeout.ts), marcado com
  // `new Error('timeout')` + `name: 'AbortError'` de propósito. Tem que vir
  // ANTES do bloco genérico de objeto logo abaixo: um `Error` de verdade
  // também é `typeof === 'object'`, e cairia no fallback "Default with
  // message" dali — 'unknown' por acidente de ordem, com a mensagem crua em
  // inglês vazando pra UI. Aqui é deliberado: tipo PRÓPRIO ('timeout'), fora
  // de `retryableTypes` (['network', 'server']) — abortar por prazo depois
  // da resposta já ter gravado no servidor não pode virar um retry que
  // duplica um INSERT como `createIncidente`.
  //
  // Esta forma (`instanceof Error`) é a que chega quando quem processou o
  // fetch rejeitado foi o `storage-js` (upload/download de foto): ele
  // relança um `Error` de verdade (`StorageUnknownError`) preservando
  // `.message` do original. Cancelamento LEGÍTIMO do chamador nessa mesma
  // via chega aqui também como `Error`, mas com outra `.message` — cai no
  // ramo `AbortError` logo abaixo, antes do bloco genérico de objeto.
  if (error instanceof Error && error.message === 'timeout') {
    return {
      type: 'timeout',
      message: 'A operação demorou muito e foi cancelada. Tente novamente.',
      originalError: error,
    };
  }

  // Cancelamento LEGÍTIMO do chamador (ex.: `.abortSignal()` em
  // `useGestaoRotas`) chegando como `Error` de verdade — `name: 'AbortError'`
  // com QUALQUER mensagem do runtime (nunca a nossa string fixa 'timeout',
  // tratada acima). Tem que vir aqui, ANTES do bloco de objeto genérico: a
  // mensagem de um abort real quase nunca é vazia ("The operation was
  // aborted.", "Aborted" etc.), e uma mensagem não-vazia entra antes no
  // fallback "Default with message" ali embaixo, saindo como 'unknown' com
  // texto cru do runtime — o ramo dedicado (antes no fim do arquivo) só era
  // alcançado por um teste que zerava `.message` de propósito para escapar
  // desse fallback; não cobria o caso real.
  if (error instanceof Error && error.name === 'AbortError') {
    return {
      type: 'network',
      message: 'Requisição cancelada.',
      originalError: error,
    };
  }

  // Mesmo cancelamento (nosso timeout OU o do chamador), só que processado
  // pelo `postgrest-js` (toda leitura/escrita via `.from(...)`). Diferença
  // de storage-js: o postgrest-js NUNCA relança — não usamos
  // `.throwOnError()` em lugar nenhum do repo — ele converte a rejeição do
  // fetch num objeto plano ANTES de resolver a promise, dentro do seu
  // `.then()` interno
  // (`node_modules/@supabase/postgrest-js/dist/index.cjs`, por volta da
  // linha 425): `message: \`${fetchError.name}: ${fetchError.message}\``.
  // Por isso NÃO é `instanceof Error` — os dois `if`s acima não pegam.
  //
  // Com `name: 'AbortError'` (fetchComTimeout.ts) e `message: 'timeout'`, a
  // forma observada — confirmada rodando a biblioteca instalada de verdade,
  // não suposta; ver fix-report-2.md do PR #480, item 2 — é
  // `message: 'AbortError: timeout'`. Um cancelamento do chamador passando
  // pelo mesmo caminho gera `'AbortError: ' + <mensagem real do runtime>`,
  // que nunca é exatamente 'timeout' — por isso a comparação exata abaixo
  // não confunde os dois.
  if (
    typeof error === 'object' &&
    error !== null &&
    (error as { message?: unknown }).message === 'AbortError: timeout'
  ) {
    return {
      type: 'timeout',
      message: 'A operação demorou muito e foi cancelada. Tente novamente.',
      originalError: error,
    };
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
  //
  // `name === 'AbortError'` já foi tratado bem acima (antes do bloco de
  // objeto genérico) — chegar aqui como `Error` significa que não é nem o
  // nosso timeout nem um cancelamento, então é mesmo 'unknown'.
  if (error instanceof Error) {
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
