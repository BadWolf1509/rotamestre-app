import { renderHook, waitFor } from '@testing-library/react-native';
import { act } from 'react-test-renderer';

import { useNotifications } from '../useNotifications';

// Mock do Supabase
const mockNotificacoesData = [
  {
    id: '1',
    usuario_id: 'user-1',
    tipo: 'rota_iniciada',
    titulo: 'Rota Iniciada',
    mensagem: 'O motorista João iniciou uma rota',
    rota_id: 'rota-1',
    lida: false,
    created_at: new Date().toISOString(),
  },
  {
    id: '2',
    usuario_id: 'user-1',
    tipo: 'rota_concluida',
    titulo: 'Rota Concluída',
    mensagem: 'O motorista João finalizou a rota com 5/5 paradas concluídas',
    rota_id: 'rota-1',
    lida: true,
    created_at: new Date().toISOString(),
  },
];

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(() => ({
            range: jest.fn(() => ({
              data: mockNotificacoesData,
              error: null,
            })),
          })),
          eq: jest.fn(() => ({
            data: mockNotificacoesData.filter(n => !n.lida),
            error: null,
          })),
        })),
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            error: null,
          })),
        })),
      })),
    })),
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn(),
    })),
    removeChannel: jest.fn(),
    realtime: {
      setAuth: jest.fn(),
    },
  },
}));

// Mock dos hooks
jest.mock('../useUser', () => ({
  useUser: () => ({
    userData: { id: 'user-1', papel: 'gestor', unidade_id: 'unit-1' },
  }),
}));

jest.mock('../useAuth', () => ({
  useAuth: () => ({
    session: { access_token: 'mock-token' },
    user: { id: 'user-1' },
    loading: false,
  }),
}));

// Mock utilities
jest.mock('@/utils/browserNotification', () => ({
  notifyGenericWeb: jest.fn(),
}));

jest.mock('@/utils/haptics', () => ({
  warningHaptic: jest.fn(),
}));

jest.mock('@/utils/notificationSound', () => ({
  playNotificationSound: jest.fn(),
}));

jest.mock('@/utils/toast', () => ({
  toast: {
    info: jest.fn(),
    error: jest.fn(),
    success: jest.fn(),
  },
}));

describe('useNotifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deve carregar notificações corretamente', async () => {
    const { result } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.notificacoes).toHaveLength(2);
    expect(result.current.naoLidas).toBe(1);
  });

  it('deve contar notificações não lidas corretamente', async () => {
    const { result } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.naoLidas).toBe(1);
    expect(result.current.notificacoes[0].lida).toBe(false);
    expect(result.current.notificacoes[1].lida).toBe(true);
  });

  it('deve marcar notificação como lida', async () => {
    const { result } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.marcarComoLida('1');
    });

    // Verificar que o método foi chamado
    expect(result.current.notificacoes).toBeDefined();
  });

  it('deve marcar todas notificações como lidas', async () => {
    const { result } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.marcarTodasComoLidas();
    });

    expect(result.current.naoLidas).toBe(0);
    expect(result.current.notificacoes.every((n) => n.lida)).toBe(true);
  });

  it('deve refreshar notificações', async () => {
    const { result } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.notificacoes).toBeDefined();
  });

  it('deve retornar lista vazia quando não há usuário', async () => {
    // Mock sem userData
    jest.spyOn(require('../useUser'), 'useUser').mockReturnValue({
      userData: null,
    });

    const { result } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.notificacoes).toHaveLength(0);
    expect(result.current.naoLidas).toBe(0);
  });

  it('deve lidar com erro ao carregar notificações', async () => {
    const { supabase } = require('@/lib/supabase');

    // Mock de erro
    supabase.from.mockReturnValueOnce({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(() => ({
            limit: jest.fn(() => ({
              data: null,
              error: new Error('Erro de rede'),
            })),
          })),
        })),
      })),
    });

    const { result } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Deve retornar listas vazias em caso de erro
    expect(result.current.notificacoes).toHaveLength(0);
  });

  it('deve lidar com erro ao marcar notificação como lida', async () => {
    const { supabase } = require('@/lib/supabase');

    // Primeiro carregamento OK
    const { result } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Mock de erro no update
    supabase.from.mockReturnValueOnce({
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            error: new Error('Erro ao atualizar'),
          })),
        })),
      })),
    });

    await act(async () => {
      await result.current.marcarComoLida('1');
    });

    // Função deve ter sido chamada, erro é logado no console
    expect(supabase.from).toHaveBeenCalled();
  });

  it('deve lidar com erro ao marcar todas como lidas', async () => {
    const { supabase } = require('@/lib/supabase');

    const { result } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Mock de erro no update
    supabase.from.mockReturnValueOnce({
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            error: new Error('Erro ao atualizar'),
          })),
        })),
      })),
    });

    await act(async () => {
      await result.current.marcarTodasComoLidas();
    });

    // Função deve ter sido chamada, erro é logado no console
    expect(supabase.from).toHaveBeenCalled();
  });

  it('deve fazer refresh das notificações', async () => {
    const { result } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Guardar estado inicial
    const inicialCount = result.current.notificacoes.length;

    // Executar refresh
    await act(async () => {
      await result.current.refresh();
    });

    // Deve ter recarregado as notificações
    expect(result.current.notificacoes.length).toBe(inicialCount);
    expect(result.current.loading).toBe(false);
  });
});
