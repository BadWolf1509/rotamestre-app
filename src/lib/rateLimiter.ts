/**
 * Rate Limiter para proteção contra brute force
 *
 * Implementa exponential backoff para limitar tentativas de login
 * e outras operações sensíveis.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================================
// TIPOS
// ============================================================================

interface AttemptRecord {
  count: number;
  lastAttempt: number;
  lockedUntil: number | null;
}

interface RateLimiterConfig {
  /** Número máximo de tentativas antes de bloquear */
  maxAttempts: number;
  /** Janela de tempo em ms para contar tentativas */
  windowMs: number;
  /** Tempo de bloqueio base em ms (dobra a cada bloqueio) */
  lockoutMs: number;
  /** Tempo máximo de bloqueio em ms */
  maxLockoutMs: number;
  /** Prefixo para chave de storage */
  storagePrefix: string;
}

interface RateLimitResult {
  allowed: boolean;
  remainingAttempts: number;
  retryAfterMs: number | null;
  message: string | null;
}

// ============================================================================
// CONFIGURAÇÕES PADRÃO
// ============================================================================

const DEFAULT_CONFIG: RateLimiterConfig = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000, // 15 minutos
  lockoutMs: 60 * 1000, // 1 minuto (dobra a cada bloqueio)
  maxLockoutMs: 30 * 60 * 1000, // 30 minutos máximo
  storagePrefix: '@rotamestre/ratelimit_',
};

// Cache em memória para performance
const memoryCache = new Map<string, AttemptRecord>();

// ============================================================================
// FUNÇÕES
// ============================================================================

/**
 * Cria um rate limiter com configuração customizada
 */
export function createRateLimiter(config: Partial<RateLimiterConfig> = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  /**
   * Obtém registro de tentativas para uma chave
   */
  async function getRecord(key: string): Promise<AttemptRecord> {
    const cacheKey = cfg.storagePrefix + key;

    // Tentar cache em memória primeiro
    if (memoryCache.has(cacheKey)) {
      return memoryCache.get(cacheKey)!;
    }

    // Buscar do AsyncStorage
    try {
      const stored = await AsyncStorage.getItem(cacheKey);
      if (stored) {
        const record = JSON.parse(stored) as AttemptRecord;
        memoryCache.set(cacheKey, record);
        return record;
      }
    } catch {
      // Ignora erro de storage
    }

    // Retornar registro vazio
    return { count: 0, lastAttempt: 0, lockedUntil: null };
  }

  /**
   * Salva registro de tentativas
   */
  async function saveRecord(key: string, record: AttemptRecord): Promise<void> {
    const cacheKey = cfg.storagePrefix + key;

    // Atualizar cache em memória
    memoryCache.set(cacheKey, record);

    // Persistir no AsyncStorage
    try {
      await AsyncStorage.setItem(cacheKey, JSON.stringify(record));
    } catch {
      // Ignora erro de storage (cache em memória ainda funciona)
    }
  }

  /**
   * Verifica se uma tentativa é permitida
   */
  async function checkLimit(key: string): Promise<RateLimitResult> {
    const now = Date.now();
    const record = await getRecord(key);

    // Verificar se está bloqueado
    if (record.lockedUntil && now < record.lockedUntil) {
      const retryAfterMs = record.lockedUntil - now;
      const retryAfterSec = Math.ceil(retryAfterMs / 1000);
      const retryAfterMin = Math.ceil(retryAfterSec / 60);

      return {
        allowed: false,
        remainingAttempts: 0,
        retryAfterMs,
        message:
          retryAfterMin > 1
            ? `Aguarde ${retryAfterMin} minutos para tentar novamente.`
            : `Aguarde ${retryAfterSec} segundos para tentar novamente.`,
      };
    }

    // Verificar se janela expirou (resetar contagem)
    if (now - record.lastAttempt > cfg.windowMs) {
      return {
        allowed: true,
        remainingAttempts: cfg.maxAttempts,
        retryAfterMs: null,
        message: null,
      };
    }

    // Verificar tentativas restantes
    const remainingAttempts = Math.max(0, cfg.maxAttempts - record.count);

    if (remainingAttempts > 0) {
      return {
        allowed: true,
        remainingAttempts,
        retryAfterMs: null,
        message:
          remainingAttempts <= 2
            ? `Você tem ${remainingAttempts} tentativa(s) restante(s).`
            : null,
      };
    }

    // Sem tentativas restantes - calcular tempo de espera
    const retryAfterMs = cfg.windowMs - (now - record.lastAttempt);

    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfterMs,
      message: 'Muitas tentativas. Aguarde alguns minutos.',
    };
  }

  /**
   * Registra uma tentativa (bem-sucedida ou não)
   */
  async function recordAttempt(key: string, success: boolean): Promise<void> {
    const now = Date.now();
    const record = await getRecord(key);

    if (success) {
      // Sucesso: resetar contagem
      await saveRecord(key, { count: 0, lastAttempt: now, lockedUntil: null });
    } else {
      // Falha: incrementar contagem
      const isNewWindow = now - record.lastAttempt > cfg.windowMs;
      const newCount = isNewWindow ? 1 : record.count + 1;

      // Calcular bloqueio se excedeu limite
      let lockedUntil: number | null = null;
      if (newCount >= cfg.maxAttempts) {
        // Exponential backoff: dobra a cada vez que é bloqueado
        const lockoutMultiplier = Math.pow(2, Math.floor(newCount / cfg.maxAttempts) - 1);
        const lockoutTime = Math.min(cfg.lockoutMs * lockoutMultiplier, cfg.maxLockoutMs);
        lockedUntil = now + lockoutTime;
      }

      await saveRecord(key, { count: newCount, lastAttempt: now, lockedUntil });
    }
  }

  /**
   * Reseta o rate limit para uma chave
   */
  async function reset(key: string): Promise<void> {
    const cacheKey = cfg.storagePrefix + key;
    memoryCache.delete(cacheKey);

    try {
      await AsyncStorage.removeItem(cacheKey);
    } catch {
      // Ignora erro
    }
  }

  return {
    checkLimit,
    recordAttempt,
    reset,
  };
}

// ============================================================================
// INSTÂNCIAS PRÉ-CONFIGURADAS
// ============================================================================

/**
 * Rate limiter para login
 * - 5 tentativas por 15 minutos
 * - Bloqueio exponencial: 1 min, 2 min, 4 min... até 30 min
 */
export const loginRateLimiter = createRateLimiter({
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,
  lockoutMs: 60 * 1000,
  maxLockoutMs: 30 * 60 * 1000,
  storagePrefix: '@rotamestre/login_limit_',
});

/**
 * Rate limiter para recuperação de senha
 * - 3 tentativas por hora
 * - Bloqueio de 15 minutos
 */
export const passwordResetRateLimiter = createRateLimiter({
  maxAttempts: 3,
  windowMs: 60 * 60 * 1000,
  lockoutMs: 15 * 60 * 1000,
  maxLockoutMs: 60 * 60 * 1000,
  storagePrefix: '@rotamestre/pwd_reset_limit_',
});

/**
 * Rate limiter para criação de conta
 * - 3 tentativas por hora
 * - Bloqueio de 30 minutos
 */
export const signupRateLimiter = createRateLimiter({
  maxAttempts: 3,
  windowMs: 60 * 60 * 1000,
  lockoutMs: 30 * 60 * 1000,
  maxLockoutMs: 2 * 60 * 60 * 1000,
  storagePrefix: '@rotamestre/signup_limit_',
});

export default {
  createRateLimiter,
  loginRateLimiter,
  passwordResetRateLimiter,
  signupRateLimiter,
};
