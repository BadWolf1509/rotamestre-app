/**
 * Tests for errorMapping utilities
 */

// Mock logger before importing errorMapping
jest.mock('../logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

import {
  getErrorMessage,
  getErrorString,
  isNetworkError,
  isAuthError,
  isPermissionError,
} from '../errorMapping';

describe('errorMapping', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getErrorMessage', () => {
    describe('authentication errors', () => {
      it('should handle invalid login credentials', () => {
        const error = new Error('Invalid login credentials');
        const result = getErrorMessage(error);

        expect(result.title).toBe('E-mail ou senha incorretos');
        expect(result.message).toBe('Verifique seus dados e tente novamente.');
        expect(result.type).toBe('error');
        expect(result.code).toBe('AUTH_INVALID_CREDENTIALS');
      });

      it('should handle disabled legacy Supabase API keys', () => {
        const error = new Error('Legacy API keys are disabled');
        const result = getErrorMessage(error);

        expect(result.title).toBe('Serviço temporariamente indisponível');
        expect(result.message).toBe(
          'Não foi possível conectar ao serviço. Tente novamente em alguns minutos.',
        );
        expect(result.type).toBe('warning');
        expect(result.code).toBe('SERVICE_CONFIGURATION_ERROR');
      });

      it('should handle invalid Supabase API keys', () => {
        const error = { message: 'Invalid API key' };
        const result = getErrorMessage(error);

        expect(result.code).toBe('SERVICE_CONFIGURATION_ERROR');
      });

      it('should handle email not confirmed', () => {
        const error = { message: 'Email not confirmed' };
        const result = getErrorMessage(error);

        expect(result.title).toBe('E-mail não confirmado');
        expect(result.code).toBe('AUTH_EMAIL_NOT_CONFIRMED');
        expect(result.type).toBe('warning');
      });

      it('should handle email already exists', () => {
        const error = { message: 'User already registered' };
        const result = getErrorMessage(error);

        expect(result.title).toBe('E-mail já cadastrado');
        expect(result.code).toBe('AUTH_EMAIL_EXISTS');
      });

      it('should handle email already exists variant', () => {
        const error = { message: 'Email already exists in the system' };
        const result = getErrorMessage(error);

        expect(result.code).toBe('AUTH_EMAIL_EXISTS');
      });

      it('should handle same password validation', () => {
        const error = {
          message: 'New password should be different from the old password',
        };
        const result = getErrorMessage(error);

        expect(result.title).toBe('Senha inválida');
        expect(result.code).toBe('AUTH_PASSWORD_SAME');
        expect(result.type).toBe('warning');
      });

      it('should handle weak password validation', () => {
        const error = { message: 'Password should be at least 8 characters' };
        const result = getErrorMessage(error);

        expect(result.title).toBe('Senha fraca');
        expect(result.code).toBe('AUTH_PASSWORD_WEAK');
        expect(result.type).toBe('warning');
      });

      it('should handle compromised password validation', () => {
        const error = {
          message: 'Password is known to be compromised and cannot be used',
        };
        const result = getErrorMessage(error);

        expect(result.title).toBe('Senha comprometida');
        expect(result.code).toBe('AUTH_PASSWORD_COMPROMISED');
        expect(result.type).toBe('warning');
      });

      it('should handle recent login required validation', () => {
        const error = {
          message:
            'Password update requires recent login. Please reauthenticate.',
        };
        const result = getErrorMessage(error);

        expect(result.title).toBe('Sessão expirada');
        expect(result.code).toBe('AUTH_RECENT_LOGIN_REQUIRED');
        expect(result.type).toBe('warning');
      });
    });

    describe('rate limiting errors', () => {
      it('should handle too many requests', () => {
        const error = new Error('Too many requests');
        const result = getErrorMessage(error);

        expect(result.title).toBe('Muitas tentativas');
        expect(result.code).toBe('RATE_LIMIT');
        expect(result.type).toBe('warning');
      });

      it('should handle rate limit variant', () => {
        const error = { message: 'Rate limit exceeded' };
        const result = getErrorMessage(error);

        expect(result.code).toBe('RATE_LIMIT');
      });
    });

    describe('permission errors', () => {
      it('should handle RLS errors', () => {
        const error = new Error('RLS policy violation');
        const result = getErrorMessage(error);

        expect(result.title).toBe('Sem permissão');
        expect(result.code).toBe('RLS_VIOLATION');
        expect(result.type).toBe('error');
      });

      it('should handle row level security errors', () => {
        const error = { message: 'Row level security policy blocked' };
        const result = getErrorMessage(error);

        expect(result.code).toBe('RLS_VIOLATION');
      });

      it('should handle permission denied', () => {
        const error = new Error('Permission denied for table users');
        const result = getErrorMessage(error);

        expect(result.title).toBe('Acesso negado');
        expect(result.code).toBe('PERMISSION_DENIED');
      });

      it('should handle unauthorized', () => {
        const error = { message: 'Unauthorized access' };
        const result = getErrorMessage(error);

        expect(result.code).toBe('PERMISSION_DENIED');
      });

      it('should handle forbidden', () => {
        const error = { message: 'Forbidden resource' };
        const result = getErrorMessage(error);

        expect(result.code).toBe('PERMISSION_DENIED');
      });
    });

    describe('authentication - session expired errors', () => {
      it('should handle NAO_AUTENTICADO from RPC', () => {
        const error = {
          message: 'NAO_AUTENTICADO: Sessão expirada no meio do formulário',
        };
        const result = getErrorMessage(error);

        expect(result.title).toBe('Sessão expirada');
        expect(result.message).toBe(
          'Sua sessão expirou. Faça login novamente para continuar.',
        );
        expect(result.type).toBe('warning');
        expect(result.code).toBe('AUTH_NOT_AUTHENTICATED');
      });

      it('should handle NAO_AUTENTICADO uppercase', () => {
        const error = { message: 'NAO_AUTENTICADO' };
        const result = getErrorMessage(error);

        expect(result.code).toBe('AUTH_NOT_AUTHENTICATED');
      });
    });

    describe('SEM_PERMISSAO', () => {
      it('orienta a falta de permissão em vez de mandar contatar o suporte', () => {
        const resultado = getErrorMessage({ message: 'SEM_PERMISSAO' });

        expect(resultado.title).not.toBe('Algo deu errado');
        expect(resultado.message).toMatch(/permiss/i);
        // O texto cru da sentinela nunca pode chegar ao usuário.
        expect(resultado.message).not.toContain('SEM_PERMISSAO');
      });
    });

    describe('database constraint errors', () => {
      it('should handle foreign key violation', () => {
        const error = new Error('violates foreign key constraint');
        const result = getErrorMessage(error);

        expect(result.title).toBe('Operação inválida');
        expect(result.code).toBe('FK_VIOLATION');
      });

      it('should handle unique constraint violation', () => {
        const error = {
          message: 'unique constraint violation on column email',
        };
        const result = getErrorMessage(error);

        expect(result.title).toBe('Registro duplicado');
        expect(result.code).toBe('UNIQUE_VIOLATION');
        expect(result.type).toBe('warning');
      });

      it('should handle duplicate key', () => {
        const error = new Error(
          'duplicate key value violates unique constraint',
        );
        const result = getErrorMessage(error);

        expect(result.code).toBe('UNIQUE_VIOLATION');
      });

      it('should handle not null violation', () => {
        const error = {
          message: 'null value in column nome violates not null constraint',
        };
        const result = getErrorMessage(error);

        expect(result.title).toBe('Dados incompletos');
        expect(result.code).toBe('NULL_VIOLATION');
      });

      it('should handle check constraint violation', () => {
        const error = new Error('check constraint violated');
        const result = getErrorMessage(error);

        expect(result.title).toBe('Dados inválidos');
        expect(result.code).toBe('CHECK_VIOLATION');
      });
    });

    describe('network errors', () => {
      it('should handle network error', () => {
        const error = new Error('Network request failed');
        const result = getErrorMessage(error);

        expect(result.title).toBe('Sem conexão');
        expect(result.code).toBe('NETWORK_ERROR');
        expect(result.type).toBe('warning');
      });

      it('should handle offline', () => {
        const error = { message: 'Device is offline' };
        const result = getErrorMessage(error);

        expect(result.code).toBe('NETWORK_ERROR');
      });

      it('should handle fetch failed', () => {
        const error = new Error('Fetch failed');
        const result = getErrorMessage(error);

        expect(result.code).toBe('NETWORK_ERROR');
      });

      it('should handle connection error', () => {
        const error = { message: 'Connection refused' };
        const result = getErrorMessage(error);

        expect(result.code).toBe('NETWORK_ERROR');
      });

      it('should handle timeout', () => {
        const error = new Error('Request timed out');
        const result = getErrorMessage(error);

        expect(result.title).toBe('Tempo esgotado');
        expect(result.code).toBe('TIMEOUT');
      });
    });

    describe('maps/address errors', () => {
      it('should handle Google Maps error', () => {
        const error = new Error('Google Maps API error');
        const result = getErrorMessage(error);

        expect(result.title).toBe('Erro no mapa');
        expect(result.code).toBe('MAPS_ERROR');
      });

      it('should handle Directions API error', () => {
        const error = { message: 'Directions API request failed' };
        const result = getErrorMessage(error);

        expect(result.code).toBe('MAPS_ERROR');
      });

      it('should handle zero results', () => {
        const error = new Error('ZERO_RESULTS: No route found');
        const result = getErrorMessage(error);

        expect(result.title).toBe('Endereço não encontrado');
        expect(result.code).toBe('ADDRESS_NOT_FOUND');
        expect(result.type).toBe('warning');
      });

      it('should handle address not found', () => {
        const error = { message: 'Address not found' };
        const result = getErrorMessage(error);

        expect(result.code).toBe('ADDRESS_NOT_FOUND');
      });

      it('should handle no route', () => {
        const error = new Error('No route between the points');
        const result = getErrorMessage(error);

        expect(result.code).toBe('ADDRESS_NOT_FOUND');
      });
    });

    describe('upload errors', () => {
      it('should handle upload error', () => {
        const error = new Error('Upload failed');
        const result = getErrorMessage(error);

        expect(result.title).toBe('Erro no upload');
        expect(result.code).toBe('UPLOAD_ERROR');
      });

      it('should handle storage error', () => {
        const error = { message: 'Storage upload failed' };
        const result = getErrorMessage(error);

        expect(result.code).toBe('UPLOAD_ERROR');
      });

      it('should handle file too large', () => {
        const error = new Error('File too large');
        const result = getErrorMessage(error);

        expect(result.code).toBe('UPLOAD_ERROR');
      });
    });

    describe('RPC schema not ready errors', () => {
      it('should handle missing RPC function in schema cache', () => {
        const error = {
          message:
            "Could not find the 'criar_unidade_para_novo_gestor' function in the schema cache",
        };
        const result = getErrorMessage(error);

        expect(result.title).toBe('Serviço temporariamente indisponível');
        expect(result.message).toBe(
          'Este recurso ainda está sendo configurado. Tente novamente em alguns instantes.',
        );
        expect(result.type).toBe('warning');
        expect(result.code).toBe('RPC_SCHEMA_NOT_READY');
      });

      it('should handle missing RPC function with lowercase function', () => {
        const error = {
          message: "could not find the function 'some_rpc' in the schema cache",
        };
        const result = getErrorMessage(error);

        expect(result.code).toBe('RPC_SCHEMA_NOT_READY');
      });

      it('should NOT match missing column error (PGRST204 — different error)', () => {
        const error = {
          message:
            "Could not find the 'email' column of 'usuarios' in the schema cache",
        };
        const result = getErrorMessage(error);

        // Should fall back to default error, not RPC_SCHEMA_NOT_READY
        expect(result.code).toBe('UNKNOWN_ERROR');
        expect(result.title).toBe('Algo deu errado');
      });
    });

    describe('input types', () => {
      it('should handle Error object', () => {
        const error = new Error('Invalid login credentials');
        const result = getErrorMessage(error);

        expect(result.code).toBe('AUTH_INVALID_CREDENTIALS');
      });

      it('should handle string error', () => {
        const result = getErrorMessage('Invalid login credentials');

        expect(result.code).toBe('AUTH_INVALID_CREDENTIALS');
      });

      it('should handle object with message', () => {
        const error = { message: 'Invalid login credentials' };
        const result = getErrorMessage(error);

        expect(result.code).toBe('AUTH_INVALID_CREDENTIALS');
      });

      it('should handle object with error_description', () => {
        const error = { error_description: 'Invalid login credentials' };
        const result = getErrorMessage(error);

        expect(result.code).toBe('AUTH_INVALID_CREDENTIALS');
      });

      it('should handle object without message (uses JSON.stringify)', () => {
        const error = { code: 'some_code', details: 'some_details' };
        const result = getErrorMessage(error);

        // Should fall through to default error
        expect(result.code).toBe('UNKNOWN_ERROR');
      });

      it('should handle null', () => {
        const result = getErrorMessage(null);

        expect(result.title).toBe('Algo deu errado');
        expect(result.code).toBe('UNKNOWN_ERROR');
      });

      it('should handle undefined', () => {
        const result = getErrorMessage(undefined);

        expect(result.code).toBe('UNKNOWN_ERROR');
      });
    });

    describe('default error', () => {
      it('should return default error for unknown errors', () => {
        const error = new Error('Some completely unknown error xyz123');
        const result = getErrorMessage(error);

        expect(result.title).toBe('Algo deu errado');
        expect(result.message).toBe(
          'Ocorreu um erro inesperado. Tente novamente ou contate o suporte.',
        );
        expect(result.type).toBe('error');
        expect(result.code).toBe('UNKNOWN_ERROR');
      });
    });
  });

  describe('getErrorString', () => {
    it('should return only the message', () => {
      const error = new Error('Invalid login credentials');
      const result = getErrorString(error);

      expect(result).toBe('Verifique seus dados e tente novamente.');
    });

    it('should return default message for unknown error', () => {
      const error = new Error('Unknown xyz');
      const result = getErrorString(error);

      expect(result).toBe(
        'Ocorreu um erro inesperado. Tente novamente ou contate o suporte.',
      );
    });
  });

  describe('isNetworkError', () => {
    it('should return true for network errors', () => {
      expect(isNetworkError(new Error('Network error'))).toBe(true);
      expect(isNetworkError({ message: 'offline' })).toBe(true);
    });

    it('should return true for timeout errors', () => {
      expect(isNetworkError(new Error('Request timed out'))).toBe(true);
    });

    it('should return false for non-network errors', () => {
      expect(isNetworkError(new Error('Invalid login credentials'))).toBe(
        false,
      );
      expect(isNetworkError({ message: 'permission denied' })).toBe(false);
    });
  });

  describe('isAuthError', () => {
    it('should return true for auth errors', () => {
      expect(isAuthError(new Error('Invalid login credentials'))).toBe(true);
      expect(isAuthError({ message: 'Email not confirmed' })).toBe(true);
      expect(isAuthError(new Error('User already registered'))).toBe(true);
    });

    it('should return false for non-auth errors', () => {
      expect(isAuthError(new Error('Network error'))).toBe(false);
      expect(isAuthError({ message: 'permission denied' })).toBe(false);
    });
  });

  describe('isPermissionError', () => {
    it('should return true for permission errors', () => {
      expect(isPermissionError(new Error('RLS policy'))).toBe(true);
      expect(isPermissionError({ message: 'permission denied' })).toBe(true);
    });

    it('should return false for non-permission errors', () => {
      expect(isPermissionError(new Error('Network error'))).toBe(false);
      expect(isPermissionError(new Error('Invalid login credentials'))).toBe(
        false,
      );
    });
  });
});
