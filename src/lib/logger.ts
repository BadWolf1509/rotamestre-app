/**
 * Secure Logger for Production
 *
 * Features:
 * - Development (__DEV__): Full logging with all details
 * - Production: Only errors, with sensitive data redacted
 * - Automatic sanitization of passwords, tokens, emails, CPF, CNPJ
 * - Performance timing with visual indicators
 * - Breadcrumb trail for debugging user flows
 * - Network request/response logging
 * - Correlation IDs for tracking operations across components
 *
 * Log Levels:
 * - debug: Detailed debugging (DEV only)
 * - info: General information (DEV only)
 * - warn: Warnings (DEV only)
 * - error: Errors (always logged, sanitized in production)
 * - api: API operations (DEV only)
 * - navigation: Screen navigation (DEV only)
 * - perf: Performance metrics (DEV only)
 * - network: HTTP requests/responses (DEV only)
 * - action: User actions for debugging (DEV only)
 *
 * @example
 * ```ts
 * import { logger } from '@/lib/logger';
 *
 * // Basic logging
 * logger.info('Route created');
 * logger.error('Failed to save', error);
 *
 * // Track user actions (breadcrumb trail)
 * logger.action('button_click', 'Save Route');
 * logger.action('navigation', 'Dashboard → RouteDetails');
 *
 * // Network logging
 * logger.network('POST', '/api/routes', 201, 150);
 *
 * // Get breadcrumbs for error reporting
 * const breadcrumbs = logger.getBreadcrumbs();
 * ```
 */

// Campos que NUNCA devem ser logados
const SENSITIVE_FIELDS = [
  'password',
  'senha',
  'token',
  'key',
  'secret',
  'authorization',
  'cookie',
  'email',
  'telefone',
  'cpf',
  'cnpj',
  'credit_card',
  'api_key',
  'apikey',
  'supabase_key',
  'service_role',
];

// Padrões regex para detectar dados sensíveis
const SENSITIVE_PATTERNS = [
  /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, // JWT tokens
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, // Emails
  /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, // CPF
  /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g, // CNPJ
  /\b\d{10,11}\b/g, // Telefones
];

/**
 * Remove dados sensíveis de um objeto ou string
 */
function sanitize(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    let sanitized = data;
    for (const pattern of SENSITIVE_PATTERNS) {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    }
    return sanitized;
  }

  if (Array.isArray(data)) {
    return data.map(sanitize);
  }

  if (typeof data === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_FIELDS.some((field) => lowerKey.includes(field))) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitize(value);
      }
    }
    return sanitized;
  }

  return data;
}

/**
 * Formata argumentos para log
 */
function formatArgs(args: unknown[]): unknown[] {
  return args.map(sanitize);
}

// ============================================================================
// BREADCRUMB SYSTEM
// ============================================================================

interface Breadcrumb {
  timestamp: number;
  type: 'action' | 'navigation' | 'network' | 'error' | 'info';
  message: string;
  data?: Record<string, unknown>;
}

const MAX_BREADCRUMBS = 50;
const breadcrumbs: Breadcrumb[] = [];

/**
 * Adds a breadcrumb to the trail (for debugging)
 */
function addBreadcrumb(
  type: Breadcrumb['type'],
  message: string,
  data?: Record<string, unknown>
): void {
  const breadcrumb: Breadcrumb = {
    timestamp: Date.now(),
    type,
    message,
    data: data ? (sanitize(data) as Record<string, unknown>) : undefined,
  };

  breadcrumbs.push(breadcrumb);

  // Keep only last MAX_BREADCRUMBS
  if (breadcrumbs.length > MAX_BREADCRUMBS) {
    breadcrumbs.shift();
  }
}

// ============================================================================
// CORRELATION ID
// ============================================================================

let currentCorrelationId: string | null = null;

/**
 * Generates a short correlation ID for tracking operations
 */
function generateCorrelationId(): string {
  return Math.random().toString(36).substring(2, 8);
}

/**
 * Logger com níveis de severidade
 */
export const logger = {
  /**
   * Log de debug - apenas em desenvolvimento
   */
  debug: (...args: unknown[]) => {
    if (__DEV__) {
      console.log('[DEBUG]', ...formatArgs(args));
    }
  },

  /**
   * Log informativo - apenas em desenvolvimento
   */
  info: (...args: unknown[]) => {
    if (__DEV__) {
      console.log('[INFO]', ...formatArgs(args));
    }
  },

  /**
   * Log de aviso - apenas em desenvolvimento
   */
  warn: (...args: unknown[]) => {
    if (__DEV__) {
      console.warn('[WARN]', ...formatArgs(args));
    }
  },

  /**
   * Log de erro - sempre (sanitizado em produção)
   * Em produção, apenas a mensagem do erro é logada, sem stack trace
   */
  error: (message: string, error?: unknown) => {
    if (__DEV__) {
      console.error('[ERROR]', message, error);
    } else {
      // Em produção: log mínimo, sanitizado
      const sanitizedMessage = sanitize(message);
      if (error instanceof Error) {
        console.error('[ERROR]', sanitizedMessage, { name: error.name });
      } else {
        console.error('[ERROR]', sanitizedMessage);
      }
    }
  },

  /**
   * Log de operação de API - útil para debugging
   */
  api: (operation: string, details?: Record<string, unknown>) => {
    if (__DEV__) {
      console.log(`[API] ${operation}`, details ? formatArgs([details])[0] : '');
    }
  },

  /**
   * Log de navegação - útil para debugging
   */
  navigation: (screen: string, params?: Record<string, unknown>) => {
    if (__DEV__) {
      console.log(`[NAV] → ${screen}`, params ? formatArgs([params])[0] : '');
    }
  },

  /**
   * Log de performance - útil para otimização
   */
  perf: (operation: string, durationMs: number) => {
    if (__DEV__) {
      const emoji = durationMs > 1000 ? '🐢' : durationMs > 500 ? '🚶' : '🚀';
      console.log(`[PERF] ${emoji} ${operation}: ${durationMs}ms`);
    }
  },

  /**
   * Log de requisição HTTP - útil para debugging de API
   */
  network: (
    method: string,
    url: string,
    status?: number,
    durationMs?: number,
    error?: string
  ) => {
    const message = status
      ? `${method} ${url} → ${status}${durationMs ? ` (${durationMs}ms)` : ''}`
      : `${method} ${url}`;

    addBreadcrumb('network', message, { method, url, status, durationMs, error });

    if (__DEV__) {
      const emoji = error ? '❌' : status && status >= 400 ? '⚠️' : '🌐';
      if (error) {
        console.log(`[NET] ${emoji} ${message} - ${error}`);
      } else {
        console.log(`[NET] ${emoji} ${message}`);
      }
    }
  },

  /**
   * Log de ação do usuário - cria breadcrumb trail
   * Útil para entender fluxo do usuário antes de um erro
   */
  action: (type: string, detail: string, data?: Record<string, unknown>) => {
    const message = `${type}: ${detail}`;
    addBreadcrumb('action', message, data);

    if (__DEV__) {
      console.log(`[ACTION] 👆 ${message}`, data ? formatArgs([data])[0] : '');
    }
  },

  /**
   * Retorna breadcrumbs para relatório de erro
   * Útil para enviar contexto quando ocorre um erro
   */
  getBreadcrumbs: (): Breadcrumb[] => {
    return [...breadcrumbs];
  },

  /**
   * Limpa breadcrumbs (ex: após login)
   */
  clearBreadcrumbs: () => {
    breadcrumbs.length = 0;
  },

  /**
   * Inicia um grupo de operações correlacionadas
   * Retorna um correlation ID para rastrear logs relacionados
   */
  startOperation: (name: string): string => {
    currentCorrelationId = generateCorrelationId();
    if (__DEV__) {
      console.group(`[OP:${currentCorrelationId}] ${name}`);
    }
    addBreadcrumb('info', `Started: ${name}`, { correlationId: currentCorrelationId });
    return currentCorrelationId;
  },

  /**
   * Finaliza um grupo de operações
   */
  endOperation: (success: boolean = true) => {
    if (__DEV__) {
      console.groupEnd();
    }
    if (currentCorrelationId) {
      addBreadcrumb('info', `Ended: ${success ? 'success' : 'failure'}`, {
        correlationId: currentCorrelationId,
      });
    }
    currentCorrelationId = null;
  },

  /**
   * Retorna o correlation ID atual (para incluir em requests)
   */
  getCorrelationId: (): string | null => currentCorrelationId,
};

/**
 * Utilitário para medir tempo de execução
 */
export function measureTime<T>(
  operation: string,
  fn: () => T
): T {
  const start = performance.now();
  try {
    const result = fn();
    if (result instanceof Promise) {
      return result.finally(() => {
        logger.perf(operation, performance.now() - start);
      }) as T;
    }
    logger.perf(operation, performance.now() - start);
    return result;
  } catch (error) {
    logger.perf(operation, performance.now() - start);
    throw error;
  }
}

// Export types
export type { Breadcrumb };

export default logger;
