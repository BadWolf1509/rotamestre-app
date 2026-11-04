/**
 * Tests for useMotoristaStats hook
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

import { criarCadeia } from '@/__tests__/helpers/cadeiaSupabase';

import { useMotoristaStats } from '../useMotoristaStats';

describe('useMotoristaStats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with default stats', () => {
      const { result } = renderHook(() => useMotoristaStats('motorista-123'));

      expect(result.current.stats).toEqual({
        rotasOntem: 0,
        paradasOntem: 0,
        distanciaOntem: 0,
        rotasHoje: 0,
        paradasHoje: 0,
        distanciaHoje: 0,
      });
    });

    it('should provide loadYesterdayStats and loadTodayStats functions', () => {
      const { result } = renderHook(() => useMotoristaStats('motorista-123'));

      expect(typeof result.current.loadYesterdayStats).toBe('function');
      expect(typeof result.current.loadTodayStats).toBe('function');
    });
  });

  describe('loadYesterdayStats', () => {
    it('should return early if no motoristaId', async () => {
      const { result } = renderHook(() => useMotoristaStats(undefined));

      await act(async () => {
        await result.current.loadYesterdayStats();
      });

      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('should set zero stats if no routes yesterday', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'rotas') {
          return criarCadeia({ data: [], error: null });
        }
        return criarCadeia({ data: [], error: null });
      });

      const { result } = renderHook(() => useMotoristaStats('motorista-123'));

      await act(async () => {
        await result.current.loadYesterdayStats();
      });

      expect(result.current.stats.rotasOntem).toBe(0);
      expect(result.current.stats.paradasOntem).toBe(0);
      expect(result.current.stats.distanciaOntem).toBe(0);
    });

    it('should load yesterday stats with routes and paradas', async () => {
      const mockRotas = [
        { id: 'rota-1', distancia_total: 25 },
        { id: 'rota-2', distancia_total: 35 },
      ];

      const mockParadas = [
        { id: 'parada-1' },
        { id: 'parada-2' },
        { id: 'parada-3' },
        { id: 'parada-4' },
        { id: 'parada-5' },
      ];

      mockFrom.mockImplementation((table: string) => {
        if (table === 'rotas') {
          return criarCadeia({ data: mockRotas, error: null });
        }
        if (table === 'paradas') {
          return criarCadeia({ data: mockParadas, error: null });
        }
        return criarCadeia({ data: [], error: null });
      });

      const { result } = renderHook(() => useMotoristaStats('motorista-123'));

      await act(async () => {
        await result.current.loadYesterdayStats();
      });

      await waitFor(() => {
        expect(result.current.stats.rotasOntem).toBe(2);
      });

      expect(result.current.stats.paradasOntem).toBe(5);
      expect(result.current.stats.distanciaOntem).toBe(60); // 25 + 35
    });

    it('should handle rotas error', async () => {
      mockFrom.mockImplementation(() =>
        criarCadeia({ data: null, error: { message: 'Error' } }),
      );

      const { result } = renderHook(() => useMotoristaStats('motorista-123'));

      await act(async () => {
        await result.current.loadYesterdayStats();
      });

      // Stats should remain at default
      expect(result.current.stats.rotasOntem).toBe(0);
    });

    it('should handle paradas error gracefully', async () => {
      const mockRotas = [{ id: 'rota-1', distancia_total: 25 }];

      mockFrom.mockImplementation((table: string) => {
        if (table === 'rotas') {
          return criarCadeia({ data: mockRotas, error: null });
        }
        if (table === 'paradas') {
          return criarCadeia({ data: null, error: { message: 'Error' } });
        }
        return criarCadeia({ data: [], error: null });
      });

      const { result } = renderHook(() => useMotoristaStats('motorista-123'));

      await act(async () => {
        await result.current.loadYesterdayStats();
      });

      // Should not update stats on paradas error
      expect(result.current.stats.rotasOntem).toBe(0);
    });
  });

  describe('loadTodayStats', () => {
    it('should return early if no motoristaId', async () => {
      const { result } = renderHook(() => useMotoristaStats(undefined));

      await act(async () => {
        await result.current.loadTodayStats();
      });

      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('should set zero stats if no routes today', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'rotas') {
          return criarCadeia({ data: [], error: null });
        }
        return criarCadeia({ data: [], error: null });
      });

      const { result } = renderHook(() => useMotoristaStats('motorista-123'));

      await act(async () => {
        await result.current.loadTodayStats();
      });

      expect(result.current.stats.rotasHoje).toBe(0);
      expect(result.current.stats.paradasHoje).toBe(0);
      expect(result.current.stats.distanciaHoje).toBe(0);
    });

    it('should load today stats with routes and paradas', async () => {
      const mockRotas = [
        { id: 'rota-1', distancia_total: 15 },
        { id: 'rota-2', distancia_total: 20 },
        { id: 'rota-3', distancia_total: 10 },
      ];

      const mockParadas = [
        { id: 'parada-1' },
        { id: 'parada-2' },
        { id: 'parada-3' },
      ];

      mockFrom.mockImplementation((table: string) => {
        if (table === 'rotas') {
          return criarCadeia({ data: mockRotas, error: null });
        }
        if (table === 'paradas') {
          return criarCadeia({ data: mockParadas, error: null });
        }
        return criarCadeia({ data: [], error: null });
      });

      const { result } = renderHook(() => useMotoristaStats('motorista-123'));

      await act(async () => {
        await result.current.loadTodayStats();
      });

      await waitFor(() => {
        expect(result.current.stats.rotasHoje).toBe(3);
      });

      expect(result.current.stats.paradasHoje).toBe(3);
      expect(result.current.stats.distanciaHoje).toBe(45); // 15 + 20 + 10
    });

    it('should handle rotas error', async () => {
      mockFrom.mockImplementation(() =>
        criarCadeia({ data: null, error: { message: 'Error' } }),
      );

      const { result } = renderHook(() => useMotoristaStats('motorista-123'));

      await act(async () => {
        await result.current.loadTodayStats();
      });

      // Stats should remain at default
      expect(result.current.stats.rotasHoje).toBe(0);
    });

    it('should handle routes with null distancia_total', async () => {
      const mockRotas = [
        { id: 'rota-1', distancia_total: null },
        { id: 'rota-2', distancia_total: 20 },
      ];

      mockFrom.mockImplementation((table: string) => {
        if (table === 'rotas') {
          return criarCadeia({ data: mockRotas, error: null });
        }
        if (table === 'paradas') {
          return criarCadeia({ data: [], error: null });
        }
        return criarCadeia({ data: [], error: null });
      });

      const { result } = renderHook(() => useMotoristaStats('motorista-123'));

      await act(async () => {
        await result.current.loadTodayStats();
      });

      await waitFor(() => {
        expect(result.current.stats.rotasHoje).toBe(2);
      });

      expect(result.current.stats.distanciaHoje).toBe(20); // 0 + 20
    });
  });
});
