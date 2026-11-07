/**
 * Tests for useMotoristaStreak hook
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

import { useMotoristaStreak } from '../useMotoristaStreak';

describe('useMotoristaStreak', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock the current date for predictable tests
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-06-15T12:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('initialization', () => {
    it('should initialize with streak = 0', () => {
      const { result } = renderHook(() => useMotoristaStreak('motorista-123'));

      expect(result.current.streak).toBe(0);
    });

    it('should provide loadStreak function', () => {
      const { result } = renderHook(() => useMotoristaStreak('motorista-123'));

      expect(typeof result.current.loadStreak).toBe('function');
    });
  });

  describe('loadStreak', () => {
    it('should return early if no motoristaId', async () => {
      const { result } = renderHook(() => useMotoristaStreak(undefined));

      await act(async () => {
        await result.current.loadStreak();
      });

      expect(mockFrom).not.toHaveBeenCalled();
      expect(result.current.streak).toBe(0);
    });

    it('should set streak to 0 if no completed routes', async () => {
      mockFrom.mockImplementation(() => criarCadeia({ data: [], error: null }));

      const { result } = renderHook(() => useMotoristaStreak('motorista-123'));

      await act(async () => {
        await result.current.loadStreak();
      });

      expect(result.current.streak).toBe(0);
    });

    it('should calculate streak of 1 day', async () => {
      // Route completed today (June 15)
      const mockRotas = [{ concluida_em: '2024-06-15T10:00:00Z' }];

      mockFrom.mockImplementation(() =>
        criarCadeia({ data: mockRotas, error: null }),
      );

      const { result } = renderHook(() => useMotoristaStreak('motorista-123'));

      await act(async () => {
        await result.current.loadStreak();
      });

      await waitFor(() => {
        expect(result.current.streak).toBe(1);
      });
    });

    it('should calculate streak of multiple consecutive days', async () => {
      // Routes completed for 3 consecutive days (June 13, 14, 15)
      const mockRotas = [
        { concluida_em: '2024-06-15T10:00:00Z' },
        { concluida_em: '2024-06-14T10:00:00Z' },
        { concluida_em: '2024-06-13T10:00:00Z' },
      ];

      mockFrom.mockImplementation(() =>
        criarCadeia({ data: mockRotas, error: null }),
      );

      const { result } = renderHook(() => useMotoristaStreak('motorista-123'));

      await act(async () => {
        await result.current.loadStreak();
      });

      await waitFor(() => {
        expect(result.current.streak).toBe(3);
      });
    });

    it('should stop counting streak when gap found', async () => {
      // Routes on June 15, 14, 12 (gap on June 13)
      const mockRotas = [
        { concluida_em: '2024-06-15T10:00:00Z' },
        { concluida_em: '2024-06-14T10:00:00Z' },
        { concluida_em: '2024-06-12T10:00:00Z' }, // Gap on June 13
      ];

      mockFrom.mockImplementation(() =>
        criarCadeia({ data: mockRotas, error: null }),
      );

      const { result } = renderHook(() => useMotoristaStreak('motorista-123'));

      await act(async () => {
        await result.current.loadStreak();
      });

      await waitFor(() => {
        expect(result.current.streak).toBe(2); // Only June 15 and 14
      });
    });

    it('should count streak with multiple routes on same day', async () => {
      // Multiple routes on same days
      const mockRotas = [
        { concluida_em: '2024-06-15T15:00:00Z' },
        { concluida_em: '2024-06-15T10:00:00Z' }, // Same day
        { concluida_em: '2024-06-14T12:00:00Z' },
        { concluida_em: '2024-06-14T09:00:00Z' }, // Same day
      ];

      mockFrom.mockImplementation(() =>
        criarCadeia({ data: mockRotas, error: null }),
      );

      const { result } = renderHook(() => useMotoristaStreak('motorista-123'));

      await act(async () => {
        await result.current.loadStreak();
      });

      await waitFor(() => {
        expect(result.current.streak).toBe(2); // 2 consecutive days
      });
    });

    it('should return 0 if no route today', async () => {
      // Routes only on June 14 (not today June 15)
      const mockRotas = [
        { concluida_em: '2024-06-14T10:00:00Z' },
        { concluida_em: '2024-06-13T10:00:00Z' },
      ];

      mockFrom.mockImplementation(() =>
        criarCadeia({ data: mockRotas, error: null }),
      );

      const { result } = renderHook(() => useMotoristaStreak('motorista-123'));

      await act(async () => {
        await result.current.loadStreak();
      });

      expect(result.current.streak).toBe(0);
    });

    it('should handle database error', async () => {
      mockFrom.mockImplementation(() =>
        criarCadeia({ data: null, error: { message: 'Error' } }),
      );

      const { result } = renderHook(() => useMotoristaStreak('motorista-123'));

      await act(async () => {
        await result.current.loadStreak();
      });

      expect(result.current.streak).toBe(0);
    });

    // M-7: a sequência não tem mais teto de 30 dias. Banco falso que aplica o
    // recorte (gte/lt) de verdade, para provar que a consulta pede as janelas.
    function bancoComRotas(linhas: { concluida_em: string }[]) {
      mockFrom.mockImplementation(() => {
        const filtros: ((l: { concluida_em: string }) => boolean)[] = [];
        const api = {
          select: () => api,
          eq: () => api,
          gte: (_c: string, v: string) => {
            filtros.push((l) => l.concluida_em >= v);
            return api;
          },
          lt: (_c: string, v: string) => {
            filtros.push((l) => l.concluida_em < v);
            return api;
          },
          order: () => api,
          then: (resolve: (r: unknown) => unknown) =>
            Promise.resolve({
              data: linhas.filter((l) => filtros.every((f) => f(l))),
              error: null,
            }).then(resolve),
        };
        return api;
      });
    }

    function diasSeguidos(n: number) {
      return Array.from({ length: n }, (_, i) => ({
        concluida_em: new Date(
          Date.parse('2024-06-15T15:00:00Z') - i * 86_400_000,
        ).toISOString(),
      }));
    }

    it('sequência de 45 dias passa dos 30 (M-7)', async () => {
      bancoComRotas(diasSeguidos(45));
      const { result } = renderHook(() => useMotoristaStreak('motorista-123'));
      await act(async () => {
        await result.current.loadStreak();
      });
      expect(result.current.streak).toBe(45);
    });

    it('sequência de 45 dias com falha no 46º conta exatamente 45 (M-7)', async () => {
      const dias = diasSeguidos(50).filter((_, i) => i !== 45);
      bancoComRotas(dias);
      const { result } = renderHook(() => useMotoristaStreak('motorista-123'));
      await act(async () => {
        await result.current.loadStreak();
      });
      expect(result.current.streak).toBe(45);
    });

    it('sequência curta continua em UMA consulta (sem custo novo) (M-7)', async () => {
      bancoComRotas(diasSeguidos(3));
      const { result } = renderHook(() => useMotoristaStreak('motorista-123'));
      await act(async () => {
        await result.current.loadStreak();
      });
      expect(result.current.streak).toBe(3);
      expect(mockFrom).toHaveBeenCalledTimes(1);
    });

    it('resposta velha chegando por último não sobrescreve a nova (M-7)', async () => {
      let soltarVelha: (v: unknown) => void = () => {};
      const velha = new Promise((resolve) => {
        soltarVelha = resolve;
      });
      const cadeiaVelha = criarCadeia({ data: [], error: null });
      cadeiaVelha.then = ((aoResolver: (v: unknown) => unknown) =>
        velha.then(aoResolver)) as typeof cadeiaVelha.then;
      mockFrom.mockReturnValueOnce(cadeiaVelha);
      mockFrom.mockImplementation(() =>
        criarCadeia({
          data: [{ concluida_em: '2024-06-15T10:00:00Z' }],
          error: null,
        }),
      );

      const { result } = renderHook(() => useMotoristaStreak('motorista-123'));
      let primeira: Promise<void> = Promise.resolve();
      act(() => {
        primeira = result.current.loadStreak();
      });
      await act(async () => {
        await result.current.loadStreak();
      });
      expect(result.current.streak).toBe(1);

      await act(async () => {
        soltarVelha({ data: [], error: null });
        await primeira;
      });
      expect(result.current.streak).toBe(1);
    });

    it('should handle exception', async () => {
      mockFrom.mockImplementation(() => {
        throw new Error('Network error');
      });

      const { result } = renderHook(() => useMotoristaStreak('motorista-123'));

      await act(async () => {
        await result.current.loadStreak();
      });

      expect(result.current.streak).toBe(0);
    });
  });
});
