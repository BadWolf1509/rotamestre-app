/**
 * Tests for paradas queries
 */

import { logger } from '@/lib/logger';
import type { StatusCheckpoint } from '@/types/rota';

// Mock data stores
const mockSupabaseData: Record<string, unknown> = {};
const mockSupabaseError: Record<string, unknown> = {};
// Último corpo de INSERT por tabela
const mockUltimoInsert: Record<string, unknown> = {};
// Último corpo de UPDATE por tabela (para conferir as colunas mandadas)
const mockUltimoUpdate: Record<string, unknown> = {};

// Create a chainable mock that captures the table name
const createChainableMock = (tableName: string) => {
  const chain: any = {
    select: jest.fn(() => chain),
    insert: jest.fn((dados: unknown) => {
      mockUltimoInsert[tableName] = dados;
      return chain;
    }),
    update: jest.fn((dados: unknown) => {
      mockUltimoUpdate[tableName] = dados;
      return chain;
    }),
    delete: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    neq: jest.fn(() => chain),
    in: jest.fn(() => chain),
    gte: jest.fn(() => chain),
    lte: jest.fn(() => chain),
    order: jest.fn(() => chain),
    limit: jest.fn(() => chain),
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
import { updateParadaStatus, logParadaAction, type ParadaDB } from '../paradas';

describe('paradas queries', () => {
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

  describe('logParadaAction', () => {
    it('grava parada_id dentro de detalhes, nunca como coluna', async () => {
      await logParadaAction('user-1', 'parada-1', 'rota-1', 'evento_x', {
        a: 1,
      });

      expect(mockUltimoInsert.logs).toEqual({
        usuario_id: 'user-1',
        rota_id: 'rota-1',
        evento: 'evento_x',
        detalhes: { a: 1, parada_id: 'parada-1' },
      });
    });

    it('avisa por logger.warn quando o banco recusa o insert (resolve com error)', async () => {
      mockSupabaseError.logs = { message: 'recusado' };

      await logParadaAction('user-1', 'parada-1', 'rota-1', 'evento_x');

      expect(logger.warn).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ evento: 'evento_x' }),
      );
    });
  });

  describe('updateParadaStatus', () => {
    it('should update status to concluida', async () => {
      const updatedParada: ParadaDB = {
        id: 'parada-1',
        rota_id: 'rota-123',
        ordem: 1,
        tipo: 'entrega',
        status: 'concluida' as StatusCheckpoint,
        endereco: 'Rua A',
        destinatario: null,
        telefone: null,
        latitude: -23.5,
        longitude: -46.6,
        observacoes: null,
        foto_url: null,
        is_checkpoint: true,
        concluida_em: '2024-01-01T10:00:00Z',
        criado_em: '2024-01-01T00:00:00Z',
      };
      mockSupabaseData['paradas'] = updatedParada;

      const result = await updateParadaStatus('parada-1', 'concluida');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('concluida');
      }
    });

    it('should update status to pulada', async () => {
      const updatedParada: ParadaDB = {
        id: 'parada-1',
        rota_id: 'rota-123',
        ordem: 1,
        tipo: 'entrega',
        status: 'pulada' as StatusCheckpoint,
        endereco: 'Rua A',
        destinatario: null,
        telefone: null,
        latitude: -23.5,
        longitude: -46.6,
        observacoes: 'Cliente ausente',
        foto_url: null,
        is_checkpoint: true,
        concluida_em: null,
        criado_em: '2024-01-01T00:00:00Z',
      };
      mockSupabaseData['paradas'] = updatedParada;

      const result = await updateParadaStatus('parada-1', 'pulada', {
        observacoes: 'Cliente ausente',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('pulada');
      }
    });
  });
});
