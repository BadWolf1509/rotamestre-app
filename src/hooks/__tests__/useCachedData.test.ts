import { act, renderHook, waitFor } from '@testing-library/react-native';

import * as cacheModule from '@/lib/cache';

import { useCachedData, useFreshData } from '../useCachedData';

// Mock do módulo de cache
jest.mock('@/lib/cache', () => ({
  getCache: jest.fn(),
  setCache: jest.fn(),
  clearCache: jest.fn(),
  CACHE_TTL: {
    USER_DATA: 5 * 60 * 1000,
    DASHBOARD: 2 * 60 * 1000,
    SHORT: 1 * 60 * 1000,
  },
}));

describe('useCachedData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (cacheModule.getCache as jest.Mock).mockResolvedValue(null);
    (cacheModule.setCache as jest.Mock).mockResolvedValue(undefined);
    (cacheModule.clearCache as jest.Mock).mockResolvedValue(undefined);
  });

  describe('carregamento básico', () => {
    it('deve carregar dados automaticamente', async () => {
      const mockData = { id: 1, name: 'Test' };
      const fetcher = jest.fn().mockResolvedValue(mockData);

      const { result } = renderHook(() =>
        useCachedData('test_key', fetcher, { enabled: true })
      );

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(result.current.data).toEqual(mockData);
      expect(result.current.isStale).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('não deve carregar quando enabled é false', () => {
      const fetcher = jest.fn().mockResolvedValue({});

      const { result } = renderHook(() =>
        useCachedData('test_key', fetcher, { enabled: false })
      );

      expect(result.current.loading).toBe(false);
      expect(fetcher).not.toHaveBeenCalled();
    });
  });

  describe('SWR pattern', () => {
    it('deve mostrar dados do cache enquanto busca novos', async () => {
      const cachedData = { id: 1, name: 'Cached' };
      const freshData = { id: 1, name: 'Fresh' };

      (cacheModule.getCache as jest.Mock).mockResolvedValue(cachedData);

      // Promise controlada para o fetcher
      let resolveFetcher: (value: typeof freshData) => void;
      const fetcherPromise = new Promise<typeof freshData>((resolve) => {
        resolveFetcher = resolve;
      });
      const fetcher = jest.fn().mockReturnValue(fetcherPromise);

      const { result } = renderHook(() =>
        useCachedData('swr_key', fetcher, { staleWhileRevalidate: true })
      );

      // Deve mostrar dados do cache primeiro
      await waitFor(() => {
        expect(result.current.data).toEqual(cachedData);
        expect(result.current.isStale).toBe(true);
        expect(result.current.loading).toBe(false);
      });

      // Resolver o fetcher
      await act(async () => {
        resolveFetcher!(freshData);
      });

      // Deve atualizar para dados frescos
      await waitFor(() => {
        expect(result.current.data).toEqual(freshData);
        expect(result.current.isStale).toBe(false);
      });
    });
  });

  describe('cache', () => {
    it('deve salvar dados no cache após fetch', async () => {
      const mockData = { id: 1 };
      const fetcher = jest.fn().mockResolvedValue(mockData);
      const ttl = 60000;

      const { result } = renderHook(() =>
        useCachedData('save_key', fetcher, { ttl })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(cacheModule.setCache).toHaveBeenCalledWith('save_key', mockData, ttl);
    });
  });

  describe('tratamento de erros', () => {
    it('deve capturar e armazenar erro', async () => {
      const error = new Error('Fetch failed');
      const fetcher = jest.fn().mockRejectedValue(error);

      const { result } = renderHook(() =>
        useCachedData('error_key', fetcher, { enabled: true })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toEqual(error);
      expect(result.current.data).toBeNull();
    });

    it('deve manter dados do cache se fetch falhar', async () => {
      const cachedData = { id: 1, name: 'Cached' };
      (cacheModule.getCache as jest.Mock).mockResolvedValue(cachedData);

      const error = new Error('Network error');
      const fetcher = jest.fn().mockRejectedValue(error);

      const { result } = renderHook(() =>
        useCachedData('fallback_key', fetcher, { staleWhileRevalidate: true })
      );

      await waitFor(() => {
        expect(result.current.error).toEqual(error);
      });

      // Deve manter os dados do cache
      expect(result.current.data).toEqual(cachedData);
    });
  });

  describe('refresh', () => {
    it('deve ignorar cache e buscar dados frescos', async () => {
      const cachedData = { id: 1, name: 'Cached' };
      const freshData = { id: 1, name: 'Fresh' };

      (cacheModule.getCache as jest.Mock).mockResolvedValue(cachedData);

      let callCount = 0;
      const fetcher = jest.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve(callCount === 1 ? cachedData : freshData);
      });

      const { result } = renderHook(() =>
        useCachedData('refresh_key', fetcher)
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Chamar refresh
      await act(async () => {
        await result.current.refresh();
      });

      expect(fetcher).toHaveBeenCalledTimes(2);
      expect(result.current.data).toEqual(freshData);
    });
  });

  describe('clear', () => {
    it('deve limpar cache e dados', async () => {
      const mockData = { id: 1 };
      const fetcher = jest.fn().mockResolvedValue(mockData);

      const { result } = renderHook(() =>
        useCachedData('clear_key', fetcher)
      );

      await waitFor(() => {
        expect(result.current.data).toEqual(mockData);
      });

      await act(async () => {
        await result.current.clear();
      });

      expect(cacheModule.clearCache).toHaveBeenCalledWith('clear_key');
      expect(result.current.data).toBeNull();
      expect(result.current.isStale).toBe(false);
    });
  });

  describe('update', () => {
    it('deve atualizar dados e cache', async () => {
      const mockData = { id: 1, count: 0 };
      const fetcher = jest.fn().mockResolvedValue(mockData);
      const ttl = 60000;

      const { result } = renderHook(() =>
        useCachedData<{ id: number; count: number }>('update_key', fetcher, { ttl })
      );

      await waitFor(() => {
        expect(result.current.data).toEqual(mockData);
      });

      const newData = { id: 1, count: 5 };
      await act(async () => {
        await result.current.update(newData);
      });

      expect(result.current.data).toEqual(newData);
      expect(result.current.isStale).toBe(false);
      expect(cacheModule.setCache).toHaveBeenCalledWith('update_key', newData, ttl);
    });

    it('deve aceitar função de atualização', async () => {
      const mockData = { count: 1 };
      const fetcher = jest.fn().mockResolvedValue(mockData);

      const { result } = renderHook(() =>
        useCachedData<{ count: number }>('func_update_key', fetcher)
      );

      await waitFor(() => {
        expect(result.current.data).toEqual(mockData);
      });

      await act(async () => {
        await result.current.update((prev) => ({ count: (prev?.count || 0) + 10 }));
      });

      expect(result.current.data).toEqual({ count: 11 });
    });
  });

  describe('callbacks', () => {
    it('deve chamar onUpdate quando dados são carregados', async () => {
      const mockData = { id: 1 };
      const onUpdate = jest.fn();
      const fetcher = jest.fn().mockResolvedValue(mockData);

      const { result } = renderHook(() =>
        useCachedData('callback_key', fetcher, { onUpdate })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(onUpdate).toHaveBeenCalledWith(mockData);
    });

    it('deve chamar onUpdate quando dados são atualizados manualmente', async () => {
      const mockData = { id: 1 };
      const onUpdate = jest.fn();
      const fetcher = jest.fn().mockResolvedValue(mockData);

      const { result } = renderHook(() =>
        useCachedData('manual_callback_key', fetcher, { onUpdate })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      onUpdate.mockClear();

      const newData = { id: 2 };
      await act(async () => {
        await result.current.update(newData);
      });

      expect(onUpdate).toHaveBeenCalledWith(newData);
    });
  });

  describe('dependencies', () => {
    it('deve re-executar quando key muda', async () => {
      const fetcher = jest.fn().mockResolvedValue({ data: 'test' });

      const { result, rerender } = renderHook(
        ({ key }) => useCachedData(key, fetcher),
        { initialProps: { key: 'key1' } }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(fetcher).toHaveBeenCalledTimes(1);

      // Mudar a key
      rerender({ key: 'key2' });

      await waitFor(() => {
        expect(fetcher).toHaveBeenCalledTimes(2);
      });
    });
  });
});

describe('useFreshData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (cacheModule.getCache as jest.Mock).mockResolvedValue(null);
    (cacheModule.setCache as jest.Mock).mockResolvedValue(undefined);
  });

  it('não deve usar SWR (sempre espera dados frescos)', async () => {
    const cachedData = { id: 1, name: 'Cached' };
    const freshData = { id: 1, name: 'Fresh' };

    (cacheModule.getCache as jest.Mock).mockResolvedValue(cachedData);
    const fetcher = jest.fn().mockResolvedValue(freshData);

    const { result } = renderHook(() =>
      useFreshData('fresh_key', fetcher)
    );

    // Deve mostrar loading até ter dados frescos
    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Deve ter dados frescos, não do cache
    expect(result.current.data).toEqual(freshData);
    expect(result.current.isStale).toBe(false);
  });
});
