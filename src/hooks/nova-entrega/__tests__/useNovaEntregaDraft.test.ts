import { act, renderHook, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';

import {
  useNovaEntregaDraft,
  type NovaEntregaDraftPayload,
} from '../useNovaEntregaDraft';

const mockMaybeSingle = jest.fn();
const mockUpsert = jest.fn();
const mockQueryResult = { error: null };

const mockChain: {
  select: jest.Mock;
  eq: jest.Mock;
  maybeSingle: jest.Mock;
  delete: jest.Mock;
  upsert: jest.Mock;
  then: (
    resolve: (value: typeof mockQueryResult) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise<unknown>;
} = {
  select: jest.fn(),
  eq: jest.fn(),
  maybeSingle: mockMaybeSingle,
  delete: jest.fn(),
  upsert: mockUpsert,
  then: (resolve, reject) =>
    Promise.resolve(mockQueryResult).then(resolve, reject),
};
mockChain.select.mockReturnValue(mockChain);
mockChain.eq.mockReturnValue(mockChain);
mockChain.delete.mockReturnValue(mockChain);

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => mockChain),
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

const emptyPayload: NovaEntregaDraftPayload = {
  paradas: [],
  motoristaSelecionado: '',
  dataRota: '2099-07-24',
  rotaOtimizada: null,
  ordemManual: false,
};

const savedPayload: NovaEntregaDraftPayload = {
  paradas: [
    {
      id: 'stop-1',
      ordem: 1,
      tipo: 'entrega',
      endereco: 'Rua A, 123',
      destinatario: 'João',
      telefone: '11999999999',
      observacoes: '',
      latitude: -23.5,
      longitude: -46.6,
    },
  ],
  motoristaSelecionado: 'driver-1',
  dataRota: '2099-07-25',
  rotaOtimizada: null,
  ordemManual: false,
};

describe('useNovaEntregaDraft', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQueryResult.error = null;
    mockUpsert.mockResolvedValue(mockQueryResult);
  });

  it('restores the stops, driver and date after a page reload', async () => {
    const onRestore = jest.fn();
    mockMaybeSingle.mockResolvedValue({
      data: {
        payload: savedPayload,
        atualizado_em: '2026-07-23T20:00:00.000Z',
        expira_em: '2099-07-30T20:00:00.000Z',
      },
      error: null,
    });

    const { result } = renderHook(() =>
      useNovaEntregaDraft({
        userId: 'user-1',
        unidadeId: 'unit-1',
        payload: emptyPayload,
        onRestore,
      }),
    );

    await waitFor(() => expect(result.current.isHydrating).toBe(false));

    expect(onRestore).toHaveBeenCalledWith(savedPayload);
    expect(result.current.lastSavedAt).toBe('2026-07-23T20:00:00.000Z');
  });

  it('restores the immediate browser session copy before the server has one', async () => {
    const originalPlatform = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    const values = new Map<string, string>();
    const storage: Storage = {
      get length() {
        return values.size;
      },
      clear: () => values.clear(),
      getItem: (key) => values.get(key) ?? null,
      key: (index) => [...values.keys()][index] ?? null,
      removeItem: (key) => {
        values.delete(key);
      },
      setItem: (key, value) => {
        values.set(key, value);
      },
    };
    Object.defineProperty(globalThis, 'sessionStorage', {
      value: storage,
      configurable: true,
    });
    storage.setItem(
      'rotamestre:nova-entrega:user-1:unit-1',
      JSON.stringify({
        payload: savedPayload,
        updatedAt: '2099-07-23T20:00:00.000Z',
        expiresAt: '2099-07-30T20:00:00.000Z',
      }),
    );
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const onRestore = jest.fn();

    const { result } = renderHook(() =>
      useNovaEntregaDraft({
        userId: 'user-1',
        unidadeId: 'unit-1',
        payload: emptyPayload,
        onRestore,
      }),
    );
    await waitFor(() => expect(result.current.isHydrating).toBe(false));

    expect(onRestore).toHaveBeenCalledWith(savedPayload);

    Object.defineProperty(Platform, 'OS', {
      value: originalPlatform,
      configurable: true,
    });
    Reflect.deleteProperty(globalThis, 'sessionStorage');
  });

  it('saves a non-empty draft with a debounce and the tenant scope', async () => {
    jest.useFakeTimers();
    const onRestore = jest.fn();
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const { result, rerender } = renderHook(
      ({ payload }) =>
        useNovaEntregaDraft({
          userId: 'user-1',
          unidadeId: 'unit-1',
          payload,
          onRestore,
        }),
      { initialProps: { payload: emptyPayload } },
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.isHydrating).toBe(false);

    rerender({ payload: savedPayload });
    await act(async () => {
      jest.advanceTimersByTime(800);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        usuario_id: 'user-1',
        unidade_id: 'unit-1',
        payload: savedPayload,
      }),
      { onConflict: 'usuario_id,unidade_id' },
    );
    jest.useRealTimers();
  });

  it('deletes an expired draft instead of restoring personal data', async () => {
    const onRestore = jest.fn();
    mockMaybeSingle.mockResolvedValue({
      data: {
        payload: savedPayload,
        atualizado_em: '2020-01-01T00:00:00.000Z',
        expira_em: '2020-01-02T00:00:00.000Z',
      },
      error: null,
    });

    const { result } = renderHook(() =>
      useNovaEntregaDraft({
        userId: 'user-1',
        unidadeId: 'unit-1',
        payload: emptyPayload,
        onRestore,
      }),
    );

    await waitFor(() => expect(result.current.isHydrating).toBe(false));

    expect(mockChain.delete).toHaveBeenCalled();
    expect(onRestore).toHaveBeenCalledWith(null);
  });

  it('clears the scoped draft after a successful creation', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const onRestore = jest.fn();
    const { result } = renderHook(() =>
      useNovaEntregaDraft({
        userId: 'user-1',
        unidadeId: 'unit-1',
        payload: emptyPayload,
        onRestore,
      }),
    );
    await waitFor(() => expect(result.current.isHydrating).toBe(false));

    await act(async () => {
      await result.current.clearDraft();
    });

    expect(mockChain.delete).toHaveBeenCalled();
    expect(mockChain.eq).toHaveBeenCalledWith('usuario_id', 'user-1');
    expect(mockChain.eq).toHaveBeenCalledWith('unidade_id', 'unit-1');
  });
});
