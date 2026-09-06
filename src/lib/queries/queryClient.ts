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
 * Verdadeiro se `error` tem a forma que o `@supabase/postgrest-js` produz
 * para QUALQUER fetch abortado que passe por ele — usado por TODA
 * leitura/escrita via `.from(...)`. Cobre tanto o NOSSO timeout
 * (`fetchComTimeout.ts`) quanto um cancelamento do CHAMADOR (ex.:
 * `.abortSignal()` em `useGestaoRotas`) — os dois chegam aqui com o MESMO
 * formato, distinguíveis só pelo sufixo da mensagem (`classifyError`, logo
 * abaixo, dá ao nosso timeout um tipo próprio; ver ali).
 *
 * postgrest-js NUNCA relança essa rejeição — não usamos `.throwOnError()`
 * em lugar nenhum do repo — ele converte a rejeição do fetch num objeto
 * PLANO antes de resolver a promise, dentro do seu `.then()` interno
 * (`node_modules/@supabase/postgrest-js/dist/index.cjs`, por volta da linha
 * 425): `message: \`${fetchError.name}: ${fetchError.message}\``. Por isso
 * NÃO é `instanceof Error` — uma guarda escrita pra `Error` (como a que
 * existia em `useGestaoRotas` antes desta correção) nunca casa com o que
 * chega de verdade. Forma confirmada contra a biblioteca REALMENTE
 * instalada, não suposta — ver o teste de contrato em
 * `__tests__/postgrestAbortContract.test.ts` (roda o `@supabase/postgrest-js`
 * de verdade contra um fetch falso) e fix-report-2.md / fix-report-3.md do
 * PR 480.
 *
 * Extraído aqui — em vez de cada chamador escrever seu próprio
 * `.startsWith('AbortError:')` — pra não duplicar esse conhecimento em dois
 * lugares. `useGestaoRotas.ts` usa isto (mais o `type` de `classifyError`,
 * pra não silenciar o NOSSO timeout junto) pra decidir se um erro de
 * carregamento foi o próprio app cancelando uma requisição, não uma falha.
 */
export function isPostgrestAbortShape(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as { message?: unknown }).message === 'string' &&
    (error as { message: string }).message.startsWith('AbortError:')
  );
}

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
  // `.message` do original. NENHUM upload/download deste repo passa um
  // AbortSignal do CHAMADOR pro storage (`grep -n "signal" src/lib/storage.ts`
  // não acha nada) — então o único abort que chega aqui vindo do storage-js
  // é o NOSSO próprio timeout, sempre com esta mensagem exata. Um
  // cancelamento do CHAMADOR pelo storage-js chegaria também como `Error`
  // (`StorageUnknownError`), mas com outra `.message` — cairia direto no
  // bloco genérico de objeto logo abaixo (`typeof === 'object'` também vale
  // pra instâncias de `Error`), saindo como 'unknown' com texto cru do
  // runtime. Não escrevemos um branch dedicado pra esse caso: sem nenhum
  // caminho real que o exercite, um teste só alcançaria com fixture
  // inventada — exatamente o defeito que o item 2 do fix-report-3.md
  // (PR 480) existiu pra desfazer (ali, o branch morto `name === 'AbortError'`
  // que ocupava este lugar).
  if (error instanceof Error && error.message === 'timeout') {
    return {
      type: 'timeout',
      message: 'A operação demorou muito e foi cancelada. Tente novamente.',
      originalError: error,
    };
  }

  // Mesmo cancelamento (nosso timeout OU o do chamador), só que convertido
  // pelo postgrest-js na forma que `isPostgrestAbortShape` (acima)
  // reconhece — não é `instanceof Error`, então o `if` anterior não pega.
  //
  // Com `name: 'AbortError'` (fetchComTimeout.ts) e `message: 'timeout'`, a
  // forma observada — confirmada rodando a biblioteca instalada de verdade,
  // não suposta; ver fix-report-2.md do PR 480, item 2 — é
  // `message: 'AbortError: timeout'`. Um cancelamento do chamador passando
  // pelo mesmo caminho gera `'AbortError: ' + <mensagem real do runtime>`,
  // que nunca é exatamente 'timeout' — por isso a comparação exata abaixo
  // não confunde os dois (esse outro caso — cancelamento genuíno do
  // chamador — fica classificado mais abaixo, no fallback genérico de
  // objeto, como 'unknown'; `isPostgrestAbortShape` existe justamente pra
  // quem precisa reconhecê-lo sem depender do `type` de `classifyError`).
  if (
    isPostgrestAbortShape(error) &&
    (error as { message: string }).message === 'AbortError: timeout'
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
  // Um Error que chega aqui não foi tratado pelos ramos anteriores: não é o
  // nosso timeout próprio (message !== 'timeout') nem a forma do postgrest-js
  // (que seria um objeto plano, não instanceof Error). Pode ser um
  // cancelamento legítimo do chamador (que chegaria do storage-js ou outro,
  // com message !== 'timeout') ou um erro genérico — sem informação que os
  // distinga, classificamos como 'unknown'.
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
