/**
 * Tests for routeErrors.ts
 * Tipos de erro e utilitários para o sistema de otimização de rotas
 */

import {
  parseGoogleError,
  createNetworkError,
  success,
  failure,
  formatErrorForLog,
  type RouteError,
} from '../routeErrors';

describe('routeErrors', () => {
  describe('parseGoogleError', () => {
    it('should parse ZERO_RESULTS status', () => {
      const error = parseGoogleError('ZERO_RESULTS');

      expect(error.code).toBe('ZERO_RESULTS');
      expect(error.recoverable).toBe(true);
      expect(error.userMessage).toContain(
        'Não foi possível encontrar uma rota',
      );
    });

    it('should parse NOT_FOUND status', () => {
      const error = parseGoogleError('NOT_FOUND');

      expect(error.code).toBe('NOT_FOUND');
      expect(error.recoverable).toBe(true);
    });

    it('should parse MAX_WAYPOINTS_EXCEEDED status', () => {
      const error = parseGoogleError('MAX_WAYPOINTS_EXCEEDED');

      expect(error.code).toBe('MAX_WAYPOINTS_EXCEEDED');
      expect(error.recoverable).toBe(false);
    });

    it('should parse INVALID_REQUEST status', () => {
      const error = parseGoogleError('INVALID_REQUEST');

      expect(error.code).toBe('INVALID_REQUEST');
      expect(error.recoverable).toBe(true);
    });

    it('should parse OVER_QUERY_LIMIT status', () => {
      const error = parseGoogleError('OVER_QUERY_LIMIT');

      expect(error.code).toBe('OVER_QUERY_LIMIT');
      expect(error.recoverable).toBe(true);
    });

    it('should parse REQUEST_DENIED status', () => {
      const error = parseGoogleError('REQUEST_DENIED');

      expect(error.code).toBe('REQUEST_DENIED');
      expect(error.recoverable).toBe(false);
    });

    it('should parse UNKNOWN_ERROR status', () => {
      const error = parseGoogleError('UNKNOWN_ERROR');

      expect(error.code).toBe('UNKNOWN_ERROR');
      expect(error.recoverable).toBe(true);
    });

    it('should parse TIMEOUT status', () => {
      const error = parseGoogleError('TIMEOUT');

      expect(error.code).toBe('TIMEOUT');
      expect(error.recoverable).toBe(true);
    });

    it('should handle unknown status', () => {
      const error = parseGoogleError('SOME_NEW_STATUS');

      expect(error.code).toBe('UNKNOWN_ERROR');
      expect(error.message).toContain('SOME_NEW_STATUS');
      expect(error.recoverable).toBe(true);
    });

    it('should include details when provided', () => {
      const error = parseGoogleError('ZERO_RESULTS', 'Additional info');

      expect(error.details).toBe('Additional info');
    });
  });

  describe('createNetworkError', () => {
    it('should create network error with default message', () => {
      const error = createNetworkError();

      expect(error.code).toBe('NETWORK_ERROR');
      expect(error.message).toBe('Network request failed');
      expect(error.recoverable).toBe(true);
    });

    it('should include original error message', () => {
      const originalError = new Error('Connection refused');
      const error = createNetworkError(originalError);

      expect(error.message).toBe('Connection refused');
      expect(error.details).toContain('Connection refused');
    });
  });

  describe('success', () => {
    it('should create success result', () => {
      const result = success({ id: 1, name: 'Test' });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: 1, name: 'Test' });
      expect(result.error).toBeUndefined();
    });
  });

  describe('failure', () => {
    it('should create failure result', () => {
      const error: RouteError = {
        code: 'NETWORK_ERROR',
        message: 'Failed',
        userMessage: 'Falhou',
        recoverable: true,
      };
      const result = failure(error);

      expect(result.success).toBe(false);
      expect(result.error).toEqual(error);
      expect(result.data).toBeUndefined();
    });
  });

  describe('formatErrorForLog', () => {
    it('should format error without details', () => {
      const error: RouteError = {
        code: 'TIMEOUT',
        message: 'Request timed out',
        userMessage: 'Timeout',
        recoverable: true,
      };

      const formatted = formatErrorForLog(error);

      expect(formatted).toBe('[TIMEOUT] Request timed out');
    });

    it('should format error with details', () => {
      const error: RouteError = {
        code: 'NETWORK_ERROR',
        message: 'Connection failed',
        userMessage: 'Erro',
        details: 'DNS lookup failed',
        recoverable: true,
      };

      const formatted = formatErrorForLog(error);

      expect(formatted).toBe(
        '[NETWORK_ERROR] Connection failed | Details: DNS lookup failed',
      );
    });
  });
});
