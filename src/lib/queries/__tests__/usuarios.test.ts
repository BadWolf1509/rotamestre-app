/**
 * Tests for usuarios queries
 */

import type { TipoUsuario } from '@/types/usuario';

// Mock the queryClient module first
const mockSupabaseData: Record<string, unknown> = {};
const mockSupabaseError: Record<string, unknown> = {};

// Create a chainable mock that captures the table name
const createChainableMock = (tableName: string) => {
  const chain: any = {
    select: jest.fn(() => chain),
    insert: jest.fn(() => chain),
    update: jest.fn(() => chain),
    delete: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    neq: jest.fn(() => chain),
    in: jest.fn(() => chain),
    gte: jest.fn(() => chain),
    lte: jest.fn(() => chain),
    order: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    returns: jest.fn(() => chain),
    single: jest.fn(() =>
      Promise.resolve({
        data: mockSupabaseData[tableName] ?? null,
        error: mockSupabaseError[tableName] ?? null,
      }),
    ),
    maybeSingle: jest.fn(() =>
      Promise.resolve({
        data: mockSupabaseData[tableName] ?? null,
        error: mockSupabaseError[tableName] ?? null,
      }),
    ),
    then: (resolve: any) =>
      Promise.resolve({
        data: mockSupabaseData[tableName] ?? null,
        error: mockSupabaseError[tableName] ?? null,
      }).then(resolve),
  };
  return chain;
};

jest.mock('../queryClient', () => ({
  supabase: {
    from: (tableName: string) => createChainableMock(tableName),
  },
  withRetry: async (fn: () => Promise<any>) => fn(),
  safeQuery: async (fn: () => Promise<any>) => {
    try {
      const data = await fn();
      return { success: true, data };
    } catch (error: any) {
      return {
        success: false,
        error: { type: 'unknown', message: error?.message || 'Error' },
      };
    }
  },
  classifyError: (error: any) => ({
    type: error?.code === '42501' ? 'permission' : 'unknown',
    message: error?.message || 'Erro desconhecido',
  }),
  buildCacheKey: (...parts: (string | number | undefined)[]) =>
    parts.filter(Boolean).join(':'),
}));

// Import after mocks
import { updateUsuario, type UsuarioDB } from '../usuarios';

describe('usuarios queries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const key of Object.keys(mockSupabaseData)) {
      delete mockSupabaseData[key];
    }
    for (const key of Object.keys(mockSupabaseError)) {
      delete mockSupabaseError[key];
    }
  });

  describe('updateUsuario', () => {
    it('should update user successfully', async () => {
      const updatedUser: UsuarioDB = {
        id: 'user-123',
        email: 'updated@example.com',
        nome: 'Updated Name',
        papel: 'gestor' as TipoUsuario,
        telefone: '11777777777',
        foto_url: null,
        ativo: true,
        primeira_senha: false,
        ultimo_login: '2024-01-01T00:00:00Z',
        created_at: '2024-01-01T00:00:00Z',
      };

      mockSupabaseData['usuarios'] = updatedUser;

      const result = await updateUsuario('user-123', { nome: 'Updated Name' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.nome).toBe('Updated Name');
      }
    });

    it('should handle update error', async () => {
      mockSupabaseError['usuarios'] = {
        message: 'Update failed',
        code: '42501',
      };

      const result = await updateUsuario('user-123', { nome: 'New Name' });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('permission');
      }
    });
  });
});
