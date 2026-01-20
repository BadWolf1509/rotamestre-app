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
    single: jest.fn(() => Promise.resolve({
      data: mockSupabaseData[tableName] ?? null,
      error: mockSupabaseError[tableName] ?? null,
    })),
    maybeSingle: jest.fn(() => Promise.resolve({
      data: mockSupabaseData[tableName] ?? null,
      error: mockSupabaseError[tableName] ?? null,
    })),
    then: (resolve: any) => Promise.resolve({
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

// Mock cache
jest.mock('@/lib/cache', () => ({
  getCache: jest.fn().mockResolvedValue(null),
  setCache: jest.fn().mockResolvedValue(undefined),
  CACHE_TTL: {
    USER_DATA: 300000,
    MOTORISTAS: 300000,
  },
}));

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

// Import after mocks
import {
  fetchCurrentUser,
  fetchCurrentUserWithCache,
  fetchUsuarioById,
  fetchMotoristasByUnidade,
  fetchMotoristasWithCache,
  fetchUsuariosByPapel,
  updateUsuario,
  updateUltimoAcesso,
  updateAvatarUrl,
  checkEmailExists,
  fetchMotoristaKPIs,
  type UsuarioDB,
  type UsuarioWithUnidades,
} from '../usuarios';

describe('usuarios queries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear mock data
    for (const key of Object.keys(mockSupabaseData)) {
      delete mockSupabaseData[key];
    }
    for (const key of Object.keys(mockSupabaseError)) {
      delete mockSupabaseError[key];
    }
  });

  describe('fetchCurrentUser', () => {
    const mockUser: UsuarioWithUnidades = {
      id: 'user-123',
      email: 'test@example.com',
      nome: 'Test User',
      papel: 'gestor' as TipoUsuario,
      telefone: '11999999999',
      avatar_url: null,
      ativo: true,
      primeiro_acesso: false,
      ultimo_acesso: '2024-01-01T00:00:00Z',
      criado_em: '2024-01-01T00:00:00Z',
      unidades: {
        id: 'unidade-1',
        nome: 'Unidade 1',
        cidade: 'São Paulo',
        ativa: true,
      },
      usuario_unidades: [],
    };

    it('should fetch user by ID successfully', async () => {
      mockSupabaseData['usuarios'] = mockUser;

      const result = await fetchCurrentUser('user-123');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('user-123');
        expect(result.data.nome).toBe('Test User');
      }
    });

    it('should return error on failure', async () => {
      mockSupabaseError['usuarios'] = { message: 'User not found', code: 'PGRST116' };

      const result = await fetchCurrentUser('invalid-id');

      expect(result.success).toBe(false);
    });
  });

  describe('fetchUsuarioById', () => {
    const mockUser: UsuarioDB = {
      id: 'user-456',
      email: 'driver@example.com',
      nome: 'Driver User',
      papel: 'motorista' as TipoUsuario,
      telefone: '11888888888',
      avatar_url: null,
      ativo: true,
      primeiro_acesso: true,
      ultimo_acesso: null,
      criado_em: '2024-01-01T00:00:00Z',
    };

    it('should fetch usuario by ID', async () => {
      mockSupabaseData['usuarios'] = mockUser;

      const result = await fetchUsuarioById('user-456');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('user-456');
        expect(result.data.papel).toBe('motorista');
      }
    });

    it('should handle not found error', async () => {
      mockSupabaseError['usuarios'] = { message: 'Not found', code: 'PGRST116' };

      const result = await fetchUsuarioById('nonexistent');

      expect(result.success).toBe(false);
    });
  });

  describe('fetchMotoristasByUnidade', () => {
    it('should return empty array when no motoristas', async () => {
      mockSupabaseData['usuarios'] = [];

      const result = await fetchMotoristasByUnidade('unidade-empty');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(0);
      }
    });

    it('should handle query error', async () => {
      mockSupabaseError['usuarios'] = { message: 'Database error', code: '500' };

      const result = await fetchMotoristasByUnidade('unidade-error');

      expect(result.success).toBe(false);
    });
  });

  describe('updateUsuario', () => {
    it('should update user successfully', async () => {
      const updatedUser: UsuarioDB = {
        id: 'user-123',
        email: 'updated@example.com',
        nome: 'Updated Name',
        papel: 'gestor' as TipoUsuario,
        telefone: '11777777777',
        avatar_url: null,
        ativo: true,
        primeiro_acesso: false,
        ultimo_acesso: '2024-01-01T00:00:00Z',
        criado_em: '2024-01-01T00:00:00Z',
      };

      mockSupabaseData['usuarios'] = updatedUser;

      const result = await updateUsuario('user-123', { nome: 'Updated Name' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.nome).toBe('Updated Name');
      }
    });

    it('should handle update error', async () => {
      mockSupabaseError['usuarios'] = { message: 'Update failed', code: '42501' };

      const result = await updateUsuario('user-123', { nome: 'New Name' });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('permission');
      }
    });
  });

  describe('updateUltimoAcesso', () => {
    it('should update last access timestamp', async () => {
      mockSupabaseData['usuarios'] = {};

      const result = await updateUltimoAcesso('user-123');

      expect(result.success).toBe(true);
    });

    it('should handle update error', async () => {
      mockSupabaseError['usuarios'] = { message: 'Update failed' };

      const result = await updateUltimoAcesso('user-123');

      expect(result.success).toBe(false);
    });
  });

  describe('checkEmailExists', () => {
    it('should return true when email exists', async () => {
      mockSupabaseData['usuarios'] = { id: 'user-123' };

      const result = await checkEmailExists('existing@example.com');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(true);
      }
    });

    it('should return false when email does not exist', async () => {
      mockSupabaseData['usuarios'] = null;

      const result = await checkEmailExists('new@example.com');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(false);
      }
    });

    it('should handle query error', async () => {
      mockSupabaseError['usuarios'] = { message: 'Database error' };

      const result = await checkEmailExists('test@example.com');

      expect(result.success).toBe(false);
    });

    it('should exclude user by ID when provided', async () => {
      mockSupabaseData['usuarios'] = null;

      const result = await checkEmailExists('test@example.com', 'user-to-exclude');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(false);
      }
    });
  });

  describe('fetchCurrentUserWithCache', () => {
    const { getCache, setCache } = require('@/lib/cache');

    beforeEach(() => {
      getCache.mockReset();
      setCache.mockReset();
    });

    it('should return cached user when available', async () => {
      const cachedUser = {
        id: 'user-cached',
        nome: 'Cached User',
        email: 'cached@example.com',
      };

      getCache.mockResolvedValue(cachedUser);

      const result = await fetchCurrentUserWithCache('user-cached');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(cachedUser);
      }
      expect(getCache).toHaveBeenCalled();
    });

    it('should fetch fresh data when cache miss', async () => {
      getCache.mockResolvedValue(null);

      const mockUser = {
        id: 'user-fresh',
        nome: 'Fresh User',
        email: 'fresh@example.com',
      };
      mockSupabaseData['usuarios'] = mockUser;

      const result = await fetchCurrentUserWithCache('user-fresh');

      expect(result.success).toBe(true);
      expect(setCache).toHaveBeenCalled();
    });

    it('should force refresh when option is set', async () => {
      const cachedUser = { id: 'user-old', nome: 'Old' };
      getCache.mockResolvedValue(cachedUser);

      const freshUser = { id: 'user-fresh', nome: 'Fresh' };
      mockSupabaseData['usuarios'] = freshUser;

      const result = await fetchCurrentUserWithCache('user-1', { forceRefresh: true });

      expect(result.success).toBe(true);
      // forceRefresh should skip cache check
      expect(setCache).toHaveBeenCalled();
    });
  });

  describe('fetchMotoristasWithCache', () => {
    const { getCache, setCache } = require('@/lib/cache');

    beforeEach(() => {
      getCache.mockReset();
      setCache.mockReset();
    });

    it('should return cached motoristas when available', async () => {
      const cachedMotoristas = [
        { id: 'motorista-1', nome: 'Carlos' },
      ];

      getCache.mockResolvedValue(cachedMotoristas);

      const result = await fetchMotoristasWithCache('unidade-1');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(cachedMotoristas);
      }
    });

    it('should fetch fresh data when cache miss', async () => {
      getCache.mockResolvedValue(null);

      mockSupabaseData['usuarios'] = [];

      const result = await fetchMotoristasWithCache('unidade-1');

      expect(result.success).toBe(true);
      expect(setCache).toHaveBeenCalled();
    });

    it('should force refresh when option is set', async () => {
      getCache.mockResolvedValue([{ id: 'cached' }]);
      mockSupabaseData['usuarios'] = [];

      const result = await fetchMotoristasWithCache('unidade-1', { forceRefresh: true });

      expect(result.success).toBe(true);
    });
  });

  describe('fetchUsuariosByPapel', () => {
    it('should fetch users by papel in unidade', async () => {
      const mockUsers = [
        { id: 'user-1', nome: 'João', papel: 'gestor' },
        { id: 'user-2', nome: 'Maria', papel: 'gestor' },
      ];
      mockSupabaseData['usuarios'] = mockUsers;

      const result = await fetchUsuariosByPapel('unidade-1', 'gestor');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
      }
    });

    it('should return empty array when no users with papel', async () => {
      mockSupabaseData['usuarios'] = [];

      const result = await fetchUsuariosByPapel('unidade-1', 'motorista');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(0);
      }
    });

    it('should handle query error', async () => {
      mockSupabaseError['usuarios'] = { message: 'Error' };

      const result = await fetchUsuariosByPapel('unidade-1', 'gestor');

      expect(result.success).toBe(false);
    });
  });

  describe('updateAvatarUrl', () => {
    it('should update avatar URL', async () => {
      const updatedUser = {
        id: 'user-1',
        avatar_url: 'https://example.com/avatar.jpg',
      };
      mockSupabaseData['usuarios'] = updatedUser;

      const result = await updateAvatarUrl('user-1', 'https://example.com/avatar.jpg');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.avatar_url).toBe('https://example.com/avatar.jpg');
      }
    });

    it('should set avatar URL to null', async () => {
      const updatedUser = {
        id: 'user-1',
        avatar_url: null,
      };
      mockSupabaseData['usuarios'] = updatedUser;

      const result = await updateAvatarUrl('user-1', null);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.avatar_url).toBeNull();
      }
    });
  });

  describe('fetchMotoristaKPIs', () => {
    it('should calculate KPIs correctly', async () => {
      const mockRotas = [
        { id: 'rota-1', status: 'concluida', duracao_total_minutos: 60 },
        { id: 'rota-2', status: 'concluida', duracao_total_minutos: 120 },
        { id: 'rota-3', status: 'pendente', duracao_total_minutos: null },
      ];
      mockSupabaseData['rotas'] = mockRotas;

      const mockParadas = [
        { id: 'parada-1', status: 'concluida', is_checkpoint: true },
        { id: 'parada-2', status: 'concluida', is_checkpoint: true },
      ];
      mockSupabaseData['paradas'] = mockParadas;

      const result = await fetchMotoristaKPIs('motorista-1', {
        inicio: '2024-01-01',
        fim: '2024-01-31',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.rotasConcluidas).toBe(2);
        expect(result.data.paradasConcluidas).toBe(2);
        expect(result.data.tempoMedioMinutos).toBe(90); // (60 + 120) / 2
        expect(result.data.taxaConclusao).toBe(67); // 2/3 * 100 = 66.66 rounded to 67
      }
    });

    it('should handle no rotas', async () => {
      mockSupabaseData['rotas'] = [];

      const result = await fetchMotoristaKPIs('motorista-1', {
        inicio: '2024-01-01',
        fim: '2024-01-31',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.rotasConcluidas).toBe(0);
        expect(result.data.paradasConcluidas).toBe(0);
        expect(result.data.tempoMedioMinutos).toBe(0);
        expect(result.data.taxaConclusao).toBe(0);
      }
    });

    it('should handle null duracao_total_minutos', async () => {
      const mockRotas = [
        { id: 'rota-1', status: 'concluida', duracao_total_minutos: null },
        { id: 'rota-2', status: 'concluida', duracao_total_minutos: 60 },
      ];
      mockSupabaseData['rotas'] = mockRotas;
      mockSupabaseData['paradas'] = [];

      const result = await fetchMotoristaKPIs('motorista-1', {
        inicio: '2024-01-01',
        fim: '2024-01-31',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tempoMedioMinutos).toBe(30); // 60 / 2
      }
    });

    it('should handle query error', async () => {
      mockSupabaseError['rotas'] = { message: 'Error' };

      const result = await fetchMotoristaKPIs('motorista-1', {
        inicio: '2024-01-01',
        fim: '2024-01-31',
      });

      expect(result.success).toBe(false);
    });
  });
});
