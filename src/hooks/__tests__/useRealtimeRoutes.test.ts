import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';

import { useRealtimeRoutes } from '../useRealtimeRoutes';

// Mock do Supabase
const mockSubscribe = jest.fn();
const mockOn = jest.fn().mockReturnThis();
const mockChannel = {
  on: mockOn,
  subscribe: mockSubscribe,
};

jest.mock('@/lib/supabase', () => ({
  supabase: {
    channel: jest.fn(() => mockChannel),
    removeChannel: jest.fn(),
    realtime: {
      setAuth: jest.fn(),
    },
  },
}));

// Mock do useAuth
jest.mock('../useAuth', () => ({
  useAuth: () => ({
    session: { access_token: 'mock-token' },
    user: { id: 'user-1' },
  }),
}));

// Mock do useUnidadeAtiva
jest.mock('../useUnidadeAtiva', () => ({
  useUnidadeAtiva: () => ({
    unidadeAtiva: 'unit-1',
  }),
}));

describe('useRealtimeRoutes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deve criar subscrição ao montar', async () => {
    const { result } = renderHook(() => useRealtimeRoutes({ enabled: true }));

    await waitFor(() => {
      expect(result.current.updateTrigger).toBe(0);
    });

    // Verificar que o canal foi criado (nome inclui unidade)
    const { supabase } = require('@/lib/supabase');
    expect(supabase.channel).toHaveBeenCalledWith(
      expect.stringMatching(/^rotas-unit-1#\d+$/),
    );

    // Verificar que on() foi chamado para rotas
    expect(mockOn).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({
        event: '*',
        schema: 'public',
        table: 'rotas',
        filter: 'unidade_id=eq.unit-1',
      }),
      expect.any(Function),
    );

    // Verificar que on() foi chamado para paradas
    expect(mockOn).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({
        event: 'UPDATE',
        schema: 'public',
        table: 'paradas',
      }),
      expect.any(Function),
    );

    // Verificar que subscribe() foi chamado
    expect(mockSubscribe).toHaveBeenCalled();
  });

  it('não re-subscreve quando muda só a identidade de onRouteUpdate (evita reuso de canal)', async () => {
    const { supabase } = require('@/lib/supabase');
    const { rerender } = renderHook(
      ({ cb }: { cb: () => void }) =>
        useRealtimeRoutes({ enabled: true, onRouteUpdate: cb }),
      { initialProps: { cb: () => {} } },
    );

    await waitFor(() => {
      expect(supabase.channel).toHaveBeenCalledTimes(1);
    });

    // Nova identidade do callback NÃO pode recriar o canal — era a causa do erro
    // "cannot add postgres_changes callbacks after subscribe()" no SDK 56.
    rerender({ cb: () => {} });
    rerender({ cb: () => {} });

    expect(supabase.channel).toHaveBeenCalledTimes(1);
  });

  it('deve inicializar com updateTrigger zero', async () => {
    const { result } = renderHook(() => useRealtimeRoutes({ enabled: true }));

    await waitFor(() => {
      expect(result.current.updateTrigger).toBe(0);
    });
  });

  it('não deve criar subscrição quando disabled', () => {
    renderHook(() => useRealtimeRoutes({ enabled: false }));

    const { supabase } = require('@/lib/supabase');
    expect(supabase.channel).not.toHaveBeenCalled();
  });

  it('não deve criar subscrição quando não há unidade_id', () => {
    // Mock sem unidadeAtiva
    jest
      .spyOn(require('../useUnidadeAtiva'), 'useUnidadeAtiva')
      .mockReturnValue({
        unidadeAtiva: null,
      });

    renderHook(() => useRealtimeRoutes({ enabled: true }));

    const { supabase } = require('@/lib/supabase');
    expect(supabase.channel).not.toHaveBeenCalled();
  });

  it('não deve criar subscrição quando não há session', () => {
    // Mock sem session
    jest.spyOn(require('../useAuth'), 'useAuth').mockReturnValue({
      session: null,
      user: null,
    });

    renderHook(() => useRealtimeRoutes({ enabled: true }));

    const { supabase } = require('@/lib/supabase');
    expect(supabase.channel).not.toHaveBeenCalled();
  });
});

// DP-2: sem isto, evento perdido com o socket caído (ou com o app em segundo
// plano) nunca chegava, e a tela ficava com o dado velho até outro evento.
describe('useRealtimeRoutes — revalidação', () => {
  function espiarAppState() {
    const ouvintes: ((estado: string) => void)[] = [];
    Object.defineProperty(AppState, 'currentState', {
      value: 'active',
      configurable: true,
    });
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_e: string, cb: (estado: string) => void) => {
        ouvintes.push(cb);
        return { remove: jest.fn() } as never;
      });
    return (estado: string) => ouvintes.forEach((cb) => cb(estado));
  }

  /** Callback do `.subscribe(status => ...)` do canal criado. */
  const statusDoCanal = () =>
    mockSubscribe.mock.calls[mockSubscribe.mock.calls.length - 1][0] as (
      status: string,
    ) => void;

  beforeEach(() => {
    // Os testes acima trocam useAuth/useUnidadeAtiva por spyOn sem restaurar.
    jest.restoreAllMocks();
    jest.clearAllMocks();
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('o primeiro SUBSCRIBED não recarrega; a volta a SUBSCRIBED (reconexão) recarrega', () => {
    const onRouteUpdate = jest.fn();
    renderHook(() =>
      useRealtimeRoutes({ enabled: true, onRouteUpdate, debounceMs: 100 }),
    );

    act(() => statusDoCanal()('SUBSCRIBED'));
    act(() => jest.advanceTimersByTime(200));
    expect(onRouteUpdate).not.toHaveBeenCalled();

    act(() => {
      statusDoCanal()('CHANNEL_ERROR');
      statusDoCanal()('SUBSCRIBED');
    });
    act(() => jest.advanceTimersByTime(200));
    expect(onRouteUpdate).toHaveBeenCalledTimes(1);
  });

  it('o app voltar ao primeiro plano recarrega (com debounce)', () => {
    const disparar = espiarAppState();
    const onRouteUpdate = jest.fn();
    renderHook(() =>
      useRealtimeRoutes({ enabled: true, onRouteUpdate, debounceMs: 100 }),
    );

    act(() => {
      disparar('background');
      disparar('active');
    });
    expect(onRouteUpdate).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(200));
    expect(onRouteUpdate).toHaveBeenCalledTimes(1);
  });

  it('desligado, voltar ao primeiro plano não recarrega', () => {
    const disparar = espiarAppState();
    const onRouteUpdate = jest.fn();
    renderHook(() =>
      useRealtimeRoutes({ enabled: false, onRouteUpdate, debounceMs: 100 }),
    );

    act(() => {
      disparar('background');
      disparar('active');
      jest.advanceTimersByTime(200);
    });
    expect(onRouteUpdate).not.toHaveBeenCalled();
  });
});
