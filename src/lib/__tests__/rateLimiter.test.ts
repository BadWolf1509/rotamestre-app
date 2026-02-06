/**
 * Tests for rateLimiter.ts
 * Proteção contra brute force com exponential backoff
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  createRateLimiter,
  loginRateLimiter,
  passwordResetRateLimiter,
  signupRateLimiter,
} from '../rateLimiter';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

describe('rateLimiter', () => {
  let dateNowSpy: jest.SpyInstance;
  let currentTime: number;
  // Unique key counter to avoid memoryCache pollution between tests
  let keyCounter = 0;

  function uniqueKey(prefix = 'test') {
    keyCounter++;
    return `${prefix}-${keyCounter}@test.com`;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);

    // Mock Date.now para controle preciso de tempo
    currentTime = 1000000;
    dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(currentTime);
  });

  afterEach(() => {
    dateNowSpy.mockRestore();
  });

  describe('createRateLimiter', () => {
    describe('checkLimit', () => {
      it('deve permitir primeira tentativa', async () => {
        const key = uniqueKey();
        const limiter = createRateLimiter({ storagePrefix: '@test/' });
        const result = await limiter.checkLimit(key);

        expect(result.allowed).toBe(true);
        expect(result.remainingAttempts).toBe(5); // DEFAULT_CONFIG.maxAttempts
        expect(result.retryAfterMs).toBeNull();
        expect(result.message).toBeNull();
      });

      it('deve permitir tentativas dentro do limite', async () => {
        const key = uniqueKey();
        const limiter = createRateLimiter({
          maxAttempts: 3,
          storagePrefix: '@test/',
        });

        // Simular 2 tentativas falhadas
        await limiter.recordAttempt(key, false);
        await limiter.recordAttempt(key, false);

        const result = await limiter.checkLimit(key);
        expect(result.allowed).toBe(true);
        expect(result.remainingAttempts).toBe(1);
      });

      it('deve bloquear após exceder maxAttempts', async () => {
        const key = uniqueKey();
        const limiter = createRateLimiter({
          maxAttempts: 3,
          lockoutMs: 60000,
          storagePrefix: '@test/',
        });

        // 3 tentativas falhadas
        await limiter.recordAttempt(key, false);
        await limiter.recordAttempt(key, false);
        await limiter.recordAttempt(key, false);

        const result = await limiter.checkLimit(key);
        expect(result.allowed).toBe(false);
        expect(result.remainingAttempts).toBe(0);
        expect(result.retryAfterMs).toBeGreaterThan(0);
      });

      it('deve resetar contagem após expiração da janela (windowMs)', async () => {
        const key = uniqueKey();
        const limiter = createRateLimiter({
          maxAttempts: 3,
          windowMs: 60000, // 1 minuto
          storagePrefix: '@test/',
        });

        // 2 tentativas falhadas (abaixo do limite, sem lockout)
        await limiter.recordAttempt(key, false);
        await limiter.recordAttempt(key, false);

        // Avançar tempo além da janela
        currentTime += 61000;
        dateNowSpy.mockReturnValue(currentTime);

        const result = await limiter.checkLimit(key);
        expect(result.allowed).toBe(true);
        expect(result.remainingAttempts).toBe(3); // Resetado para max
      });

      it('deve retornar remainingAttempts correto', async () => {
        const key = uniqueKey();
        const limiter = createRateLimiter({
          maxAttempts: 5,
          storagePrefix: '@test/',
        });

        await limiter.recordAttempt(key, false);
        const result = await limiter.checkLimit(key);
        expect(result.remainingAttempts).toBe(4);

        await limiter.recordAttempt(key, false);
        const result2 = await limiter.checkLimit(key);
        expect(result2.remainingAttempts).toBe(3);
      });

      it('deve retornar retryAfterMs quando bloqueado', async () => {
        const key = uniqueKey();
        const limiter = createRateLimiter({
          maxAttempts: 2,
          lockoutMs: 120000, // 2 minutos
          storagePrefix: '@test/',
        });

        await limiter.recordAttempt(key, false);
        await limiter.recordAttempt(key, false);

        const result = await limiter.checkLimit(key);
        expect(result.allowed).toBe(false);
        expect(result.retryAfterMs).toBeLessThanOrEqual(120000);
        expect(result.retryAfterMs).toBeGreaterThan(0);
      });

      it('deve retornar mensagem em PT-BR quando bloqueado', async () => {
        const key = uniqueKey();
        const limiter = createRateLimiter({
          maxAttempts: 2,
          lockoutMs: 120000, // 2 minutos
          storagePrefix: '@test/',
        });

        await limiter.recordAttempt(key, false);
        await limiter.recordAttempt(key, false);

        const result = await limiter.checkLimit(key);
        expect(result.message).toMatch(/Aguarde \d+ minutos? para tentar novamente\./);
      });

      it('deve retornar mensagem de aviso com poucas tentativas restantes', async () => {
        const key = uniqueKey();
        const limiter = createRateLimiter({
          maxAttempts: 3,
          storagePrefix: '@test/',
        });

        await limiter.recordAttempt(key, false);
        await limiter.recordAttempt(key, false);

        const result = await limiter.checkLimit(key);
        expect(result.allowed).toBe(true);
        expect(result.message).toMatch(/1 tentativa\(s\) restante\(s\)/);
      });
    });

    describe('recordAttempt', () => {
      it('deve incrementar contagem em tentativa falhada', async () => {
        const key = uniqueKey();
        const limiter = createRateLimiter({
          maxAttempts: 5,
          storagePrefix: '@test/',
        });

        await limiter.recordAttempt(key, false);
        const result = await limiter.checkLimit(key);
        expect(result.remainingAttempts).toBe(4);

        await limiter.recordAttempt(key, false);
        const result2 = await limiter.checkLimit(key);
        expect(result2.remainingAttempts).toBe(3);
      });

      it('deve resetar contagem em tentativa bem-sucedida', async () => {
        const key = uniqueKey();
        const limiter = createRateLimiter({
          maxAttempts: 5,
          storagePrefix: '@test/',
        });

        // Falhar 3 vezes
        await limiter.recordAttempt(key, false);
        await limiter.recordAttempt(key, false);
        await limiter.recordAttempt(key, false);

        // Sucesso reseta
        await limiter.recordAttempt(key, true);

        const result = await limiter.checkLimit(key);
        expect(result.allowed).toBe(true);
        expect(result.remainingAttempts).toBe(5); // Resetado para max
      });

      it('deve aplicar lockout após exceder limite', async () => {
        const key = uniqueKey();
        const limiter = createRateLimiter({
          maxAttempts: 2,
          lockoutMs: 60000,
          storagePrefix: '@test/',
        });

        await limiter.recordAttempt(key, false);
        await limiter.recordAttempt(key, false);

        const result = await limiter.checkLimit(key);
        expect(result.allowed).toBe(false);
        expect(result.retryAfterMs).toBeGreaterThan(0);
      });

      it('deve aplicar backoff exponencial', async () => {
        const key = uniqueKey();
        const limiter = createRateLimiter({
          maxAttempts: 2,
          lockoutMs: 60000, // 1 min base
          maxLockoutMs: 30 * 60000, // 30 min max
          storagePrefix: '@test/',
        });

        // Primeiro bloqueio: count=2, floor(2/2)-1=0, 2^0=1, lockout=60000
        await limiter.recordAttempt(key, false);
        await limiter.recordAttempt(key, false);

        let result = await limiter.checkLimit(key);
        expect(result.allowed).toBe(false);
        expect(result.retryAfterMs).toBeLessThanOrEqual(60000);

        // Avançar tempo para desbloquear
        currentTime += 61000;
        dateNowSpy.mockReturnValue(currentTime);

        // Segundo bloqueio: count=4, floor(4/2)-1=1, 2^1=2, lockout=120000
        await limiter.recordAttempt(key, false);
        await limiter.recordAttempt(key, false);

        result = await limiter.checkLimit(key);
        expect(result.allowed).toBe(false);
        expect(result.retryAfterMs).toBeLessThanOrEqual(120000);
        expect(result.retryAfterMs).toBeGreaterThan(60000);
      });

      it('deve persistir no AsyncStorage', async () => {
        const key = uniqueKey();
        const limiter = createRateLimiter({ storagePrefix: '@test/' });

        await limiter.recordAttempt(key, false);

        expect(AsyncStorage.setItem).toHaveBeenCalledWith(
          `@test/${key}`,
          expect.any(String)
        );

        // Verificar que o valor salvo contém count: 1
        const calls = (AsyncStorage.setItem as jest.Mock).mock.calls;
        const relevantCall = calls.find((c: string[]) => c[0] === `@test/${key}`);
        expect(relevantCall).toBeDefined();
        const parsed = JSON.parse(relevantCall![1]);
        expect(parsed.count).toBe(1);
        expect(parsed.lastAttempt).toBe(currentTime);
      });

      it('deve resetar contagem quando janela expira entre tentativas', async () => {
        const key = uniqueKey();
        const limiter = createRateLimiter({
          maxAttempts: 3,
          windowMs: 60000,
          storagePrefix: '@test/',
        });

        // 2 tentativas falhadas
        await limiter.recordAttempt(key, false);
        await limiter.recordAttempt(key, false);

        // Avançar tempo além da janela
        currentTime += 61000;
        dateNowSpy.mockReturnValue(currentTime);

        // Nova tentativa deve contar como 1 (janela expirou)
        await limiter.recordAttempt(key, false);

        const result = await limiter.checkLimit(key);
        expect(result.remainingAttempts).toBe(2); // 3 - 1 = 2
      });
    });

    describe('reset', () => {
      it('deve limpar registro do AsyncStorage e memória', async () => {
        const key = uniqueKey();
        const limiter = createRateLimiter({ storagePrefix: '@test/' });

        await limiter.recordAttempt(key, false);
        await limiter.reset(key);

        expect(AsyncStorage.removeItem).toHaveBeenCalledWith(`@test/${key}`);
      });

      it('deve permitir tentativas após reset', async () => {
        const key = uniqueKey();
        const limiter = createRateLimiter({
          maxAttempts: 2,
          storagePrefix: '@test/',
        });

        // Bloquear
        await limiter.recordAttempt(key, false);
        await limiter.recordAttempt(key, false);

        const blocked = await limiter.checkLimit(key);
        expect(blocked.allowed).toBe(false);

        // Reset
        await limiter.reset(key);

        const result = await limiter.checkLimit(key);
        expect(result.allowed).toBe(true);
        expect(result.remainingAttempts).toBe(2);
      });
    });

    describe('resiliência', () => {
      it('deve funcionar com AsyncStorage falhando (fallback memória)', async () => {
        const key = uniqueKey();
        (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Storage error'));
        (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

        const limiter = createRateLimiter({
          maxAttempts: 3,
          storagePrefix: '@test/',
        });

        // Deve funcionar via cache em memória
        const result = await limiter.checkLimit(key);
        expect(result.allowed).toBe(true);

        await limiter.recordAttempt(key, false);
        await limiter.recordAttempt(key, false);

        const result2 = await limiter.checkLimit(key);
        expect(result2.remainingAttempts).toBe(1);
      });

      it('deve funcionar com dados corrompidos no AsyncStorage', async () => {
        const key = uniqueKey();
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue('invalid json{{{');

        const limiter = createRateLimiter({ storagePrefix: '@test/' });

        // Deve retornar registro vazio (fallback)
        const result = await limiter.checkLimit(key);
        expect(result.allowed).toBe(true);
        expect(result.remainingAttempts).toBe(5);
      });
    });
  });

  describe('instâncias pré-configuradas', () => {
    it('loginRateLimiter deve permitir 5 tentativas', async () => {
      const key = uniqueKey('login');

      // 4 tentativas falhadas - ainda deve permitir
      for (let i = 0; i < 4; i++) {
        await loginRateLimiter.recordAttempt(key, false);
      }

      const result = await loginRateLimiter.checkLimit(key);
      expect(result.allowed).toBe(true);
      expect(result.remainingAttempts).toBe(1);

      // 5ª tentativa bloqueia
      await loginRateLimiter.recordAttempt(key, false);
      const blocked = await loginRateLimiter.checkLimit(key);
      expect(blocked.allowed).toBe(false);
    });

    it('passwordResetRateLimiter deve permitir 3 tentativas', async () => {
      const key = uniqueKey('pwd');

      for (let i = 0; i < 2; i++) {
        await passwordResetRateLimiter.recordAttempt(key, false);
      }

      const result = await passwordResetRateLimiter.checkLimit(key);
      expect(result.allowed).toBe(true);
      expect(result.remainingAttempts).toBe(1);

      await passwordResetRateLimiter.recordAttempt(key, false);
      const blocked = await passwordResetRateLimiter.checkLimit(key);
      expect(blocked.allowed).toBe(false);
    });

    it('signupRateLimiter deve permitir 3 tentativas', async () => {
      const key = uniqueKey('signup');

      for (let i = 0; i < 2; i++) {
        await signupRateLimiter.recordAttempt(key, false);
      }

      const result = await signupRateLimiter.checkLimit(key);
      expect(result.allowed).toBe(true);
      expect(result.remainingAttempts).toBe(1);

      await signupRateLimiter.recordAttempt(key, false);
      const blocked = await signupRateLimiter.checkLimit(key);
      expect(blocked.allowed).toBe(false);
    });
  });
});
