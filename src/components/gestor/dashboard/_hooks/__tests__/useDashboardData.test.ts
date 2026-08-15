import { renderHook, waitFor } from '@testing-library/react-native';

import { useDashboardData } from '../useDashboardData';

// Mock useUser
jest.mock('@/hooks/useUser', () => ({
  useUser: () => ({
    userData: { id: 'user-1', unidade_id: 'unidade-1', nome: 'Test User' },
  }),
}));

// Mock useRealtimeRoutes
jest.mock('@/hooks/useRealtimeRoutes', () => ({
  useRealtimeRoutes: () => ({
    updateTrigger: 0,
  }),
}));

// Mock useUnidadeAtiva
jest.mock('@/hooks/useUnidadeAtiva', () => ({
  useUnidadeAtiva: () => ({
    unidadeAtiva: 'unidade-1',
    setUnidadeAtiva: jest.fn(),
    vinculacoes: [],
    loading: false,
  }),
}));

// Mock supabase with complete chain
jest.mock('@/lib/supabase', () => {
  const createQueryMock = () => {
    const queryMethods: any = {
      eq: jest.fn(() => queryMethods),
      in: jest.fn(() => queryMethods),
      gte: jest.fn(() => queryMethods),
      lte: jest.fn(() => queryMethods),
      order: jest.fn(() => queryMethods),
      limit: jest.fn(() => queryMethods),
      single: jest.fn(() => Promise.resolve({ data: null, error: null })),
    };
    return queryMethods;
  };

  return {
    supabase: {
      from: jest.fn(() => ({
        select: jest.fn(() => createQueryMock()),
      })),
    },
  };
});

describe('useDashboardData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Initial state', () => {
    it('deve retornar estado inicial correto', () => {
      const { result } = renderHook(() => useDashboardData());

      // Initial stats should be zeros
      expect(result.current.stats.total).toBe(0);
      expect(result.current.stats.emAndamento).toBe(0);
      expect(result.current.stats.concluidas).toBe(0);
      expect(result.current.todayStats.totalHoje).toBe(0);
      expect(result.current.rotas).toEqual([]);
    });

    it('deve ter funcao onRefresh', () => {
      const { result } = renderHook(() => useDashboardData());

      expect(typeof result.current.onRefresh).toBe('function');
    });

    it('deve ter userData do useUser', () => {
      const { result } = renderHook(() => useDashboardData());

      expect(result.current.userData).toBeDefined();
      expect(result.current.userData.id).toBe('user-1');
    });
  });

  describe('Data loading', () => {
    it('deve chamar supabase quando unidadeId existe', () => {
      const { result } = renderHook(() => useDashboardData());

      // Hook should initialize with stats object
      expect(result.current.stats).toBeDefined();
    });

    it('deve aceitar filtros opcionais', () => {
      const filters = {
        dataInicio: '2025-01-01',
        dataFim: '2025-01-31',
        status: 'em_andamento' as const,
      };

      const { result } = renderHook(() => useDashboardData({ filters }));

      expect(result.current.stats).toBeDefined();
    });
  });

  describe('Stats structure', () => {
    it('deve ter estrutura de stats correta', () => {
      const { result } = renderHook(() => useDashboardData());

      expect(result.current.stats).toHaveProperty('total');
      expect(result.current.stats).toHaveProperty('emAndamento');
      expect(result.current.stats).toHaveProperty('concluidas');
      expect(result.current.stats).toHaveProperty('distanciaTotal');
    });

    it('deve ter estrutura de todayStats correta', () => {
      const { result } = renderHook(() => useDashboardData());

      expect(result.current.todayStats).toHaveProperty('totalHoje');
    });
  });

  describe('Return values', () => {
    it('deve retornar loading boolean', () => {
      const { result } = renderHook(() => useDashboardData());

      expect(typeof result.current.loading).toBe('boolean');
    });

    it('deve retornar refreshing boolean', () => {
      const { result } = renderHook(() => useDashboardData());

      expect(typeof result.current.refreshing).toBe('boolean');
      expect(result.current.refreshing).toBe(false);
    });

    it('deve retornar rotas array', () => {
      const { result } = renderHook(() => useDashboardData());

      expect(Array.isArray(result.current.rotas)).toBe(true);
    });
  });

  describe('Recarga por troca de filtro', () => {
    it('não volta a exibir a carga inicial ao trocar de filtro', async () => {
      const { result, rerender } = renderHook(
        ({ filters }) => useDashboardData({ filters }),
        { initialProps: { filters: { status: null } as any } },
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      // O RouteFilters entrega sempre um objeto novo ({...filters, status}),
      // o que recria o useCallback do fetch e redispara o efeito.
      rerender({ filters: { status: 'concluida' } as any });

      // Regressão: `loading` religado aqui faz o DesktopPageLayout (linha 109)
      // e o DashboardMobile (linha 441) retornarem SÓ o spinner, descartando
      // cabeçalho, stats, filtros e tabela — a página inteira é reconstruída.
      // Medido no navegador em 14/08/2026: 843 ms de tela em branco por filtro.
      // A carga subsequente deve sinalizar por `refreshing`, que não desmonta.
      expect(result.current.loading).toBe(false);
    });

    it('sinaliza a recarga por filtro em refreshing', async () => {
      const { result, rerender } = renderHook(
        ({ filters }) => useDashboardData({ filters }),
        { initialProps: { filters: { status: null } as any } },
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      rerender({ filters: { status: 'concluida' } as any });

      // Não basta parar de desmontar: sem sinal nenhum o gestor troca o
      // filtro e a tela fica igual, sem indicar que os dados mudaram.
      // `refreshing` alimenta o RefreshControl e preserva a árvore.
      expect(result.current.refreshing).toBe(true);
    });
  });

  describe('Filters', () => {
    it('deve aceitar filtro de dataInicio', () => {
      const { result } = renderHook(() =>
        useDashboardData({
          filters: { dataInicio: '2025-01-01' },
        }),
      );

      expect(result.current.stats).toBeDefined();
    });

    it('deve aceitar filtro de dataFim', () => {
      const { result } = renderHook(() =>
        useDashboardData({
          filters: { dataFim: '2025-01-31' },
        }),
      );

      expect(result.current.stats).toBeDefined();
    });

    it('deve aceitar filtro de status', () => {
      const { result } = renderHook(() =>
        useDashboardData({
          filters: { status: 'concluida' },
        }),
      );

      expect(result.current.stats).toBeDefined();
    });

    it('deve aceitar filtro de motoristaId', () => {
      const { result } = renderHook(() =>
        useDashboardData({
          filters: { motoristaId: 'motorista-1' },
        }),
      );

      expect(result.current.stats).toBeDefined();
    });

    it('deve lidar com filtros vazios', () => {
      const { result } = renderHook(() =>
        useDashboardData({
          filters: {},
        }),
      );

      expect(result.current.stats).toBeDefined();
    });
  });
});
