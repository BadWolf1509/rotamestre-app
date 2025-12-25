/**
 * Tests for useCache.ts
 * Hook para cache com padrão SWR (stale-while-revalidate)
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';

import { useCache, useStaticCache } from '../useCache';

// Mock cache lib
jest.mock('@/lib/cache', () => ({
  getCache: jest.fn(),
  setCache: jest.fn(),
  clearCache: jest.fn(),
  CACHE_TTL: {
    USER_DATA: 300000, // 5 min
    STATIC_DATA: 3600000, // 1 hour
  },
}));

const mockCache = require('@/lib/cache');

describe('useCache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCache.getCache.mockResolvedValue(null);
    mockCache.setCache.mockResolvedValue(undefined);
    mockCache.clearCache.mockResolvedValue(undefined);
  });

  describe('Basic functionality', () => {
    it('should start with loading state', async () => {
      const fetcher = jest.fn().mockResolvedValue({ value: 1 });

      const { result } = renderHook(() =>
        useCache({ key: 'test', fetcher })
      );

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('should call fetcher and return data', async () => {
      const mockData = { id: 1, name: 'Test' };
      const fetcher = jest.fn().mockResolvedValue(mockData);

      const { result } = renderHook(() =>
        useCache({ key: 'test-key', fetcher })
      );

      await waitFor(() => {
        expect(result.current.data).toEqual(mockData);
      });

      expect(fetcher).toHaveBeenCalled();
    });

    it('should use cached data when available', async () => {
      const cachedData = { id: 2, name: 'Cached' };
      mockCache.getCache.mockResolvedValue(cachedData);

      const fetcher = jest.fn().mockResolvedValue({ id: 3, name: 'Fresh' });

      const { result } = renderHook(() =>
        useCache({ key: 'cached-key', fetcher })
      );

      await waitFor(() => {
        expect(result.current.fromCache).toBe(false); // Fresh data replaces cached
      });

      expect(mockCache.getCache).toHaveBeenCalledWith('cached-key');
    });

    it('should set cache after fetching fresh data', async () => {
      const freshData = { id: 5, name: 'Fresh Data' };
      const fetcher = jest.fn().mockResolvedValue(freshData);

      const { result } = renderHook(() =>
        useCache({ key: 'save-key', fetcher, ttl: 60000 })
      );

      await waitFor(() => {
        expect(result.current.data).toEqual(freshData);
      });

      expect(mockCache.setCache).toHaveBeenCalledWith('save-key', freshData, 60000);
    });
  });

  describe('Error handling', () => {
    it('should set error state on fetch failure', async () => {
      const mockError = new Error('Network error');
      const fetcher = jest.fn().mockRejectedValue(mockError);

      const { result } = renderHook(() =>
        useCache({ key: 'error-key', fetcher })
      );

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
        expect(result.current.error?.message).toBe('Network error');
      });
    });

    it('should call onError callback on failure', async () => {
      const mockError = new Error('Fetch failed');
      const fetcher = jest.fn().mockRejectedValue(mockError);
      const onError = jest.fn();

      renderHook(() =>
        useCache({ key: 'error-callback', fetcher, onError })
      );

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(expect.any(Error));
      });
    });
  });

  describe('Skip option', () => {
    it('should not fetch when skip is true', async () => {
      const fetcher = jest.fn().mockResolvedValue({ value: 1 });

      const { result } = renderHook(() =>
        useCache({ key: 'skip-key', fetcher, skip: true })
      );

      // Should not be loading when skipped
      expect(result.current.loading).toBe(false);
      expect(fetcher).not.toHaveBeenCalled();
    });
  });

  describe('Initial data', () => {
    it('should use initialData before fetch completes', async () => {
      const initialData = { id: 0, name: 'Initial' };
      const fetcher = jest.fn().mockResolvedValue({ id: 1, name: 'Fetched' });

      const { result } = renderHook(() =>
        useCache({ key: 'initial-key', fetcher, initialData })
      );

      // Initial data should be immediately available
      expect(result.current.data).toEqual(initialData);

      await waitFor(() => {
        expect(result.current.data).toEqual({ id: 1, name: 'Fetched' });
      });
    });
  });

  describe('Callbacks', () => {
    it('should call onSuccess with fresh data', async () => {
      const freshData = { value: 'fresh' };
      const fetcher = jest.fn().mockResolvedValue(freshData);
      const onSuccess = jest.fn();

      renderHook(() =>
        useCache({ key: 'success-key', fetcher, onSuccess })
      );

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledWith(freshData);
      });
    });
  });

  describe('Refresh function', () => {
    it('should refresh data when called', async () => {
      const fetcher = jest.fn()
        .mockResolvedValueOnce({ value: 1 })
        .mockResolvedValueOnce({ value: 2 });

      const { result } = renderHook(() =>
        useCache({ key: 'refresh-key', fetcher })
      );

      await waitFor(() => {
        expect(result.current.data).toEqual({ value: 1 });
      });

      await act(async () => {
        await result.current.refresh();
      });

      await waitFor(() => {
        expect(result.current.data).toEqual({ value: 2 });
      });

      expect(fetcher).toHaveBeenCalledTimes(2);
    });
  });

  describe('Invalidate function', () => {
    it('should clear cache when invalidate is called', async () => {
      const fetcher = jest.fn().mockResolvedValue({ value: 1 });

      const { result } = renderHook(() =>
        useCache({ key: 'invalidate-key', fetcher })
      );

      await waitFor(() => {
        expect(result.current.data).toBeTruthy();
      });

      await act(async () => {
        await result.current.invalidate();
      });

      expect(mockCache.clearCache).toHaveBeenCalledWith('invalidate-key');
      expect(result.current.fromCache).toBe(false);
    });
  });
});

describe('useStaticCache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCache.getCache.mockResolvedValue(null);
    mockCache.setCache.mockResolvedValue(undefined);
  });

  it('should use static TTL by default', async () => {
    const fetcher = jest.fn().mockResolvedValue({ static: true });

    const { result } = renderHook(() =>
      useStaticCache('static-key', fetcher)
    );

    await waitFor(() => {
      expect(result.current.data).toEqual({ static: true });
    });

    // Should use CACHE_TTL.STATIC_DATA (1 hour)
    expect(mockCache.setCache).toHaveBeenCalledWith(
      'static-key',
      { static: true },
      3600000
    );
  });

  it('should accept custom TTL', async () => {
    const fetcher = jest.fn().mockResolvedValue({ custom: true });

    const { result } = renderHook(() =>
      useStaticCache('custom-ttl-key', fetcher, { ttl: 120000 })
    );

    await waitFor(() => {
      expect(result.current.data).toBeTruthy();
    });

    expect(mockCache.setCache).toHaveBeenCalledWith(
      'custom-ttl-key',
      { custom: true },
      120000
    );
  });

  it('should respect skip option', () => {
    const fetcher = jest.fn().mockResolvedValue({ data: 1 });

    const { result } = renderHook(() =>
      useStaticCache('skipped-key', fetcher, { skip: true })
    );

    expect(result.current.loading).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
