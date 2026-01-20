/**
 * Tests for useMainCardData hook
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';

// Mock the sub-hooks
const mockLoadYesterdayStats = jest.fn();
const mockLoadTodayStats = jest.fn();
const mockLoadStreak = jest.fn();
const mockLoadLastRoute = jest.fn();
const mockLoadExpiredRoute = jest.fn();
const mockDismissExpiredRoute = jest.fn();

jest.mock('../useMotoristaStats', () => ({
  useMotoristaStats: jest.fn(() => ({
    stats: { entregas_ontem: 5, entregas_hoje: 3 },
    loadYesterdayStats: mockLoadYesterdayStats,
    loadTodayStats: mockLoadTodayStats,
  })),
}));

jest.mock('../useMotoristaStreak', () => ({
  useMotoristaStreak: jest.fn(() => ({
    streak: 7,
    loadStreak: mockLoadStreak,
  })),
}));

jest.mock('../useLastRoute', () => ({
  useLastRoute: jest.fn(() => ({
    lastRoute: { id: 'rota-1', data: '2024-01-14' },
    loadLastRoute: mockLoadLastRoute,
  })),
}));

jest.mock('../useExpiredRoute', () => ({
  useExpiredRoute: jest.fn(() => ({
    expiredRoute: null,
    expiredRouteDismissed: false,
    loadExpiredRoute: mockLoadExpiredRoute,
    dismissExpiredRoute: mockDismissExpiredRoute,
  })),
}));

import { useMainCardData } from '../useMainCardData';

describe('useMainCardData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadYesterdayStats.mockResolvedValue(undefined);
    mockLoadTodayStats.mockResolvedValue(undefined);
    mockLoadStreak.mockResolvedValue(undefined);
    mockLoadLastRoute.mockResolvedValue(undefined);
    mockLoadExpiredRoute.mockResolvedValue(undefined);
  });

  describe('initialization', () => {
    it('should return all composed data from sub-hooks', () => {
      const { result } = renderHook(() =>
        useMainCardData({
          motoristaId: 'motorista-123',
          state: 'pending',
        })
      );

      expect(result.current.stats).toEqual({
        entregas_ontem: 5,
        entregas_hoje: 3,
      });
      expect(result.current.streak).toBe(7);
      expect(result.current.lastRoute).toEqual({
        id: 'rota-1',
        data: '2024-01-14',
      });
      expect(result.current.expiredRoute).toBeNull();
      expect(result.current.expiredRouteDismissed).toBe(false);
    });

    it('should provide refresh function', () => {
      const { result } = renderHook(() =>
        useMainCardData({
          motoristaId: 'motorista-123',
          state: 'pending',
        })
      );

      expect(typeof result.current.refresh).toBe('function');
    });

    it('should provide dismissExpiredRoute function', () => {
      const { result } = renderHook(() =>
        useMainCardData({
          motoristaId: 'motorista-123',
          state: 'pending',
        })
      );

      expect(result.current.dismissExpiredRoute).toBe(mockDismissExpiredRoute);
    });

    it('should start with isLoading false', () => {
      const { result } = renderHook(() =>
        useMainCardData({
          motoristaId: 'motorista-123',
          state: 'pending',
        })
      );

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('refresh function', () => {
    it('should not call loaders when motoristaId is undefined', async () => {
      const { result } = renderHook(() =>
        useMainCardData({
          motoristaId: undefined,
          state: 'pending',
        })
      );

      await act(async () => {
        await result.current.refresh();
      });

      expect(mockLoadYesterdayStats).not.toHaveBeenCalled();
      expect(mockLoadTodayStats).not.toHaveBeenCalled();
      expect(mockLoadStreak).not.toHaveBeenCalled();
    });

    it('should call all loaders in parallel when refresh is called', async () => {
      const { result } = renderHook(() =>
        useMainCardData({
          motoristaId: 'motorista-123',
          state: 'pending',
        })
      );

      await act(async () => {
        await result.current.refresh();
      });

      expect(mockLoadYesterdayStats).toHaveBeenCalled();
      expect(mockLoadTodayStats).toHaveBeenCalled();
      expect(mockLoadStreak).toHaveBeenCalled();
      expect(mockLoadLastRoute).toHaveBeenCalled();
      expect(mockLoadExpiredRoute).toHaveBeenCalled();
    });

    it('should set isLoading to true during refresh', async () => {
      // Create a promise that we can control
      let resolvePromise: () => void;
      const controlledPromise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });
      mockLoadYesterdayStats.mockReturnValue(controlledPromise);

      const { result } = renderHook(() =>
        useMainCardData({
          motoristaId: 'motorista-123',
          state: 'pending',
        })
      );

      // Start refresh
      act(() => {
        result.current.refresh();
      });

      // isLoading should be true while loading
      expect(result.current.isLoading).toBe(true);

      // Resolve the promise
      await act(async () => {
        resolvePromise!();
        await Promise.resolve();
      });

      // isLoading should be false after loading
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should handle errors gracefully and still set isLoading to false', async () => {
      mockLoadYesterdayStats.mockRejectedValue(new Error('Load failed'));

      const { result } = renderHook(() =>
        useMainCardData({
          motoristaId: 'motorista-123',
          state: 'pending',
        })
      );

      await act(async () => {
        try {
          await result.current.refresh();
        } catch {
          // Expected
        }
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('auto-load on state change', () => {
    it('should auto-refresh when state is no-route', async () => {
      renderHook(() =>
        useMainCardData({
          motoristaId: 'motorista-123',
          state: 'no-route',
        })
      );

      await waitFor(() => {
        expect(mockLoadYesterdayStats).toHaveBeenCalled();
        expect(mockLoadTodayStats).toHaveBeenCalled();
        expect(mockLoadStreak).toHaveBeenCalled();
        expect(mockLoadLastRoute).toHaveBeenCalled();
        expect(mockLoadExpiredRoute).toHaveBeenCalled();
      });
    });

    it('should load streak when state is completed', async () => {
      // Clear previous calls
      mockLoadStreak.mockClear();

      renderHook(() =>
        useMainCardData({
          motoristaId: 'motorista-123',
          state: 'completed',
        })
      );

      await waitFor(() => {
        expect(mockLoadStreak).toHaveBeenCalled();
      });
    });

    it('should not auto-load when state is pending', async () => {
      mockLoadYesterdayStats.mockClear();

      renderHook(() =>
        useMainCardData({
          motoristaId: 'motorista-123',
          state: 'pending',
        })
      );

      // Give time for any effects to run
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Should not have been called (no auto-load for pending state)
      expect(mockLoadYesterdayStats).not.toHaveBeenCalled();
    });

    it('should not auto-load when motoristaId is undefined', async () => {
      mockLoadYesterdayStats.mockClear();

      renderHook(() =>
        useMainCardData({
          motoristaId: undefined,
          state: 'no-route',
        })
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      expect(mockLoadYesterdayStats).not.toHaveBeenCalled();
    });
  });
});
