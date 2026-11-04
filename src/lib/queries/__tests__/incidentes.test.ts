/**
 * Tests for incidentes queries
 */

// Mock supabase
const mockFrom = jest.fn();

jest.mock('../queryClient', () => {
  const originalModule = jest.requireActual('../queryClient');
  return {
    ...originalModule,
    supabase: {
      from: (table: string) => mockFrom(table),
    },
    safeQuery: async (fn: () => Promise<any>) => {
      try {
        const data = await fn();
        return { success: true, data };
      } catch (error) {
        return {
          success: false,
          error: { code: 'UNKNOWN', message: String(error) },
        };
      }
    },
    withRetry: async (fn: () => Promise<any>) => fn(),
    classifyError: (error: any) => ({
      code: 'UNKNOWN',
      message: error?.message || 'Unknown error',
    }),
  };
});

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

import { criarCadeia } from '@/__tests__/helpers/cadeiaSupabase';
import { logger } from '@/lib/logger';

import {
  fetchIncidentesForGestor,
  createIncidente,
  logIncidenteAction,
} from '../incidentes';

describe('incidentes queries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchIncidentesForGestor', () => {
    it('should return empty array when motoristasIds is empty', async () => {
      const result = await fetchIncidentesForGestor({
        motoristasIds: [],
        unidadeId: 'unidade-1',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('should fetch incidentes with relations', async () => {
      const mockData = [
        {
          id: 'inc-1',
          categoria: 'accident',
          descricao: 'Test incident',
          endereco: 'Rua Test, 123',
          status: 'aberto',
          foto_url: null,
          created_at: '2024-01-01T10:00:00Z',
          observacoes_gestao: null,
          motorista_id: 'motorista-1',
          motorista: { nome: 'João' },
          rota: { id: 'rota-1', data: '2024-01-01' },
          parada: { endereco: 'Rua Parada, 456' },
        },
      ];

      mockFrom.mockImplementation(() =>
        criarCadeia({ data: mockData, error: null }),
      );

      const result = await fetchIncidentesForGestor({
        motoristasIds: ['motorista-1', 'motorista-2'],
        unidadeId: 'unidade-1',
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].motorista_nome).toBe('João');
      expect(result.data![0].rota_id).toBe('rota-1');
      expect(result.data![0].parada_endereco).toBe('Rua Parada, 456');
    });

    it('should apply status filter', async () => {
      const chain = criarCadeia({ data: [], error: null });
      mockFrom.mockImplementation(() => chain);

      await fetchIncidentesForGestor({
        motoristasIds: ['motorista-1'],
        unidadeId: 'unidade-1',
        status: 'aberto',
      });

      expect(chain.eq).toHaveBeenCalled();
    });

    it('should apply categoria filter', async () => {
      const chain = criarCadeia({ data: [], error: null });
      mockFrom.mockImplementation(() => chain);

      await fetchIncidentesForGestor({
        motoristasIds: ['motorista-1'],
        unidadeId: 'unidade-1',
        categoria: 'vehicle',
      });

      expect(chain.eq).toHaveBeenCalled();
    });

    it('should handle null relations gracefully', async () => {
      const mockData = [
        {
          id: 'inc-1',
          categoria: 'other',
          descricao: 'Test',
          endereco: 'Test address',
          status: 'aberto',
          foto_url: null,
          created_at: '2024-01-01T10:00:00Z',
          observacoes_gestao: null,
          motorista_id: 'motorista-1',
          motorista: null,
          rota: null,
          parada: null,
        },
      ];

      mockFrom.mockImplementation(() =>
        criarCadeia({ data: mockData, error: null }),
      );

      const result = await fetchIncidentesForGestor({
        motoristasIds: ['motorista-1'],
        unidadeId: 'unidade-1',
      });

      expect(result.success).toBe(true);
      expect(result.data![0].motorista_nome).toBe('Desconhecido');
      expect(result.data![0].rota_id).toBeNull();
      expect(result.data![0].parada_endereco).toBeNull();
    });

    it('motorista excluído (motorista_id NULL): nome "Motorista removido"', async () => {
      mockFrom.mockImplementation(() =>
        criarCadeia({
          data: [
            {
              id: 'inc-1',
              categoria: 'other',
              descricao: 'Test',
              endereco: 'Test address',
              status: 'aberto',
              foto_url: null,
              created_at: '2024-01-01T10:00:00Z',
              observacoes_gestao: null,
              motorista_id: null,
              motorista: null,
              rota: null,
              parada: null,
            },
          ],
          error: null,
        }),
      );

      const result = await fetchIncidentesForGestor({
        motoristasIds: ['motorista-1'],
        unidadeId: 'unidade-1',
      });

      expect(result.data![0].motorista_nome).toBe('Motorista removido');
      expect(result.data![0].motorista_id).toBeNull();
    });

    it('should handle database error', async () => {
      mockFrom.mockImplementation(() =>
        criarCadeia({ data: null, error: { message: 'Database error' } }),
      );

      // safeQuery will catch the error
      await fetchIncidentesForGestor({
        motoristasIds: ['motorista-1'],
        unidadeId: 'unidade-1',
      });

      // The mock safeQuery catches errors and returns success: false
      expect(mockFrom).toHaveBeenCalledWith('incidentes');
    });
  });

  describe('createIncidente', () => {
    it('should create incidente with default status', async () => {
      const mockIncidente = {
        id: 'inc-new',
        motorista_id: 'motorista-1',
        categoria: 'accident',
        descricao: 'New incident',
        endereco: 'Test address',
        status: 'aberto',
      };

      mockFrom.mockImplementation(() =>
        criarCadeia({ data: mockIncidente, error: null }),
      );

      const result = await createIncidente({
        motorista_id: 'motorista-1',
        categoria: 'accident',
        descricao: 'New incident',
        endereco: 'Test address',
      });

      expect(mockFrom).toHaveBeenCalledWith('incidentes');
      expect(result.success).toBe(true);
    });

    it('should create incidente with custom status', async () => {
      const mockIncidente = {
        id: 'inc-new',
        status: 'em_analise',
      };

      mockFrom.mockImplementation(() =>
        criarCadeia({ data: mockIncidente, error: null }),
      );

      const result = await createIncidente({
        motorista_id: 'motorista-1',
        categoria: 'vehicle',
        descricao: 'Vehicle issue',
        endereco: 'Test address',
        status: 'em_analise',
      });

      expect(result.success).toBe(true);
    });

    it('should handle creation error', async () => {
      mockFrom.mockImplementation(() => {
        const chain = criarCadeia({
          data: null,
          error: { message: 'Insert failed' },
        });
        chain.single = jest.fn(() =>
          Promise.reject(new Error('Insert failed')),
        );
        return chain;
      });

      const result = await createIncidente({
        motorista_id: 'motorista-1',
        categoria: 'accident',
        descricao: 'Test',
        endereco: 'Test address',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('logIncidenteAction', () => {
    it('should log incidente action', async () => {
      mockFrom.mockImplementation(() =>
        criarCadeia({ data: null, error: null }),
      );

      await logIncidenteAction('user-123', 'inc-1', 'incidente_criado');

      expect(mockFrom).toHaveBeenCalledWith('logs');
    });

    it('should include detalhes in log', async () => {
      mockFrom.mockImplementation(() =>
        criarCadeia({ data: null, error: null }),
      );

      await logIncidenteAction('user-123', 'inc-1', 'status_alterado', {
        old_status: 'aberto',
        new_status: 'em_analise',
      });

      expect(mockFrom).toHaveBeenCalledWith('logs');
    });

    it('should handle log error gracefully', async () => {
      mockFrom.mockImplementation(() => {
        throw new Error('Log failed');
      });

      // Should not throw
      await logIncidenteAction('user-123', 'inc-1', 'test_event');

      expect(logger.warn).toHaveBeenCalledWith(
        'Failed to log action:',
        expect.objectContaining({
          evento: 'test_event',
          error: expect.any(Error),
        }),
      );
    });

    it('manda incidente_id dentro de detalhes, sem rota_id e sem coluna própria', async () => {
      const chain = criarCadeia({ data: null, error: null });
      mockFrom.mockImplementation(() => chain);

      await logIncidenteAction('user-123', 'inc-1', 'status_alterado', {
        novo: 'resolvido',
      });

      expect(chain.insert).toHaveBeenCalledWith({
        usuario_id: 'user-123',
        evento: 'status_alterado',
        rota_id: null,
        detalhes: { novo: 'resolvido', incidente_id: 'inc-1' },
      });
    });

    it('avisa por logger.warn quando o banco recusa o insert (resolve com error)', async () => {
      mockFrom.mockImplementation(() =>
        criarCadeia({ data: null, error: { message: 'recusado' } }),
      );

      await logIncidenteAction('user-123', 'inc-1', 'test_event');

      expect(logger.warn).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ evento: 'test_event' }),
      );
    });
  });
});
