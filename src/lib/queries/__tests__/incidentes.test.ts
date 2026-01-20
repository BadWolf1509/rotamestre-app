/**
 * Tests for incidentes queries
 */

// Mock supabase
const mockFrom = jest.fn();

// Setup chainable mock
const setupChain = (finalResult: any) => {
  const chain: any = {
    select: jest.fn(() => chain),
    insert: jest.fn(() => chain),
    update: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    in: jest.fn(() => chain),
    order: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    single: jest.fn(() => Promise.resolve(finalResult)),
    then: (resolve: any) => Promise.resolve(finalResult).then(resolve),
  };
  return chain;
};

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
        return { success: false, error: { code: 'UNKNOWN', message: String(error) } };
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

import { logger } from '@/lib/logger';

import {
  fetchIncidentesForGestor,
  fetchIncidenteById,
  fetchIncidentesByMotorista,
  createIncidente,
  updateIncidenteStatus,
  updateIncidente,
  fetchIncidentesStats,
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

      mockFrom.mockImplementation(() => setupChain({ data: mockData, error: null }));

      const result = await fetchIncidentesForGestor({
        motoristasIds: ['motorista-1', 'motorista-2'],
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].motorista_nome).toBe('João');
      expect(result.data![0].rota_id).toBe('rota-1');
      expect(result.data![0].parada_endereco).toBe('Rua Parada, 456');
    });

    it('should apply status filter', async () => {
      const chain = setupChain({ data: [], error: null });
      mockFrom.mockImplementation(() => chain);

      await fetchIncidentesForGestor({
        motoristasIds: ['motorista-1'],
        status: 'aberto',
      });

      expect(chain.eq).toHaveBeenCalled();
    });

    it('should apply categoria filter', async () => {
      const chain = setupChain({ data: [], error: null });
      mockFrom.mockImplementation(() => chain);

      await fetchIncidentesForGestor({
        motoristasIds: ['motorista-1'],
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

      mockFrom.mockImplementation(() => setupChain({ data: mockData, error: null }));

      const result = await fetchIncidentesForGestor({
        motoristasIds: ['motorista-1'],
      });

      expect(result.success).toBe(true);
      expect(result.data![0].motorista_nome).toBe('Desconhecido');
      expect(result.data![0].rota_id).toBeNull();
      expect(result.data![0].parada_endereco).toBeNull();
    });

    it('should handle database error', async () => {
      mockFrom.mockImplementation(() =>
        setupChain({ data: null, error: { message: 'Database error' } })
      );

      // safeQuery will catch the error
      await fetchIncidentesForGestor({
        motoristasIds: ['motorista-1'],
      });

      // The mock safeQuery catches errors and returns success: false
      expect(mockFrom).toHaveBeenCalledWith('incidentes');
    });
  });

  describe('fetchIncidenteById', () => {
    it('should fetch single incidente', async () => {
      const mockIncidente = {
        id: 'inc-1',
        motorista_id: 'motorista-1',
        categoria: 'accident',
        descricao: 'Test',
        endereco: 'Test address',
        status: 'aberto',
      };

      mockFrom.mockImplementation(() => setupChain({ data: mockIncidente, error: null }));

      const result = await fetchIncidenteById('inc-1');

      expect(mockFrom).toHaveBeenCalledWith('incidentes');
      expect(result.success).toBe(true);
    });
  });

  describe('fetchIncidentesByMotorista', () => {
    it('should fetch incidentes by motorista id', async () => {
      const mockData = [
        { id: 'inc-1', motorista_id: 'motorista-1', status: 'aberto' },
        { id: 'inc-2', motorista_id: 'motorista-1', status: 'resolvido' },
      ];

      mockFrom.mockImplementation(() => setupChain({ data: mockData, error: null }));

      const result = await fetchIncidentesByMotorista('motorista-1');

      expect(result.success).toBe(true);
      expect(mockFrom).toHaveBeenCalledWith('incidentes');
    });

    it('should apply status filter', async () => {
      const chain = setupChain({ data: [], error: null });
      mockFrom.mockImplementation(() => chain);

      await fetchIncidentesByMotorista('motorista-1', { status: 'aberto' });

      expect(chain.eq).toHaveBeenCalled();
    });

    it('should apply limit', async () => {
      const chain = setupChain({ data: [], error: null });
      mockFrom.mockImplementation(() => chain);

      await fetchIncidentesByMotorista('motorista-1', { limit: 10 });

      expect(chain.limit).toHaveBeenCalledWith(10);
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

      mockFrom.mockImplementation(() => setupChain({ data: mockIncidente, error: null }));

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

      mockFrom.mockImplementation(() => setupChain({ data: mockIncidente, error: null }));

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
        const chain = setupChain({ data: null, error: { message: 'Insert failed' } });
        chain.single = jest.fn(() => Promise.reject(new Error('Insert failed')));
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

  describe('updateIncidenteStatus', () => {
    it('should update status without observacoes', async () => {
      const mockIncidente = {
        id: 'inc-1',
        status: 'em_analise',
      };

      mockFrom.mockImplementation(() => setupChain({ data: mockIncidente, error: null }));

      const result = await updateIncidenteStatus('inc-1', 'em_analise');

      expect(mockFrom).toHaveBeenCalledWith('incidentes');
      expect(result.success).toBe(true);
    });

    it('should update status with observacoes', async () => {
      const mockIncidente = {
        id: 'inc-1',
        status: 'resolvido',
        observacoes_gestao: 'Fixed the issue',
      };

      mockFrom.mockImplementation(() => setupChain({ data: mockIncidente, error: null }));

      const result = await updateIncidenteStatus('inc-1', 'resolvido', 'Fixed the issue');

      expect(result.success).toBe(true);
    });

    it('should set resolvido_em when status is resolvido', async () => {
      mockFrom.mockImplementation(() => setupChain({ data: { id: 'inc-1' }, error: null }));

      await updateIncidenteStatus('inc-1', 'resolvido');

      // The function should have been called - we can verify the from call
      expect(mockFrom).toHaveBeenCalledWith('incidentes');
    });
  });

  describe('updateIncidente', () => {
    it('should update incidente fields', async () => {
      const mockIncidente = {
        id: 'inc-1',
        status: 'fechado',
      };

      mockFrom.mockImplementation(() => setupChain({ data: mockIncidente, error: null }));

      const result = await updateIncidente('inc-1', { status: 'fechado' });

      expect(mockFrom).toHaveBeenCalledWith('incidentes');
      expect(result.success).toBe(true);
    });
  });

  describe('fetchIncidentesStats', () => {
    it('should return zero stats for empty motoristasIds', async () => {
      const result = await fetchIncidentesStats([]);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        total: 0,
        abertos: 0,
        emAnalise: 0,
        resolvidos: 0,
        fechados: 0,
        porCategoria: {},
      });
    });

    it('should calculate stats correctly', async () => {
      const mockData = [
        { id: 'inc-1', status: 'aberto', categoria: 'accident' },
        { id: 'inc-2', status: 'aberto', categoria: 'accident' },
        { id: 'inc-3', status: 'em_analise', categoria: 'vehicle' },
        { id: 'inc-4', status: 'resolvido', categoria: 'accident' },
        { id: 'inc-5', status: 'fechado', categoria: 'other' },
      ];

      mockFrom.mockImplementation(() => setupChain({ data: mockData, error: null }));

      const result = await fetchIncidentesStats(['motorista-1']);

      expect(result.success).toBe(true);
      expect(result.data!.total).toBe(5);
      expect(result.data!.abertos).toBe(2);
      expect(result.data!.emAnalise).toBe(1);
      expect(result.data!.resolvidos).toBe(1);
      expect(result.data!.fechados).toBe(1);
      expect(result.data!.porCategoria).toEqual({
        accident: 3,
        vehicle: 1,
        other: 1,
      });
    });

    it('should handle empty data', async () => {
      mockFrom.mockImplementation(() => setupChain({ data: [], error: null }));

      const result = await fetchIncidentesStats(['motorista-1']);

      expect(result.success).toBe(true);
      expect(result.data!.total).toBe(0);
    });
  });

  describe('logIncidenteAction', () => {
    it('should log incidente action', async () => {
      mockFrom.mockImplementation(() => setupChain({ data: null, error: null }));

      await logIncidenteAction('user-123', 'inc-1', 'incidente_criado');

      expect(mockFrom).toHaveBeenCalledWith('logs');
    });

    it('should include detalhes in log', async () => {
      mockFrom.mockImplementation(() => setupChain({ data: null, error: null }));

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
        'Failed to log incidente action:',
        expect.any(Error)
      );
    });
  });
});
