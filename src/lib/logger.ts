/**
 * Logger seguro para produção
 *
 * - Em desenvolvimento (__DEV__): loga normalmente
 * - Em produção: filtra dados sensíveis e só loga erros
 *
 * USO:
 * import { logger } from '@/lib/logger';
 * logger.info('Operação realizada'); // Só aparece em DEV
 * logger.error('Falha na operação'); // Aparece sempre (sem dados sensíveis)
 * logger.warn('Aviso'); // Só aparece em DEV
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

export default logger;
