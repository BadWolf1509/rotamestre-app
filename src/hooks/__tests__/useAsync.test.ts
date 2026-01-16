import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useAsync, useAsyncAction } from '../useAsync';

describe('useAsync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('execução automática (immediate: true)', () => {
    it('deve executar automaticamente ao montar', async () => {
      const mockFn = jest.fn().mockResolvedValue('data');

      const { result } = renderHook(() =>
        useAsync(mockFn, { immediate: true })
      );

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(result.current.data).toBe('data');
      expect(result.current.error).toBeNull();
      expect(result.current.hasRun).toBe(true);
    });

    it('deve re-executar quando deps mudam', async () => {
      const mockFn = jest.fn().mockResolvedValue('data');
      let dep = 1;

      const { result, rerender } = renderHook(() =>
        useAsync(mockFn, { immediate: true, deps: [dep] })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockFn).toHaveBeenCalledTimes(1);

      // Mudar dependência
      dep = 2;
      rerender({});

      await waitFor(() => {
        expect(mockFn).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('execução manual (immediate: false)', () => {
    it('não deve executar automaticamente', () => {
      const mockFn = jest.fn().mockResolvedValue('data');

      const { result } = renderHook(() =>
        useAsync(mockFn, { immediate: false })
      );

      expect(result.current.loading).toBe(false);
      expect(mockFn).not.toHaveBeenCalled();
      expect(result.current.hasRun).toBe(false);
    });

    it('deve executar quando execute() é chamado', async () => {
      const mockFn = jest.fn().mockResolvedValue('data');

      const { result } = renderHook(() =>
        useAsync(mockFn, { immediate: false })
      );

      await act(async () => {
        await result.current.execute();
      });

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(result.current.data).toBe('data');
      expect(result.current.hasRun).toBe(true);
    });
  });

  describe('tratamento de erros', () => {
    it('deve capturar e armazenar erro', async () => {
      const error = new Error('Falha na operação');
      const mockFn = jest.fn().mockRejectedValue(error);

      const { result } = renderHook(() =>
        useAsync(mockFn, { immediate: true })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toEqual(error);
      expect(result.current.data).toBeNull();
      expect(result.current.hasRun).toBe(true);
    });

    it('deve chamar onError callback', async () => {
      const error = new Error('Falha');
      const mockFn = jest.fn().mockRejectedValue(error);
      const onError = jest.fn();

      const { result } = renderHook(() =>
        useAsync(mockFn, { immediate: true, onError })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(onError).toHaveBeenCalledWith(error);
    });

    it('deve converter erro não-Error em Error', async () => {
      const mockFn = jest.fn().mockRejectedValue('string error');

      const { result } = renderHook(() =>
        useAsync(mockFn, { immediate: true })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe('string error');
    });
  });

  describe('callbacks', () => {
    it('deve chamar onSuccess com dados', async () => {
      const mockFn = jest.fn().mockResolvedValue({ id: 1, name: 'Test' });
      const onSuccess = jest.fn();

      const { result } = renderHook(() =>
        useAsync(mockFn, { immediate: true, onSuccess })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(onSuccess).toHaveBeenCalledWith({ id: 1, name: 'Test' });
    });
  });

  describe('reset', () => {
    it('deve resetar todos os estados', async () => {
      const mockFn = jest.fn().mockResolvedValue('data');

      const { result } = renderHook(() =>
        useAsync(mockFn, { immediate: true })
      );

      await waitFor(() => {
        expect(result.current.data).toBe('data');
      });

      act(() => {
        result.current.reset();
      });

      expect(result.current.data).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.hasRun).toBe(false);
    });
  });

  describe('prevenção de race conditions', () => {
    it('deve evitar execuções simultâneas', async () => {
      let resolveFirst: (value: string) => void;
      const firstPromise = new Promise<string>((resolve) => {
        resolveFirst = resolve;
      });
      const mockFn = jest.fn().mockReturnValue(firstPromise);

      const { result } = renderHook(() =>
        useAsync(mockFn, { immediate: false })
      );

      // Iniciar primeira execução
      act(() => {
        result.current.execute();
      });

      // Tentar segunda execução enquanto primeira está em andamento
      act(() => {
        result.current.execute();
      });

      // Resolver primeira
      await act(async () => {
        resolveFirst!('data');
      });

      // Deve ter executado apenas uma vez
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('estados de loading', () => {
    it('deve ter loading true durante execução', async () => {
      let resolveFn: (value: string) => void;
      const promise = new Promise<string>((resolve) => {
        resolveFn = resolve;
      });
      const mockFn = jest.fn().mockReturnValue(promise);

      const { result } = renderHook(() =>
        useAsync(mockFn, { immediate: true })
      );

      expect(result.current.loading).toBe(true);

      await act(async () => {
        resolveFn!('data');
      });

      expect(result.current.loading).toBe(false);
    });
  });
});

describe('useAsyncAction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('não deve executar automaticamente', () => {
    const mockFn = jest.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() => useAsyncAction(mockFn));

    expect(result.current.loading).toBe(false);
    expect(mockFn).not.toHaveBeenCalled();
  });

  it('deve executar quando execute() é chamado', async () => {
    const mockFn = jest.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() => useAsyncAction(mockFn));

    await act(async () => {
      await result.current.execute();
    });

    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('deve chamar onSuccess após sucesso', async () => {
    const mockFn = jest.fn().mockResolvedValue(undefined);
    const onSuccess = jest.fn();

    const { result } = renderHook(() =>
      useAsyncAction(mockFn, { onSuccess })
    );

    await act(async () => {
      await result.current.execute();
    });

    expect(onSuccess).toHaveBeenCalled();
  });

  it('deve capturar erro e chamar onError', async () => {
    const error = new Error('Falha');
    const mockFn = jest.fn().mockRejectedValue(error);
    const onError = jest.fn();

    const { result } = renderHook(() =>
      useAsyncAction(mockFn, { onError })
    );

    await act(async () => {
      await result.current.execute();
    });

    expect(result.current.error).toEqual(error);
    expect(onError).toHaveBeenCalledWith(error);
  });

  it('deve resetar estados', async () => {
    const error = new Error('Falha');
    const mockFn = jest.fn().mockRejectedValue(error);

    const { result } = renderHook(() => useAsyncAction(mockFn));

    await act(async () => {
      await result.current.execute();
    });

    expect(result.current.error).not.toBeNull();

    act(() => {
      result.current.reset();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });
});
