/**
 * Tests for useLastRoute hook
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';

// Mock supabase
const mockFrom = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => mockFrom(table),
  },
}));

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

import { useLastRoute } from '../useLastRoute';

// Helper to setup supabase chain
const setupSupabaseChain = (finalResult: any) => {
  const chain: any = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    gte: jest.fn(() => chain),
    order: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    maybeSingle: jest.fn(() => Promise.resolve(finalResult)),
    then: (resolve: any) => Promise.resolve(finalResult).then(resolve),
  };
  return chain;
};

describe('useLastRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with null lastRoute', () => {
      const { result } = renderHook(() => useLastRoute('motorista-123'));

      expect(result.current.lastRoute).toBeNull();
    });

    it('should provide loadLastRoute function', () => {
      const { result } = renderHook(() => useLastRoute('motorista-123'));

      expect(typeof result.current.loadLastRoute).toBe('function');
    });
  });

  describe('loadLastRoute', () => {
    it('should return early if no motoristaId', async () => {
      const { result } = renderHook(() => useLastRoute(undefined));

      await act(async () => {
        await result.current.loadLastRoute();
      });

      expect(mockFrom).not.toHaveBeenCalled();
      expect(result.current.lastRoute).toBeNull();
    });

    it('should set lastRoute to null if no completed route found', async () => {
      mockFrom.mockImplementation(() =>
        setupSupabaseChain({ data: null, error: null })
      );

      const { result } = renderHook(() => useLastRoute('motorista-123'));

      await act(async () => {
        await result.current.loadLastRoute();
      });

      expect(result.current.lastRoute).toBeNull();
    });

    it('should set lastRoute to null on rotas error', async () => {
      mockFrom.mockImplementation(() =>
        setupSupabaseChain({ data: null, error: { message: 'Error' } })
      );

      const { result } = renderHook(() => useLastRoute('motorista-123'));

      await act(async () => {
        await result.current.loadLastRoute();
      });

      expect(result.current.lastRoute).toBeNull();
    });

    it('should load last route with duration in hours and minutes', async () => {
      const now = new Date();
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 hours ago

      const mockRota = {
        id: 'rota-last',
        concluida_em: now.toISOString(),
        distancia_total: 25.5,
        tempo_total: 90,
        iniciada_em: twoHoursAgo.toISOString(),
      };

      const mockParadas = [
        { status: 'concluida', is_checkpoint: true },
        { status: 'concluida', is_checkpoint: true },
        { status: 'concluida', is_checkpoint: true },
      ];

      mockFrom.mockImplementation((table: string) => {
        if (table === 'rotas') {
          return setupSupabaseChain({ data: mockRota, error: null });
        }
        if (table === 'paradas') {
          const chain: any = {
            select: jest.fn(() => chain),
            eq: jest.fn(() => chain),
            then: (resolve: any) => Promise.resolve({ data: mockParadas, error: null }).then(resolve),
          };
          return chain;
        }
        return setupSupabaseChain({ data: [], error: null });
      });

      const { result } = renderHook(() => useLastRoute('motorista-123'));

      await act(async () => {
        await result.current.loadLastRoute();
      });

      await waitFor(() => {
        expect(result.current.lastRoute).not.toBeNull();
      });

      expect(result.current.lastRoute?.total_paradas).toBe(3);
      expect(result.current.lastRoute?.paradas_concluidas).toBe(3);
      expect(result.current.lastRoute?.distancia_km).toBe(26); // Math.round(25.5)
      expect(result.current.lastRoute?.tempo_total).toContain('h'); // Should have hours
    });

    it('should load last route with duration in minutes only', async () => {
      const now = new Date();
      const thirtyMinsAgo = new Date(now.getTime() - 30 * 60 * 1000); // 30 mins ago

      const mockRota = {
        id: 'rota-last',
        concluida_em: now.toISOString(),
        distancia_total: 10,
        tempo_total: 30,
        iniciada_em: thirtyMinsAgo.toISOString(),
      };

      const mockParadas = [
        { status: 'concluida', is_checkpoint: true },
        { status: 'pendente', is_checkpoint: true },
      ];

      mockFrom.mockImplementation((table: string) => {
        if (table === 'rotas') {
          return setupSupabaseChain({ data: mockRota, error: null });
        }
        if (table === 'paradas') {
          const chain: any = {
            select: jest.fn(() => chain),
            eq: jest.fn(() => chain),
            then: (resolve: any) => Promise.resolve({ data: mockParadas, error: null }).then(resolve),
          };
          return chain;
        }
        return setupSupabaseChain({ data: [], error: null });
      });

      const { result } = renderHook(() => useLastRoute('motorista-123'));

      await act(async () => {
        await result.current.loadLastRoute();
      });

      await waitFor(() => {
        expect(result.current.lastRoute).not.toBeNull();
      });

      expect(result.current.lastRoute?.tempo_total).toBe('30min');
      expect(result.current.lastRoute?.paradas_concluidas).toBe(1);
    });

    it('should show -- for duration if missing timestamps', async () => {
      const mockRota = {
        id: 'rota-last',
        concluida_em: new Date().toISOString(),
        distancia_total: 10,
        tempo_total: null,
        iniciada_em: null, // Missing
      };

      const mockParadas: any[] = [];

      mockFrom.mockImplementation((table: string) => {
        if (table === 'rotas') {
          return setupSupabaseChain({ data: mockRota, error: null });
        }
        if (table === 'paradas') {
          const chain: any = {
            select: jest.fn(() => chain),
            eq: jest.fn(() => chain),
            then: (resolve: any) => Promise.resolve({ data: mockParadas, error: null }).then(resolve),
          };
          return chain;
        }
        return setupSupabaseChain({ data: [], error: null });
      });

      const { result } = renderHook(() => useLastRoute('motorista-123'));

      await act(async () => {
        await result.current.loadLastRoute();
      });

      await waitFor(() => {
        expect(result.current.lastRoute).not.toBeNull();
      });

      expect(result.current.lastRoute?.tempo_total).toBe('--');
    });

    it('should set lastRoute to null on paradas error', async () => {
      const mockRota = {
        id: 'rota-last',
        concluida_em: new Date().toISOString(),
        distancia_total: 10,
        tempo_total: 30,
        iniciada_em: new Date().toISOString(),
      };

      mockFrom.mockImplementation((table: string) => {
        if (table === 'rotas') {
          return setupSupabaseChain({ data: mockRota, error: null });
        }
        if (table === 'paradas') {
          const chain: any = {
            select: jest.fn(() => chain),
            eq: jest.fn(() => chain),
            then: (resolve: any) => Promise.resolve({ data: null, error: { message: 'Error' } }).then(resolve),
          };
          return chain;
        }
        return setupSupabaseChain({ data: [], error: null });
      });

      const { result } = renderHook(() => useLastRoute('motorista-123'));

      await act(async () => {
        await result.current.loadLastRoute();
      });

      expect(result.current.lastRoute).toBeNull();
    });

    it('should handle exception during load', async () => {
      mockFrom.mockImplementation(() => {
        throw new Error('Network error');
      });

      const { result } = renderHook(() => useLastRoute('motorista-123'));

      await act(async () => {
        await result.current.loadLastRoute();
      });

      expect(result.current.lastRoute).toBeNull();
    });
  });
});
