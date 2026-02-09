/**
 * Tests for rotas queries
 */

// Mock cache
jest.mock('@/lib/cache', () => ({
  getCache: jest.fn(),
  setCache: jest.fn(),
  CACHE_TTL: {
    ROUTES_LIST: 300000,
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

// Mock supabase
const mockFrom = jest.fn();

// Setup chainable mock
const setupChain = (finalResult: any) => {
  const chain: any = {
    select: jest.fn(() => chain),
    insert: jest.fn(() => chain),
    update: jest.fn(() => chain),
    delete: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    in: jest.fn(() => chain),
    gte: jest.fn(() => chain),
    lte: jest.fn(() => chain),
    order: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    abortSignal: jest.fn(() => chain),
    returns: jest.fn(() => chain),
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
    buildCacheKey: (prefix: string, id: string) => `${prefix}:${id}`,
  };
});

import { getCache, setCache } from '@/lib/cache';
import { logger } from '@/lib/logger';

import {
  fetchRotasWithStats,
  fetchRotaDetalhada,
  fetchRotasAtivasMotorista,
  fetchRotaWithCache,
  createRota,
  updateRotaStatus,
  updateRota,
  deleteRota,
  assignMotoristaToRota,
  fetchRotasKPIs,
  logRotaAction,
} from '../rotas';

describe('rotas queries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchRotasWithStats', () => {
    it('should fetch rotas with paradas stats', async () => {
      const mockRotas = [
        {
          id: 'rota-1',
          status: 'pendente',
          data: '2024-01-15',
          titulo: 'Rota 1',
          distancia_total: 10000,
          duracao_total_minutos: 30,
          motorista_id: 'motorista-1',
          criado_em: '2024-01-15T10:00:00Z',
          concluida_em: null,
          motorista: { nome: 'João' },
        },
      ];

      const mockParadas = [
        { rota_id: 'rota-1', status: 'pendente', is_checkpoint: true },
        { rota_id: 'rota-1', status: 'concluida', is_checkpoint: true },
        { rota_id: 'rota-1', status: 'pendente', is_checkpoint: false }, // Should be skipped
      ];

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Rotas query
          return setupChain({ data: mockRotas, error: null });
        }
        // Paradas query
        return setupChain({ data: mockParadas, error: null });
      });

      const result = await fetchRotasWithStats({
        unidadeId: 'unidade-1',
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].motorista_nome).toBe('João');
      expect(result.data![0].paradas_total).toBe(2); // Only checkpoints
      expect(result.data![0].paradas_concluidas).toBe(1);
    });

    it('should apply status filter as array', async () => {
      const chain = setupChain({ data: [], error: null });
      mockFrom.mockImplementation(() => chain);

      await fetchRotasWithStats({
        unidadeId: 'unidade-1',
        status: ['pendente', 'em_andamento'],
      });

      expect(chain.in).toHaveBeenCalled();
    });

    it('should apply status filter as string', async () => {
      const chain = setupChain({ data: [], error: null });
      mockFrom.mockImplementation(() => chain);

      await fetchRotasWithStats({
        unidadeId: 'unidade-1',
        status: 'pendente',
      });

      expect(chain.eq).toHaveBeenCalled();
    });

    it('should apply motorista filter', async () => {
      const chain = setupChain({ data: [], error: null });
      mockFrom.mockImplementation(() => chain);

      await fetchRotasWithStats({
        unidadeId: 'unidade-1',
        motoristaId: 'motorista-1',
      });

      expect(chain.eq).toHaveBeenCalled();
    });

    it('should apply date filters', async () => {
      const chain = setupChain({ data: [], error: null });
      mockFrom.mockImplementation(() => chain);

      await fetchRotasWithStats({
        unidadeId: 'unidade-1',
        dataInicio: '2024-01-01',
        dataFim: '2024-01-31',
      });

      expect(chain.gte).toHaveBeenCalled();
      expect(chain.lte).toHaveBeenCalled();
    });

    it('should handle null motorista', async () => {
      const mockRotas = [
        {
          id: 'rota-1',
          status: 'pendente',
          data: '2024-01-15',
          titulo: null,
          distancia_total: null,
          duracao_total_minutos: null,
          motorista_id: null,
          criado_em: '2024-01-15T10:00:00Z',
          concluida_em: null,
          motorista: null,
        },
      ];

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return setupChain({ data: mockRotas, error: null });
        return setupChain({ data: [], error: null });
      });

      const result = await fetchRotasWithStats({ unidadeId: 'unidade-1' });

      expect(result.success).toBe(true);
      expect(result.data![0].motorista_nome).toBeNull();
    });
  });

  describe('fetchRotaDetalhada', () => {
    it('should fetch rota with relations and paradas', async () => {
      const mockRota = {
        id: 'rota-1',
        unidade_id: 'unidade-1',
        motorista_id: 'motorista-1',
        status: 'em_andamento',
        motorista: { id: 'motorista-1', nome: 'João', avatar_url: null, telefone: '11999999999' },
        unidade: { id: 'unidade-1', nome: 'Unidade Central', cidade: 'São Paulo' },
      };

      const mockParadas = [
        { id: 'parada-1', rota_id: 'rota-1', ordem: 1 },
        { id: 'parada-2', rota_id: 'rota-1', ordem: 2 },
      ];

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Rota query
          const chain = setupChain({ data: mockRota, error: null });
          return chain;
        }
        // Paradas query
        return setupChain({ data: mockParadas, error: null });
      });

      const result = await fetchRotaDetalhada('rota-1');

      expect(result.success).toBe(true);
      expect(result.data!.paradas).toHaveLength(2);
    });
  });

  describe('fetchRotasAtivasMotorista', () => {
    it('should fetch active rotas for motorista', async () => {
      const mockRotas = [
        { id: 'rota-1', status: 'pendente', motorista_id: 'motorista-1' },
        { id: 'rota-2', status: 'em_andamento', motorista_id: 'motorista-1' },
      ];

      mockFrom.mockImplementation(() => setupChain({ data: mockRotas, error: null }));

      const result = await fetchRotasAtivasMotorista('motorista-1');

      expect(result.success).toBe(true);
      expect(mockFrom).toHaveBeenCalledWith('rotas');
    });
  });

  describe('fetchRotaWithCache', () => {
    it('should return cached data when available', async () => {
      const cachedRota = {
        id: 'rota-1',
        status: 'pendente',
      };

      (getCache as jest.Mock).mockResolvedValue(cachedRota);

      const result = await fetchRotaWithCache('rota-1');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(cachedRota);
      expect(getCache).toHaveBeenCalledWith('rota:rota-1');
    });

    it('should fetch fresh data when cache miss', async () => {
      (getCache as jest.Mock).mockResolvedValue(null);

      const mockRota = { id: 'rota-1', status: 'pendente' };
      const mockParadas: any[] = [];

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return setupChain({ data: mockRota, error: null });
        return setupChain({ data: mockParadas, error: null });
      });

      const result = await fetchRotaWithCache('rota-1');

      expect(result.success).toBe(true);
      expect(setCache).toHaveBeenCalled();
    });

    it('should force refresh when option is set', async () => {
      const cachedRota = { id: 'rota-1', status: 'pendente' };
      (getCache as jest.Mock).mockResolvedValue(cachedRota);

      const mockRota = { id: 'rota-1', status: 'em_andamento' };

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return setupChain({ data: mockRota, error: null });
        return setupChain({ data: [], error: null });
      });

      const result = await fetchRotaWithCache('rota-1', { forceRefresh: true });

      expect(result.success).toBe(true);
      // Should not use cache when forceRefresh is true
      expect(mockFrom).toHaveBeenCalled();
    });
  });

  describe('createRota', () => {
    it('should create a new rota', async () => {
      const mockRota = {
        id: 'rota-new',
        unidade_id: 'unidade-1',
        status: 'pendente',
      };

      mockFrom.mockImplementation(() => setupChain({ data: mockRota, error: null }));

      const result = await createRota({
        unidade_id: 'unidade-1',
      });

      expect(result.success).toBe(true);
      expect(mockFrom).toHaveBeenCalledWith('rotas');
    });

    it('should handle creation error', async () => {
      mockFrom.mockImplementation(() => {
        const chain = setupChain({ data: null, error: { message: 'Insert failed' } });
        chain.single = jest.fn(() => Promise.reject(new Error('Insert failed')));
        return chain;
      });

      const result = await createRota({ unidade_id: 'unidade-1' });

      expect(result.success).toBe(false);
    });
  });

  describe('updateRotaStatus', () => {
    it('should update status to em_andamento and set iniciada_em', async () => {
      const mockRota = {
        id: 'rota-1',
        status: 'em_andamento',
        iniciada_em: '2024-01-15T10:00:00Z',
      };

      mockFrom.mockImplementation(() => setupChain({ data: mockRota, error: null }));

      const result = await updateRotaStatus('rota-1', 'em_andamento');

      expect(result.success).toBe(true);
      expect(mockFrom).toHaveBeenCalledWith('rotas');
    });

    it('should update status to concluida and set concluida_em', async () => {
      const mockRota = {
        id: 'rota-1',
        status: 'concluida',
        concluida_em: '2024-01-15T18:00:00Z',
      };

      mockFrom.mockImplementation(() => setupChain({ data: mockRota, error: null }));

      const result = await updateRotaStatus('rota-1', 'concluida');

      expect(result.success).toBe(true);
    });

    it('should include additional fields', async () => {
      mockFrom.mockImplementation(() => setupChain({ data: { id: 'rota-1' }, error: null }));

      await updateRotaStatus('rota-1', 'cancelada', { observacoes: 'Cancelled by user' });

      expect(mockFrom).toHaveBeenCalledWith('rotas');
    });
  });

  describe('updateRota', () => {
    it('should update rota fields', async () => {
      const mockRota = {
        id: 'rota-1',
        titulo: 'Updated Title',
      };

      mockFrom.mockImplementation(() => setupChain({ data: mockRota, error: null }));

      const result = await updateRota('rota-1', { titulo: 'Updated Title' });

      expect(result.success).toBe(true);
      expect(mockFrom).toHaveBeenCalledWith('rotas');
    });
  });

  describe('deleteRota', () => {
    it('should delete rota', async () => {
      mockFrom.mockImplementation(() => setupChain({ error: null }));

      const result = await deleteRota('rota-1');

      expect(result.success).toBe(true);
      expect(mockFrom).toHaveBeenCalledWith('rotas');
    });

    it('should handle delete error', async () => {
      // Create a chain that returns an error
      const errorChain: any = {
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: { message: 'Delete failed' } }),
      };
      mockFrom.mockImplementation(() => errorChain);

      const result = await deleteRota('rota-1');

      expect(result.success).toBe(false);
    });
  });

  describe('assignMotoristaToRota', () => {
    it('should assign motorista to rota', async () => {
      mockFrom.mockImplementation(() => setupChain({ data: { id: 'rota-1' }, error: null }));

      const result = await assignMotoristaToRota('rota-1', 'motorista-1');

      expect(result.success).toBe(true);
      expect(mockFrom).toHaveBeenCalledWith('rotas');
    });

    it('should unassign motorista from rota', async () => {
      mockFrom.mockImplementation(() => setupChain({ data: { id: 'rota-1' }, error: null }));

      const result = await assignMotoristaToRota('rota-1', null);

      expect(result.success).toBe(true);
    });
  });

  describe('fetchRotasKPIs', () => {
    it('should calculate KPIs correctly', async () => {
      const mockData = [
        { id: 'rota-1', status: 'pendente' },
        { id: 'rota-2', status: 'pendente' },
        { id: 'rota-3', status: 'em_andamento' },
        { id: 'rota-4', status: 'concluida' },
        { id: 'rota-5', status: 'concluida' },
        { id: 'rota-6', status: 'concluida' },
        { id: 'rota-7', status: 'cancelada' },
      ];

      mockFrom.mockImplementation(() => setupChain({ data: mockData, error: null }));

      const result = await fetchRotasKPIs('unidade-1', {
        inicio: '2024-01-01',
        fim: '2024-01-31',
      });

      expect(result.success).toBe(true);
      expect(result.data!.total).toBe(7);
      expect(result.data!.pendentes).toBe(2);
      expect(result.data!.emAndamento).toBe(1);
      expect(result.data!.concluidas).toBe(3);
      expect(result.data!.canceladas).toBe(1);
    });

    it('should handle empty result', async () => {
      mockFrom.mockImplementation(() => setupChain({ data: [], error: null }));

      const result = await fetchRotasKPIs('unidade-1', {
        inicio: '2024-01-01',
        fim: '2024-01-31',
      });

      expect(result.success).toBe(true);
      expect(result.data!.total).toBe(0);
    });
  });

  describe('logRotaAction', () => {
    it('should log rota action', async () => {
      mockFrom.mockImplementation(() => setupChain({ data: null, error: null }));

      await logRotaAction('user-123', 'rota-1', 'rota_criada');

      expect(mockFrom).toHaveBeenCalledWith('logs');
    });

    it('should include detalhes in log', async () => {
      mockFrom.mockImplementation(() => setupChain({ data: null, error: null }));

      await logRotaAction('user-123', 'rota-1', 'rota_atribuida', {
        motorista_id: 'motorista-1',
      });

      expect(mockFrom).toHaveBeenCalledWith('logs');
    });

    it('should handle log error gracefully', async () => {
      mockFrom.mockImplementation(() => {
        throw new Error('Log failed');
      });

      // Should not throw
      await logRotaAction('user-123', 'rota-1', 'test_event');

      expect(logger.warn).toHaveBeenCalledWith('Failed to log rota action:', expect.any(Error));
    });
  });
});
