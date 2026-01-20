/**
 * Tests for paradas queries
 */

import type { StatusCheckpoint } from '@/types/rota';

// Mock data stores
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
  fetchParadasByRota,
  fetchParadaById,
  fetchCheckpointsByRota,
  fetchParadasStats,
  createParadasBatch,
  updateParadaStatus,
  completeParada,
  skipParada,
  updateParada,
  deleteParada,
  fetchNextPendingParada,
  type ParadaDB,
  type ParadaInsert,
} from '../paradas';

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

  describe('fetchParadasByRota', () => {
    const mockParadas: ParadaDB[] = [
      {
        id: 'parada-1',
        rota_id: 'rota-123',
        ordem: 1,
        tipo: 'entrega',
        status: 'pendente' as StatusCheckpoint,
        endereco: 'Rua A, 123',
        destinatario: 'João',
        telefone: '11999999999',
        latitude: -23.5,
        longitude: -46.6,
        observacoes: null,
        foto_url: null,
        is_checkpoint: true,
        concluida_em: null,
        criado_em: '2024-01-01T00:00:00Z',
      },
      {
        id: 'parada-2',
        rota_id: 'rota-123',
        ordem: 2,
        tipo: 'retirada',
        status: 'concluida' as StatusCheckpoint,
        endereco: 'Rua B, 456',
        destinatario: 'Maria',
        telefone: '11888888888',
        latitude: -23.6,
        longitude: -46.7,
        observacoes: 'Entregue com sucesso',
        foto_url: 'https://example.com/foto.jpg',
        is_checkpoint: true,
        concluida_em: '2024-01-01T10:00:00Z',
        criado_em: '2024-01-01T00:00:00Z',
      },
    ];

    it('should fetch all paradas for a rota', async () => {
      mockSupabaseData['paradas'] = mockParadas;

      const result = await fetchParadasByRota('rota-123');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
        expect(result.data[0].id).toBe('parada-1');
      }
    });

    it('should return empty array when no paradas', async () => {
      mockSupabaseData['paradas'] = [];

      const result = await fetchParadasByRota('rota-empty');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(0);
      }
    });

    it('should handle error', async () => {
      mockSupabaseError['paradas'] = { message: 'Database error' };

      const result = await fetchParadasByRota('rota-error');

      expect(result.success).toBe(false);
    });
  });

  describe('fetchParadaById', () => {
    const mockParada: ParadaDB = {
      id: 'parada-1',
      rota_id: 'rota-123',
      ordem: 1,
      tipo: 'entrega',
      status: 'pendente' as StatusCheckpoint,
      endereco: 'Rua A, 123',
      destinatario: 'João',
      telefone: '11999999999',
      latitude: -23.5,
      longitude: -46.6,
      observacoes: null,
      foto_url: null,
      is_checkpoint: true,
      concluida_em: null,
      criado_em: '2024-01-01T00:00:00Z',
    };

    it('should fetch parada by ID', async () => {
      mockSupabaseData['paradas'] = mockParada;

      const result = await fetchParadaById('parada-1');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('parada-1');
        expect(result.data.endereco).toBe('Rua A, 123');
      }
    });

    it('should handle not found', async () => {
      mockSupabaseError['paradas'] = { message: 'Not found', code: 'PGRST116' };

      const result = await fetchParadaById('nonexistent');

      expect(result.success).toBe(false);
    });
  });

  describe('fetchCheckpointsByRota', () => {
    it('should fetch only checkpoint paradas', async () => {
      const checkpoints: ParadaDB[] = [
        {
          id: 'checkpoint-1',
          rota_id: 'rota-123',
          ordem: 1,
          tipo: 'entrega',
          status: 'pendente' as StatusCheckpoint,
          endereco: 'Checkpoint 1',
          destinatario: null,
          telefone: null,
          latitude: -23.5,
          longitude: -46.6,
          observacoes: null,
          foto_url: null,
          is_checkpoint: true,
          concluida_em: null,
          criado_em: '2024-01-01T00:00:00Z',
        },
      ];
      mockSupabaseData['paradas'] = checkpoints;

      const result = await fetchCheckpointsByRota('rota-123');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data[0].is_checkpoint).toBe(true);
      }
    });
  });

  describe('fetchParadasStats', () => {
    it('should calculate stats correctly', async () => {
      const paradasWithStatus = [
        { id: '1', status: 'concluida', is_checkpoint: true },
        { id: '2', status: 'concluida', is_checkpoint: true },
        { id: '3', status: 'pendente', is_checkpoint: true },
        { id: '4', status: 'pulada', is_checkpoint: true },
      ];
      mockSupabaseData['paradas'] = paradasWithStatus;

      const result = await fetchParadasStats('rota-123');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.total).toBe(4);
        expect(result.data.concluidas).toBe(2);
        expect(result.data.pendentes).toBe(1);
        expect(result.data.puladas).toBe(1);
        expect(result.data.progresso).toBe(50); // 2/4 = 50%
      }
    });

    it('should return zero progress for empty stats', async () => {
      mockSupabaseData['paradas'] = [];

      const result = await fetchParadasStats('rota-empty');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.total).toBe(0);
        expect(result.data.progresso).toBe(0);
      }
    });
  });

  describe('createParadasBatch', () => {
    it('should create multiple paradas', async () => {
      const newParadas: ParadaInsert[] = [
        {
          rota_id: 'rota-123',
          ordem: 1,
          tipo: 'entrega',
          endereco: 'Rua A',
          latitude: -23.5,
          longitude: -46.6,
        },
        {
          rota_id: 'rota-123',
          ordem: 2,
          tipo: 'retirada',
          endereco: 'Rua B',
          latitude: -23.6,
          longitude: -46.7,
        },
      ];

      const createdParadas: ParadaDB[] = newParadas.map((p, i) => ({
        ...p,
        id: `parada-${i + 1}`,
        status: 'pendente' as StatusCheckpoint,
        destinatario: null,
        telefone: null,
        observacoes: null,
        foto_url: null,
        is_checkpoint: true,
        concluida_em: null,
        criado_em: '2024-01-01T00:00:00Z',
      }));

      mockSupabaseData['paradas'] = createdParadas;

      const result = await createParadasBatch(newParadas);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
      }
    });

    it('should handle creation error', async () => {
      mockSupabaseError['paradas'] = { message: 'Validation error', code: '23505' };

      const result = await createParadasBatch([
        {
          rota_id: 'rota-123',
          ordem: 1,
          tipo: 'entrega',
          endereco: 'Rua A',
          latitude: -23.5,
          longitude: -46.6,
        },
      ]);

      expect(result.success).toBe(false);
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

      const result = await updateParadaStatus('parada-1', 'pulada', { observacoes: 'Cliente ausente' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('pulada');
      }
    });
  });

  describe('completeParada', () => {
    it('should complete parada with photo', async () => {
      const completedParada: ParadaDB = {
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
        observacoes: 'Entregue',
        foto_url: 'https://example.com/photo.jpg',
        is_checkpoint: true,
        concluida_em: '2024-01-01T10:00:00Z',
        criado_em: '2024-01-01T00:00:00Z',
      };
      mockSupabaseData['paradas'] = completedParada;

      const result = await completeParada('parada-1', {
        fotoUrl: 'https://example.com/photo.jpg',
        observacoes: 'Entregue',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('concluida');
        expect(result.data.foto_url).toBe('https://example.com/photo.jpg');
      }
    });
  });

  describe('skipParada', () => {
    it('should skip parada with reason', async () => {
      const skippedParada: ParadaDB = {
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
        observacoes: 'Endereço não encontrado',
        foto_url: null,
        is_checkpoint: true,
        concluida_em: null,
        criado_em: '2024-01-01T00:00:00Z',
      };
      mockSupabaseData['paradas'] = skippedParada;

      const result = await skipParada('parada-1', 'Endereço não encontrado');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('pulada');
        expect(result.data.observacoes).toBe('Endereço não encontrado');
      }
    });
  });

  describe('updateParada', () => {
    it('should update parada fields', async () => {
      const updatedParada: ParadaDB = {
        id: 'parada-1',
        rota_id: 'rota-123',
        ordem: 2,
        tipo: 'entrega',
        status: 'pendente' as StatusCheckpoint,
        endereco: 'Novo Endereço',
        destinatario: 'Novo Destinatário',
        telefone: null,
        latitude: -23.5,
        longitude: -46.6,
        observacoes: null,
        foto_url: null,
        is_checkpoint: true,
        concluida_em: null,
        criado_em: '2024-01-01T00:00:00Z',
      };
      mockSupabaseData['paradas'] = updatedParada;

      const result = await updateParada('parada-1', {
        ordem: 2,
        endereco: 'Novo Endereço',
        destinatario: 'Novo Destinatário',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.ordem).toBe(2);
        expect(result.data.endereco).toBe('Novo Endereço');
      }
    });
  });

  describe('deleteParada', () => {
    it('should delete parada successfully', async () => {
      mockSupabaseData['paradas'] = null;

      const result = await deleteParada('parada-1');

      expect(result.success).toBe(true);
    });

    it('should handle delete error', async () => {
      mockSupabaseError['paradas'] = { message: 'Delete failed', code: '42501' };

      const result = await deleteParada('parada-1');

      expect(result.success).toBe(false);
    });
  });

  describe('fetchNextPendingParada', () => {
    it('should return next pending parada', async () => {
      const nextParada: ParadaDB = {
        id: 'parada-3',
        rota_id: 'rota-123',
        ordem: 3,
        tipo: 'entrega',
        status: 'pendente' as StatusCheckpoint,
        endereco: 'Próximo Endereço',
        destinatario: null,
        telefone: null,
        latitude: -23.5,
        longitude: -46.6,
        observacoes: null,
        foto_url: null,
        is_checkpoint: true,
        concluida_em: null,
        criado_em: '2024-01-01T00:00:00Z',
      };
      mockSupabaseData['paradas'] = nextParada;

      const result = await fetchNextPendingParada('rota-123');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).not.toBeNull();
        expect(result.data?.status).toBe('pendente');
      }
    });

    it('should return null when no pending paradas', async () => {
      mockSupabaseData['paradas'] = null;

      const result = await fetchNextPendingParada('rota-123');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeNull();
      }
    });
  });
});
