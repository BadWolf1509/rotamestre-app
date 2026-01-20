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

import { useMotoristaStreak } from '../useMotoristaStreak';

// Helper to setup supabase chain
const setupSupabaseChain = (finalResult: any) => {
  const chain: any = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    gte: jest.fn(() => chain),
    order: jest.fn(() => chain),
    then: (resolve: any) => Promise.resolve(finalResult).then(resolve),
  };
  return chain;
};

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
      mockFrom.mockImplementation(() =>
        setupSupabaseChain({ data: [], error: null })
      );

      const { result } = renderHook(() => useMotoristaStreak('motorista-123'));

      await act(async () => {
        await result.current.loadStreak();
      });

      expect(result.current.streak).toBe(0);
    });

    it('should calculate streak of 1 day', async () => {
      // Route completed today (June 15)
      const mockRotas = [
        { concluida_em: '2024-06-15T10:00:00Z' },
      ];

      mockFrom.mockImplementation(() =>
        setupSupabaseChain({ data: mockRotas, error: null })
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
        setupSupabaseChain({ data: mockRotas, error: null })
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
        setupSupabaseChain({ data: mockRotas, error: null })
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
        setupSupabaseChain({ data: mockRotas, error: null })
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
        setupSupabaseChain({ data: mockRotas, error: null })
      );

      const { result } = renderHook(() => useMotoristaStreak('motorista-123'));

      await act(async () => {
        await result.current.loadStreak();
      });

      expect(result.current.streak).toBe(0);
    });

    it('should handle database error', async () => {
      mockFrom.mockImplementation(() =>
        setupSupabaseChain({ data: null, error: { message: 'Error' } })
      );

      const { result } = renderHook(() => useMotoristaStreak('motorista-123'));

      await act(async () => {
        await result.current.loadStreak();
      });

      expect(result.current.streak).toBe(0);
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
