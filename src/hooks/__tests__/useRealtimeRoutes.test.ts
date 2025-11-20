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
  },
}));

// Mock do useUser
jest.mock('../useUser', () => ({
  useUser: () => ({
    userData: { id: 'user-1', papel: 'gestor', unidade_id: 'unit-1' },
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

    // Verificar que o canal foi criado
    const { supabase } = require('@/lib/supabase');
    expect(supabase.channel).toHaveBeenCalledWith('rotas-updates');

    // Verificar que on() foi chamado para rotas
    expect(mockOn).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({
        event: '*',
        schema: 'public',
        table: 'rotas',
        filter: 'unidade_id=eq.unit-1',
      }),
      expect.any(Function)
    );

    // Verificar que on() foi chamado para paradas
    expect(mockOn).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({
        event: 'UPDATE',
        schema: 'public',
        table: 'paradas',
      }),
      expect.any(Function)
    );

    // Verificar que subscribe() foi chamado
    expect(mockSubscribe).toHaveBeenCalled();
  });

  it('deve incrementar updateTrigger quando receber evento', async () => {
    const onRouteUpdate = jest.fn();
    const { result } = renderHook(() =>
      useRealtimeRoutes({ enabled: true, onRouteUpdate })
    );

    await waitFor(() => {
      expect(result.current.updateTrigger).toBe(0);
    });

    // Simular evento de mudança
    const rotasCallback = mockOn.mock.calls[0][2];
    rotasCallback({ eventType: 'UPDATE', new: { id: 'rota-1' } });

    await waitFor(() => {
      expect(result.current.updateTrigger).toBe(1);
    });

    expect(onRouteUpdate).toHaveBeenCalled();
  });

  it('não deve criar subscrição quando disabled', () => {
    renderHook(() => useRealtimeRoutes({ enabled: false }));

    const { supabase } = require('@/lib/supabase');
    expect(supabase.channel).not.toHaveBeenCalled();
  });

  it('não deve criar subscrição quando não há unidade_id', () => {
    // Mock sem unidade_id
    jest.spyOn(require('../useUser'), 'useUser').mockReturnValue({
      userData: { id: 'user-1', papel: 'gestor', unidade_id: null },
    });

    renderHook(() => useRealtimeRoutes({ enabled: true }));

    const { supabase } = require('@/lib/supabase');
    expect(supabase.channel).not.toHaveBeenCalled();
  });
});
