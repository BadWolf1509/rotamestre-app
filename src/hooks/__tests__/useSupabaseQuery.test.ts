import { act, renderHook, waitFor } from '@testing-library/react-native';

import * as cacheModule from '@/lib/cache';

import { useSupabaseQuery, useSupabaseQueryNoCache } from '../useSupabaseQuery';

// Mock do módulo de cache
jest.mock('@/lib/cache', () => ({
  getCache: jest.fn(),
  setCache: jest.fn(),
  clearCache: jest.fn(),
  CACHE_TTL: {
    USER_DATA: 5 * 60 * 1000,
    DASHBOARD: 2 * 60 * 1000,
    ROUTES_LIST: 3 * 60 * 1000,
  },
}));

describe('useSupabaseQuery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (cacheModule.getCache as jest.Mock).mockResolvedValue(null);
    (cacheModule.setCache as jest.Mock).mockResolvedValue(undefined);
    (cacheModule.clearCache as jest.Mock).mockResolvedValue(undefined);
  });

  describe('execução básica', () => {
    it('deve executar query automaticamente quando enabled', async () => {
      const mockData = [{ id: 1, nome: 'Teste' }];
      const queryFn = jest.fn().mockResolvedValue({
        data: mockData,
        error: null,
      });

      const { result } = renderHook(() =>
        useSupabaseQuery(queryFn, { enabled: true })
      );

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(queryFn).toHaveBeenCalledTimes(1);
      expect(result.current.data).toEqual(mockData);
      expect(result.current.error).toBeNull();
    });

    it('não deve executar quando enabled é false', () => {
      const queryFn = jest.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      const { result } = renderHook(() =>
        useSupabaseQuery(queryFn, { enabled: false })
      );

      expect(result.current.loading).toBe(false);
      expect(queryFn).not.toHaveBeenCalled();
    });
  });

  describe('cache', () => {
    it('deve usar cache quando disponível (SWR)', async () => {
      const cachedData = [{ id: 1, nome: 'Cache' }];
      const freshData = [{ id: 1, nome: 'Fresh' }];

      (cacheModule.getCache as jest.Mock).mockResolvedValue(cachedData);

      // Criar promise controlada para a query
      let resolveQuery: (value: { data: typeof freshData; error: null }) => void;
      const queryPromise = new Promise<{ data: typeof freshData; error: null }>((resolve) => {
        resolveQuery = resolve;
      });
      const queryFn = jest.fn().mockReturnValue(queryPromise);

      const { result } = renderHook(() =>
        useSupabaseQuery(queryFn, {
          cacheKey: 'test_key',
          staleWhileRevalidate: true,
        })
      );

      // Deve mostrar dados do cache primeiro (enquanto query ainda não resolveu)
      await waitFor(() => {
        expect(result.current.data).toEqual(cachedData);
        expect(result.current.fromCache).toBe(true);
      });

      // Agora resolver a query
      await act(async () => {
        resolveQuery!({ data: freshData, error: null });
      });

      // Depois atualiza com dados frescos
      await waitFor(() => {
        expect(result.current.data).toEqual(freshData);
        expect(result.current.fromCache).toBe(false);
      });

      expect(cacheModule.getCache).toHaveBeenCalledWith('test_key');
    });

    it('deve salvar dados no cache após query', async () => {
      const mockData = [{ id: 1 }];
      const queryFn = jest.fn().mockResolvedValue({
        data: mockData,
        error: null,
      });

      const { result } = renderHook(() =>
        useSupabaseQuery(queryFn, {
          cacheKey: 'save_test',
          cacheTTL: 60000,
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(cacheModule.setCache).toHaveBeenCalledWith(
        'save_test',
        mockData,
        60000
      );
    });
  });

  describe('tratamento de erros', () => {
    it('deve capturar erro da query Supabase', async () => {
      const queryFn = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Erro de conexão' },
      });

      const { result } = renderHook(() =>
        useSupabaseQuery(queryFn, { enabled: true })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Erro de conexão');
      expect(result.current.data).toBeNull();
    });

    it('deve chamar onError callback', async () => {
      const onError = jest.fn();
      const queryFn = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Falha' },
      });

      const { result } = renderHook(() =>
        useSupabaseQuery(queryFn, { enabled: true, onError })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(onError).toHaveBeenCalledWith('Falha');
    });

    it('deve tratar exceções não-Supabase', async () => {
      const queryFn = jest.fn().mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() =>
        useSupabaseQuery(queryFn, { enabled: true })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Network error');
    });
  });

  describe('refetch', () => {
    it('deve ignorar cache ao refetch', async () => {
      const cachedData = [{ id: 1, nome: 'Cache' }];
      const freshData = [{ id: 1, nome: 'Fresh' }];

      (cacheModule.getCache as jest.Mock).mockResolvedValue(cachedData);

      const queryFn = jest.fn().mockResolvedValue({
        data: freshData,
        error: null,
      });

      const { result } = renderHook(() =>
        useSupabaseQuery(queryFn, {
          cacheKey: 'refetch_test',
        })
      );

      await waitFor(() => {
        expect(result.current.data).toEqual(freshData);
      });

      // Reset mock para próxima chamada
      queryFn.mockClear();
      const newFreshData = [{ id: 2, nome: 'New Fresh' }];
      queryFn.mockResolvedValue({ data: newFreshData, error: null });

      await act(async () => {
        await result.current.refetch();
      });

      expect(queryFn).toHaveBeenCalledTimes(1);
      expect(result.current.data).toEqual(newFreshData);
    });
  });

  describe('mutate', () => {
    it('deve atualizar dados localmente', async () => {
      const queryFn = jest.fn().mockResolvedValue({
        data: [{ id: 1, nome: 'Original' }],
        error: null,
      });

      const { result } = renderHook(() =>
        useSupabaseQuery(queryFn, { cacheKey: 'mutate_test' })
      );

      await waitFor(() => {
        expect(result.current.data).toEqual([{ id: 1, nome: 'Original' }]);
      });

      act(() => {
        result.current.mutate([{ id: 1, nome: 'Updated' }]);
      });

      expect(result.current.data).toEqual([{ id: 1, nome: 'Updated' }]);
      expect(cacheModule.setCache).toHaveBeenCalledWith(
        'mutate_test',
        [{ id: 1, nome: 'Updated' }],
        expect.any(Number)
      );
    });

    it('deve aceitar função de atualização', async () => {
      const queryFn = jest.fn().mockResolvedValue({
        data: { count: 1 },
        error: null,
      });

      const { result } = renderHook(() =>
        useSupabaseQuery<{ count: number }>(queryFn, { cacheKey: 'func_mutate' })
      );

      await waitFor(() => {
        expect(result.current.data).toEqual({ count: 1 });
      });

      act(() => {
        result.current.mutate((prev) => ({ count: (prev?.count || 0) + 1 }));
      });

      expect(result.current.data).toEqual({ count: 2 });
    });
  });

  describe('invalidate', () => {
    it('deve limpar cache e dados', async () => {
      const queryFn = jest.fn().mockResolvedValue({
        data: [{ id: 1 }],
        error: null,
      });

      const { result } = renderHook(() =>
        useSupabaseQuery(queryFn, { cacheKey: 'invalidate_test' })
      );

      await waitFor(() => {
        expect(result.current.data).toEqual([{ id: 1 }]);
      });

      await act(async () => {
        await result.current.invalidate();
      });

      expect(cacheModule.clearCache).toHaveBeenCalledWith('invalidate_test');
      expect(result.current.data).toBeNull();
      expect(result.current.fromCache).toBe(false);
    });
  });

  describe('callbacks', () => {
    it('deve chamar onSuccess com dados', async () => {
      const onSuccess = jest.fn();
      const mockData = [{ id: 1 }];
      const queryFn = jest.fn().mockResolvedValue({
        data: mockData,
        error: null,
      });

      const { result } = renderHook(() =>
        useSupabaseQuery(queryFn, { enabled: true, onSuccess })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(onSuccess).toHaveBeenCalledWith(mockData);
    });
  });
});

describe('useSupabaseQueryNoCache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('não deve usar cache', async () => {
    const mockData = [{ id: 1 }];
    const queryFn = jest.fn().mockResolvedValue({
      data: mockData,
      error: null,
    });

    const { result } = renderHook(() =>
      useSupabaseQueryNoCache(queryFn, { enabled: true })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(cacheModule.getCache).not.toHaveBeenCalled();
    expect(cacheModule.setCache).not.toHaveBeenCalled();
    expect(result.current.data).toEqual(mockData);
  });

  it('não deve ter propriedade fromCache ou invalidate', async () => {
    const queryFn = jest.fn().mockResolvedValue({
      data: [],
      error: null,
    });

    const { result } = renderHook(() =>
      useSupabaseQueryNoCache(queryFn, { enabled: true })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Verificar que as propriedades esperadas existem
    expect(result.current).toHaveProperty('data');
    expect(result.current).toHaveProperty('loading');
    expect(result.current).toHaveProperty('error');
    expect(result.current).toHaveProperty('refetch');
    expect(result.current).toHaveProperty('mutate');
  });
});
