import { renderHook, waitFor } from '@testing-library/react-native';

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
      expect.stringMatching(/^rotas-unit-1-\d+$/),
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
