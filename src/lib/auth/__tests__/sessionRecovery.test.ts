import { Platform } from 'react-native';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

import {
  getHashErrorParams,
  hasRecoveryParamsInCurrentUrl,
  isAuthSessionMissingError,
  trySessionRecoveryFromUrl,
} from '../sessionRecovery';

// O logger NÃO é mockado globalmente em jest.setup.js — mockamos aqui (mesmo
// padrão de src/lib/__tests__/auth.test.ts) para poder espiar logger.warn.
jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

// O cliente supabase é mockado globalmente (jest.mocks/supabase.js prevalece),
// MAS esse mock não inclui setSession/exchangeCodeForSession/verifyOtp. Por isso
// instalamos esses métodos como jest.fn() frescos em beforeEach (setSession) e
// por-teste (os opcionais), tornando a suíte independente de ordem/leakage.
type RecoveryAuth = {
  setSession: jest.Mock;
  exchangeCodeForSession?: jest.Mock;
  verifyOtp?: jest.Mock;
};
const recoveryAuth = supabase.auth as unknown as RecoveryAuth;

// O logger é mockado neste arquivo (jest.mock acima). Cast para acessar os spies.
const mockLogger = logger as jest.Mocked<typeof logger>;

// Handle estável para o setSession instalado em beforeEach.
let mockSetSession: jest.Mock;

/**
 * Substitui window.location por um objeto controlado e devolve uma função de
 * restauração que repõe o descriptor original (padrão usado em auth.test.ts).
 */
function setWindowLocation(value: {
  hash?: string;
  search?: string;
}): () => void {
  const originalLocation = Object.getOwnPropertyDescriptor(window, 'location');
  Object.defineProperty(window, 'location', {
    value: { hash: '', search: '', ...value },
    configurable: true,
    writable: true,
  });
  return () => {
    if (originalLocation) {
      Object.defineProperty(window, 'location', originalLocation);
    }
  };
}

describe('sessionRecovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Instala um setSession fresco a cada teste (mock global não o fornece).
    mockSetSession = jest.fn().mockResolvedValue({
      data: { session: null },
      error: null,
    });
    recoveryAuth.setSession = mockSetSession;
  });

  afterEach(() => {
    // Garante que métodos opcionais (ausentes no mock global) não vazem entre
    // testes/arquivos — o código de produção checa `if (!method) return false`.
    delete recoveryAuth.exchangeCodeForSession;
    delete recoveryAuth.verifyOtp;
  });

  // ============================================
  // getHashErrorParams
  // ============================================
  describe('getHashErrorParams', () => {
    it('retorna {} em plataforma não-web', () => {
      const platformSpy = jest.replaceProperty(Platform, 'OS', 'ios');
      const restore = setWindowLocation({
        hash: '#error=access_denied&error_code=otp_expired',
      });
      try {
        expect(getHashErrorParams()).toEqual({});
      } finally {
        restore();
        platformSpy.restore();
      }
    });

    it('retorna {} no web quando não há hash', () => {
      const platformSpy = jest.replaceProperty(Platform, 'OS', 'web');
      const restore = setWindowLocation({ hash: '' });
      try {
        expect(getHashErrorParams()).toEqual({});
      } finally {
        restore();
        platformSpy.restore();
      }
    });

    it('extrai error, error_code e error_description do hash no web', () => {
      const platformSpy = jest.replaceProperty(Platform, 'OS', 'web');
      const restore = setWindowLocation({
        hash: '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
      });
      try {
        expect(getHashErrorParams()).toEqual({
          error: 'access_denied',
          errorCode: 'otp_expired',
          errorDescription: 'Email link is invalid or has expired',
        });
      } finally {
        restore();
        platformSpy.restore();
      }
    });

    it('retorna campos undefined quando o hash tem outros params mas nenhum de erro', () => {
      const platformSpy = jest.replaceProperty(Platform, 'OS', 'web');
      const restore = setWindowLocation({ hash: '#type=recovery&foo=bar' });
      try {
        expect(getHashErrorParams()).toEqual({
          error: undefined,
          errorCode: undefined,
          errorDescription: undefined,
        });
      } finally {
        restore();
        platformSpy.restore();
      }
    });
  });

  // ============================================
  // isAuthSessionMissingError
  // ============================================
  describe('isAuthSessionMissingError', () => {
    it('retorna false para valor que não é Error (string)', () => {
      expect(isAuthSessionMissingError('auth session missing!')).toBe(false);
    });

    it('retorna false para null e undefined', () => {
      expect(isAuthSessionMissingError(null)).toBe(false);
      expect(isAuthSessionMissingError(undefined)).toBe(false);
    });

    it('retorna false para objeto plano que se parece com erro', () => {
      expect(
        isAuthSessionMissingError({ message: 'Auth session missing!' }),
      ).toBe(false);
    });

    it("retorna true quando a message contém 'auth session missing' (case-insensitive)", () => {
      const error = new Error('AuthApiError: Auth session missing!');
      expect(isAuthSessionMissingError(error)).toBe(true);
    });

    it("retorna true quando o name é 'AuthSessionMissingError'", () => {
      const error = new Error('algo aconteceu');
      error.name = 'AuthSessionMissingError';
      expect(isAuthSessionMissingError(error)).toBe(true);
    });

    it('retorna false para um Error comum', () => {
      expect(
        isAuthSessionMissingError(new Error('Network request failed')),
      ).toBe(false);
    });
  });

  // ============================================
  // hasRecoveryParamsInCurrentUrl
  // ============================================
  describe('hasRecoveryParamsInCurrentUrl', () => {
    it('retorna false em plataforma não-web', () => {
      const platformSpy = jest.replaceProperty(Platform, 'OS', 'android');
      const restore = setWindowLocation({ hash: '#type=recovery' });
      try {
        expect(hasRecoveryParamsInCurrentUrl()).toBe(false);
      } finally {
        restore();
        platformSpy.restore();
      }
    });

    it('retorna true para #type=recovery', () => {
      const platformSpy = jest.replaceProperty(Platform, 'OS', 'web');
      const restore = setWindowLocation({ hash: '#type=recovery' });
      try {
        expect(hasRecoveryParamsInCurrentUrl()).toBe(true);
      } finally {
        restore();
        platformSpy.restore();
      }
    });

    it('retorna true para ?type=recovery', () => {
      const platformSpy = jest.replaceProperty(Platform, 'OS', 'web');
      const restore = setWindowLocation({ search: '?type=recovery' });
      try {
        expect(hasRecoveryParamsInCurrentUrl()).toBe(true);
      } finally {
        restore();
        platformSpy.restore();
      }
    });

    it('retorna true quando o hash tem access_token e refresh_token', () => {
      const platformSpy = jest.replaceProperty(Platform, 'OS', 'web');
      const restore = setWindowLocation({
        hash: '#access_token=abc123&refresh_token=def456&token_type=bearer',
      });
      try {
        expect(hasRecoveryParamsInCurrentUrl()).toBe(true);
      } finally {
        restore();
        platformSpy.restore();
      }
    });

    it('retorna false quando o hash tem só access_token (sem refresh_token)', () => {
      const platformSpy = jest.replaceProperty(Platform, 'OS', 'web');
      const restore = setWindowLocation({ hash: '#access_token=abc123' });
      try {
        expect(hasRecoveryParamsInCurrentUrl()).toBe(false);
      } finally {
        restore();
        platformSpy.restore();
      }
    });

    it('retorna true para ?code=...', () => {
      const platformSpy = jest.replaceProperty(Platform, 'OS', 'web');
      const restore = setWindowLocation({ search: '?code=pkce_auth_code' });
      try {
        expect(hasRecoveryParamsInCurrentUrl()).toBe(true);
      } finally {
        restore();
        platformSpy.restore();
      }
    });

    it('retorna true para ?token_hash=...', () => {
      const platformSpy = jest.replaceProperty(Platform, 'OS', 'web');
      const restore = setWindowLocation({
        search: '?token_hash=otp_hash_value',
      });
      try {
        expect(hasRecoveryParamsInCurrentUrl()).toBe(true);
      } finally {
        restore();
        platformSpy.restore();
      }
    });

    it('retorna false quando não há params de recovery', () => {
      const platformSpy = jest.replaceProperty(Platform, 'OS', 'web');
      const restore = setWindowLocation({ hash: '', search: '?foo=bar' });
      try {
        expect(hasRecoveryParamsInCurrentUrl()).toBe(false);
      } finally {
        restore();
        platformSpy.restore();
      }
    });
  });

  // ============================================
  // trySessionRecoveryFromUrl
  // ============================================
  describe('trySessionRecoveryFromUrl', () => {
    it('retorna true via hash tokens quando setSession tem sucesso', async () => {
      mockSetSession.mockResolvedValueOnce({
        data: { session: {} },
        error: null,
      });
      const restore = setWindowLocation({
        hash: '#access_token=AT&refresh_token=RT',
      });
      try {
        await expect(trySessionRecoveryFromUrl()).resolves.toBe(true);
        expect(mockSetSession).toHaveBeenCalledWith({
          access_token: 'AT',
          refresh_token: 'RT',
        });
      } finally {
        restore();
      }
    });

    it('cai para PKCE (?code) e retorna true quando manual falha mas exchangeCodeForSession tem sucesso', async () => {
      // Manual falha: setSession devolve erro.
      mockSetSession.mockResolvedValueOnce({
        data: { session: null },
        error: new Error('token already used'),
      });
      const exchangeCodeForSession = jest
        .fn()
        .mockResolvedValue({ error: null });
      recoveryAuth.exchangeCodeForSession = exchangeCodeForSession;

      const restore = setWindowLocation({
        hash: '#access_token=AT&refresh_token=RT',
        search: '?code=pkce_code',
      });
      try {
        await expect(trySessionRecoveryFromUrl()).resolves.toBe(true);
        expect(mockSetSession).toHaveBeenCalled();
        expect(exchangeCodeForSession).toHaveBeenCalledWith('pkce_code');
        // setSession falhou -> warning de "Manual session recovery failed".
        expect(mockLogger.warn).toHaveBeenCalled();
      } finally {
        restore();
      }
    });

    it('cai para OTP (?token_hash&type=recovery) e retorna true quando verifyOtp tem sucesso', async () => {
      const verifyOtp = jest.fn().mockResolvedValue({ error: null });
      recoveryAuth.verifyOtp = verifyOtp;

      const restore = setWindowLocation({
        search: '?token_hash=OTP&type=recovery',
      });
      try {
        await expect(trySessionRecoveryFromUrl()).resolves.toBe(true);
        expect(verifyOtp).toHaveBeenCalledWith({
          type: 'recovery',
          token_hash: 'OTP',
        });
      } finally {
        restore();
      }
    });

    it('retorna false quando nenhum método é aplicável (sem params)', async () => {
      const restore = setWindowLocation({ hash: '', search: '' });
      try {
        await expect(trySessionRecoveryFromUrl()).resolves.toBe(false);
        expect(mockSetSession).not.toHaveBeenCalled();
      } finally {
        restore();
      }
    });

    it('não retorna true via hash quando setSession devolve error (e loga warning)', async () => {
      // Apenas hash tokens presentes; setSession falha; sem PKCE/OTP disponíveis.
      mockSetSession.mockResolvedValueOnce({
        data: { session: null },
        error: new Error('invalid refresh token'),
      });
      const restore = setWindowLocation({
        hash: '#access_token=AT&refresh_token=RT',
      });
      try {
        await expect(trySessionRecoveryFromUrl()).resolves.toBe(false);
        expect(mockSetSession).toHaveBeenCalled();
        expect(mockLogger.warn).toHaveBeenCalledWith(
          '[ResetPassword] Manual session recovery failed',
          expect.any(Error),
        );
      } finally {
        restore();
      }
    });

    it('não retorna true via PKCE quando exchangeCodeForSession devolve error', async () => {
      const exchangeCodeForSession = jest
        .fn()
        .mockResolvedValue({ error: new Error('invalid code') });
      recoveryAuth.exchangeCodeForSession = exchangeCodeForSession;

      const restore = setWindowLocation({ search: '?code=bad_code' });
      try {
        await expect(trySessionRecoveryFromUrl()).resolves.toBe(false);
        expect(exchangeCodeForSession).toHaveBeenCalledWith('bad_code');
        expect(mockLogger.warn).toHaveBeenCalledWith(
          '[ResetPassword] PKCE session recovery failed',
          expect.any(Error),
        );
      } finally {
        restore();
      }
    });

    it('ignora PKCE quando exchangeCodeForSession não existe no client', async () => {
      // exchangeCodeForSession ausente (padrão do mock) -> caminho retorna false
      // sem lançar. Só ?code presente, então o resultado final é false.
      const restore = setWindowLocation({ search: '?code=some_code' });
      try {
        await expect(trySessionRecoveryFromUrl()).resolves.toBe(false);
        expect(mockLogger.warn).not.toHaveBeenCalled();
      } finally {
        restore();
      }
    });

    it("não tenta OTP quando type não é 'recovery'", async () => {
      const verifyOtp = jest.fn().mockResolvedValue({ error: null });
      recoveryAuth.verifyOtp = verifyOtp;

      const restore = setWindowLocation({
        search: '?token_hash=OTP&type=signup',
      });
      try {
        await expect(trySessionRecoveryFromUrl()).resolves.toBe(false);
        expect(verifyOtp).not.toHaveBeenCalled();
      } finally {
        restore();
      }
    });
  });
});
