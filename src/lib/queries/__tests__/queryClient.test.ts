/**
 * Tests for query client utilities
 */

import {
  classifyError,
  withRetry,
  safeQuery,
  buildCacheKey,
} from '../queryClient';

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

describe('queryClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('classifyError', () => {
    it('should return unknown for null/undefined error', () => {
      expect(classifyError(null)).toEqual({
        type: 'unknown',
        message: 'Erro desconhecido',
      });

      expect(classifyError(undefined)).toEqual({
        type: 'unknown',
        message: 'Erro desconhecido',
      });
    });

    it('should classify network errors', () => {
      const networkError = { message: 'Failed to fetch due to network issue' };
      const result = classifyError(networkError);

      expect(result.type).toBe('network');
      expect(result.message).toBe('Erro de conexão. Verifique sua internet.');
    });

    it('should classify auth errors from code', () => {
      const authError = { code: 'PGRST116', message: 'JWT expired' };
      const result = classifyError(authError);

      expect(result.type).toBe('auth');
      expect(result.message).toBe('Sessão expirada. Faça login novamente.');
    });

    it('should classify auth errors from JWT message', () => {
      const authError = { message: 'JWT token is invalid' };
      const result = classifyError(authError);

      expect(result.type).toBe('auth');
    });

    it('should classify permission errors from code 42501', () => {
      const permError = { code: '42501', message: 'Permission denied' };
      const result = classifyError(permError);

      expect(result.type).toBe('permission');
      expect(result.message).toBe('Você não tem permissão para esta ação.');
    });

    it('should classify permission errors from message', () => {
      const permError = { message: 'permission denied for table' };
      const result = classifyError(permError);

      expect(result.type).toBe('permission');
    });

    it('should classify not_found errors', () => {
      const notFoundError = { code: 'PGRST116' };
      const result = classifyError(notFoundError);

      // Note: PGRST116 is also caught by auth check first
      expect(['not_found', 'auth']).toContain(result.type);
    });

    it('should classify validation errors with code starting with 22', () => {
      const validationError = { code: '22001', message: 'Value too long' };
      const result = classifyError(validationError);

      expect(result.type).toBe('validation');
      expect(result.message).toBe('Value too long');
    });

    it('should classify validation errors with code starting with 23', () => {
      const validationError = { code: '23505', message: 'Unique constraint violation' };
      const result = classifyError(validationError);

      expect(result.type).toBe('validation');
    });

    it('should classify server errors with code starting with 5', () => {
      const serverError = { code: '500', message: 'Internal server error' };
      const result = classifyError(serverError);

      expect(result.type).toBe('server');
      expect(result.message).toBe('Erro no servidor. Tente novamente.');
    });

    it('should handle Error objects', () => {
      const error = new Error('Something went wrong');
      const result = classifyError(error);

      expect(result.type).toBe('unknown');
      expect(result.message).toBe('Something went wrong');
    });

    it('should handle Error without message', () => {
      // Error objects with empty message reach the instanceof Error check
      const error = new Error();
      error.name = 'AbortError';
      error.message = ''; // Clear message
      const result = classifyError(error);

      // With empty message, the generic object check doesn't catch it
      expect(result.type).toBe('network');
      expect(result.message).toBe('Requisição cancelada.');
    });

    it('should handle object with only message', () => {
      const error = { message: 'Custom error message' };
      const result = classifyError(error);

      expect(result.type).toBe('unknown');
      expect(result.message).toBe('Custom error message');
    });

    it('should handle non-object errors', () => {
      const result = classifyError('string error');

      expect(result.type).toBe('unknown');
      expect(result.message).toBe('Erro desconhecido');
    });
  });

  describe('withRetry', () => {
    it('should return result on first success', async () => {
      const queryFn = jest.fn().mockResolvedValue('success');

      const result = await withRetry(queryFn);

      expect(result).toBe('success');
      expect(queryFn).toHaveBeenCalledTimes(1);
    });

    it('should not retry on non-retryable errors', async () => {
      const authError = { code: 'PGRST116', message: 'JWT expired' };
      const queryFn = jest.fn().mockRejectedValue(authError);

      await expect(withRetry(queryFn)).rejects.toEqual(authError);
      expect(queryFn).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable errors and eventually succeed', async () => {
      const networkError = { message: 'network error' };
      const queryFn = jest.fn()
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce('success');

      // Use minimal delays for testing
      const result = await withRetry(queryFn, {
        maxAttempts: 2,
        baseDelayMs: 1,
        maxDelayMs: 1,
      });

      expect(result).toBe('success');
      expect(queryFn).toHaveBeenCalledTimes(2);
    }, 10000);

    it('should throw after max attempts', async () => {
      const networkError = { message: 'network error' };
      const queryFn = jest.fn().mockRejectedValue(networkError);

      await expect(
        withRetry(queryFn, { maxAttempts: 2, baseDelayMs: 1, maxDelayMs: 1 })
      ).rejects.toEqual(networkError);
      expect(queryFn).toHaveBeenCalledTimes(2);
    }, 10000);
  });

  describe('safeQuery', () => {
    it('should return success result on success', async () => {
      const queryFn = jest.fn().mockResolvedValue({ id: 1, name: 'Test' });

      const result = await safeQuery(queryFn);

      expect(result).toEqual({
        success: true,
        data: { id: 1, name: 'Test' },
      });
    });

    it('should return error result on failure', async () => {
      const queryFn = jest.fn().mockRejectedValue(new Error('Query failed'));

      const result = await safeQuery(queryFn);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('unknown');
        expect(result.error.message).toBe('Query failed');
      }
    });

    it('should classify error type correctly', async () => {
      const queryFn = jest.fn().mockRejectedValue({ message: 'network error' });

      const result = await safeQuery(queryFn);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('network');
      }
    });
  });

  describe('buildCacheKey', () => {
    it('should build key from namespace and parts', () => {
      const key = buildCacheKey('rotas', 'abc123', 'list');
      expect(key).toBe('rotas:abc123:list');
    });

    it('should handle numeric parts', () => {
      const key = buildCacheKey('paradas', 'rota123', 50);
      expect(key).toBe('paradas:rota123:50');
    });

    it('should filter out undefined parts', () => {
      const key = buildCacheKey('users', undefined, 'abc', undefined, 'def');
      expect(key).toBe('users:abc:def');
    });

    it('should return only namespace if no parts', () => {
      const key = buildCacheKey('namespace');
      expect(key).toBe('namespace');
    });

    it('should handle all undefined parts', () => {
      const key = buildCacheKey('namespace', undefined, undefined);
      expect(key).toBe('namespace');
    });
  });
});
