import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { render, waitFor, act, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { AppState, Text, Pressable } from 'react-native';

import {
  _resetFilaAcoesParada,
  criarAcaoParada,
  enfileirarAcaoParada,
} from '@/lib/motorista/filaAcoesParada';

import {
  RouteStatusProvider,
  useRouteStatus,
  RouteData,
  ParadaData,
} from '../RouteStatusContext';

// Mock useUser
const mockUserData = { id: 'motorista-1', nome: 'Motorista Teste' };
jest.mock('@/hooks/useUser', () => ({
  useUser: () => ({ userData: mockUserData, loading: false }),
}));

// Mock useAuth
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    session: { access_token: 'mock-token' },
    user: { id: 'motorista-1' },
    loading: false,
  }),
}));

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

// Storage for mock data to be returned by supabase
let mockRotasData: any[] | null = null;
let mockRotasConcluidas: any | null = null;
let mockParadasData: any[] | null = null;
let mockUpdateError: any = null;
// Leitura de `rotas` falhando como sem rede (o fetch do cliente devolve erro).
let mockLeituraSemRede = false;

// Track rpc calls (finalizar_rota)
const mockRpcCalls: { fn: string; args: unknown }[] = [];

// Track update calls
const mockUpdateCalls: {
  table: string;
  data: any;
  filter: { column: string; value: string };
}[] = [];

// Mock supabase with configurable responses
jest.mock('@/lib/supabase', () => {
  const mockOn = jest.fn().mockReturnThis();
  const mockSubscribe = jest.fn().mockReturnValue({});
  const mockChannel = jest.fn().mockReturnValue({
    on: mockOn,
    subscribe: mockSubscribe,
  });

  const createQueryMock = (tableName: string) => {
    let _currentFilter: { column: string; value: string } | null = null;
    let updateData: any = null;

    const methods: any = {
      select: jest.fn(() => methods),
      eq: jest.fn((column: string, value: string) => {
        _currentFilter = { column, value };
        return methods;
      }),
      in: jest.fn(() => methods),
      gte: jest.fn(() => methods),
      order: jest.fn(() => methods),
      limit: jest.fn(() => methods),
      single: jest.fn(() => Promise.resolve({ data: null, error: null })),
      maybeSingle: jest.fn(() => {
        if (tableName === 'rotas') {
          return Promise.resolve({ data: mockRotasConcluidas, error: null });
        }
        // Leitura da parada pela fila de ações (`portaParadasSupabase`).
        if (tableName === 'paradas' && _currentFilter?.column === 'id') {
          const parada = (mockParadasData ?? []).find(
            (p) => p.id === _currentFilter?.value,
          );
          const rota = (mockRotasData ?? [])[0];
          return Promise.resolve({
            data: parada
              ? {
                  status: parada.status,
                  rota_id: rota?.id ?? 'rota-1',
                  rotas: rota
                    ? { status: rota.status, motorista_id: 'motorista-1' }
                    : null,
                }
              : null,
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      }),
      returns: jest.fn(function (this: unknown) {
        return this;
      }),
      update: jest.fn((data: any) => {
        updateData = data;
        return {
          eq: jest.fn((column: string, value: string) => {
            mockUpdateCalls.push({
              table: tableName,
              data: updateData,
              filter: { column, value },
            });
            // O "banco" passa a refletir o UPDATE (a próxima leitura vê).
            if (tableName === 'paradas' && !mockUpdateError) {
              const alvo = (mockParadasData ?? []).find((p) => p.id === value);
              if (alvo && updateData.status) alvo.status = updateData.status;
            }
            const resposta = { data: null, error: mockUpdateError };
            // Filtros encadeados (`.eq().eq()…`) e `.select()` com as linhas
            // afetadas: o startRoute condiciona o UPDATE e confere as linhas.
            const linhas = () =>
              Promise.resolve({
                data: mockUpdateError ? null : [{ id: value }],
                error: mockUpdateError,
              });
            const encadeado = (): any => ({
              then: (resolve: any, reject: any) =>
                Promise.resolve(resposta).then(resolve, reject),
              eq: () => encadeado(),
              select: linhas,
              in: () => ({ select: linhas }),
            });
            return encadeado();
          }),
        };
      }),
      then: jest.fn((resolve: any) => {
        if (tableName === 'rotas') {
          resolve({ data: mockRotasData, error: null });
        } else if (tableName === 'paradas') {
          resolve({ data: mockParadasData, error: null });
        } else {
          resolve({ data: null, error: null });
        }
        return { catch: jest.fn() };
      }),
    };

    // Override for async/await pattern
    Object.defineProperty(methods, 'then', {
      value: (resolve: any) => {
        if (tableName === 'rotas' && mockLeituraSemRede) {
          resolve({
            data: null,
            error: { message: 'TypeError: Network request failed' },
          });
        } else if (tableName === 'rotas') {
          resolve({ data: mockRotasData, error: null });
        } else if (tableName === 'paradas') {
          resolve({ data: mockParadasData, error: null });
        } else {
          resolve({ data: null, error: null });
        }
        return { catch: jest.fn() };
      },
    });

    return methods;
  };

  return {
    supabase: {
      from: jest.fn((tableName: string) => createQueryMock(tableName)),
      rpc: jest.fn((fn: string, args: unknown) => {
        mockRpcCalls.push({ fn, args });
        return Promise.resolve({ data: null, error: null });
      }),
      channel: mockChannel,
      removeChannel: jest.fn(),
      // A fila de ações só envia com a sessão do dono.
      auth: {
        getSession: jest.fn(async () => ({
          data: { session: { user: { id: 'motorista-1' } } },
        })),
      },
      realtime: {
        setAuth: jest.fn(),
      },
    },
  };
});

// Mock utilities used by RouteStatusContext
jest.mock('@/utils/browserNotification', () => ({
  notifyNewRouteWeb: jest.fn(),
}));

jest.mock('@/utils/haptics', () => ({
  warningHaptic: jest.fn(),
  successHaptic: jest.fn(),
}));

jest.mock('@/utils/notificationSound', () => ({
  playNotificationSound: jest.fn(),
}));

jest.mock('@/lib/notifications', () => ({}));

jest.mock('@/services/unifiedLocationTracking', () => ({
  startBackgroundTracking: jest.fn(),
  stopBackgroundTracking: jest.fn(),
  requestAndStartTracking: jest.fn(),
  garantirRastreamentoDaRota: jest.fn().mockResolvedValue('ativo'),
  getTrackingContext: jest.fn().mockResolvedValue(null),
  isBackgroundTrackingActive: jest.fn().mockResolvedValue(false),
}));

// Helper to create mock route data
const createMockRoute = (overrides: Partial<RouteData> = {}): RouteData => ({
  id: 'rota-1',
  unidade_id: 'unidade-1',
  status: 'pendente',
  unidade_nome: 'Unidade Teste',
  distancia_total: 10000,
  tempo_total: 3600,
  data: '2025-01-05',
  created_at: '2025-01-05T08:00:00Z',
  ...overrides,
});

// Helper to create mock parada data
const createMockParada = (overrides: Partial<ParadaData> = {}): ParadaData => ({
  id: 'parada-1',
  endereco: 'Rua Teste, 123',
  ordem: 1,
  status: 'pendente',
  tipo: 'entrega',
  latitude: -23.5505,
  longitude: -46.6333,
  is_checkpoint: true,
  ...overrides,
});

// Test component to access context
function TestComponent() {
  const {
    routeStatus,
    route,
    paradas,
    currentStop,
    nextStop,
    progress,
    loading,
    pendingRoutesCount,
  } = useRouteStatus();

  return (
    <>
      <Text testID="status">{routeStatus}</Text>
      <Text testID="loading">{loading.toString()}</Text>
      <Text testID="route">{route ? route.id : 'null'}</Text>
      <Text testID="routeStatus">{route ? route.status : 'null'}</Text>
      <Text testID="paradas">{paradas.length}</Text>
      <Text testID="currentStop">{currentStop ? currentStop.id : 'null'}</Text>
      <Text testID="nextStop">{nextStop ? nextStop.id : 'null'}</Text>
      <Text testID="progressPercentage">{progress.percentage}</Text>
      <Text testID="progressCompleted">{progress.completed}</Text>
      <Text testID="progressTotal">{progress.total}</Text>
      <Text testID="pendingRoutesCount">{pendingRoutesCount}</Text>
    </>
  );
}

// Test component with action buttons
function TestComponentWithActions({
  onError,
}: {
  onError?: (e: Error) => void;
}) {
  const {
    startRoute,
    completeStop,
    skipStop,
    completeRoute,
    refreshRoute,
    route,
    routeStatus,
  } = useRouteStatus();

  const handleStartRoute = async () => {
    try {
      await startRoute();
    } catch (e) {
      onError?.(e as Error);
    }
  };

  const handleCompleteStop = async () => {
    try {
      await completeStop('parada-1', 'https://foto.url/test.jpg');
    } catch (e) {
      onError?.(e as Error);
    }
  };

  const handleSkipStop = async () => {
    try {
      await skipStop('parada-1', 'cliente_ausente');
    } catch (e) {
      onError?.(e as Error);
    }
  };

  const handleCompleteRoute = async () => {
    try {
      await completeRoute();
    } catch (e) {
      onError?.(e as Error);
    }
  };

  return (
    <>
      <Text testID="routeStatus">{routeStatus}</Text>
      <Text testID="routeId">{route?.id || 'null'}</Text>
      <Text testID="routeDbStatus">{route?.status || 'null'}</Text>
      <Pressable testID="startRoute" onPress={handleStartRoute}>
        <Text>Start</Text>
      </Pressable>
      <Pressable testID="completeStop" onPress={handleCompleteStop}>
        <Text>Complete</Text>
      </Pressable>
      <Pressable testID="skipStop" onPress={handleSkipStop}>
        <Text>Skip</Text>
      </Pressable>
      <Pressable testID="completeRoute" onPress={handleCompleteRoute}>
        <Text>Complete Route</Text>
      </Pressable>
      <Pressable testID="refreshRoute" onPress={() => refreshRoute()}>
        <Text>Refresh</Text>
      </Pressable>
    </>
  );
}

describe('RouteStatusContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRotasData = null;
    mockRotasConcluidas = null;
    mockParadasData = null;
    mockUpdateError = null;
    mockUpdateCalls.length = 0;
    mockRpcCalls.length = 0;
  });

  describe('Initial state', () => {
    it('deve iniciar com status no-route quando nao ha rota', async () => {
      const { getByTestId } = render(
        <RouteStatusProvider>
          <TestComponent />
        </RouteStatusProvider>,
      );

      await waitFor(() => {
        expect(getByTestId('loading').props.children).toBe('false');
      });

      expect(getByTestId('status').props.children).toBe('no-route');
    });

    it('deve iniciar com loading true', () => {
      const { getByTestId } = render(
        <RouteStatusProvider>
          <TestComponent />
        </RouteStatusProvider>,
      );

      // Initially loading should be true
      expect(getByTestId('loading')).toBeTruthy();
    });
  });

  describe('Route loading', () => {
    it('deve renderizar componentes filhos', async () => {
      const { getByTestId } = render(
        <RouteStatusProvider>
          <TestComponent />
        </RouteStatusProvider>,
      );

      await waitFor(() => {
        expect(getByTestId('status')).toBeTruthy();
      });
    });

    it('deve ter props de progresso', async () => {
      const { getByTestId } = render(
        <RouteStatusProvider>
          <TestComponent />
        </RouteStatusProvider>,
      );

      await waitFor(() => {
        expect(getByTestId('progressPercentage')).toBeTruthy();
      });
    });
  });

  describe('getRouteStatus() - Business Logic', () => {
    it('deve retornar "no-route" quando route é null', async () => {
      mockRotasData = null;

      const { getByTestId } = render(
        <RouteStatusProvider>
          <TestComponent />
        </RouteStatusProvider>,
      );

      await waitFor(() => {
        expect(getByTestId('loading').props.children).toBe('false');
      });

      expect(getByTestId('status').props.children).toBe('no-route');
    });

    it('deve retornar "pending" quando route.status === "pendente"', async () => {
      mockRotasData = [createMockRoute({ status: 'pendente' })];
      mockParadasData = [createMockParada()];

      const { getByTestId } = render(
        <RouteStatusProvider>
          <TestComponent />
        </RouteStatusProvider>,
      );

      await waitFor(() => {
        expect(getByTestId('loading').props.children).toBe('false');
      });

      expect(getByTestId('status').props.children).toBe('pending');
    });

    it('deve retornar "ready-to-complete" quando em_andamento com 0 paradas pendentes', async () => {
      mockRotasData = [createMockRoute({ status: 'em_andamento' })];
      mockParadasData = [
        createMockParada({
          id: 'p1',
          ordem: 1,
          status: 'concluida',
          is_checkpoint: true,
        }),
        createMockParada({
          id: 'p2',
          ordem: 2,
          status: 'concluida',
          is_checkpoint: true,
        }),
      ];

      const { getByTestId } = render(
        <RouteStatusProvider>
          <TestComponent />
        </RouteStatusProvider>,
      );

      await waitFor(() => {
        expect(getByTestId('loading').props.children).toBe('false');
      });

      expect(getByTestId('status').props.children).toBe('ready-to-complete');
    });

    it('religa o rastreamento em segundo plano ao montar com rota em andamento', async () => {
      const { garantirRastreamentoDaRota } = jest.requireMock(
        '@/services/unifiedLocationTracking',
      );
      mockRotasData = [createMockRoute({ status: 'em_andamento' })];
      mockParadasData = [];

      render(
        <RouteStatusProvider>
          <TestComponent />
        </RouteStatusProvider>,
      );

      await waitFor(() => {
        expect(garantirRastreamentoDaRota).toHaveBeenCalledWith(
          expect.objectContaining({ rotaId: 'rota-1' }),
        );
      });
    });

    it('desliga o rastreamento quando a rota carregada já está concluída', async () => {
      const { getTrackingContext, stopBackgroundTracking } = jest.requireMock(
        '@/services/unifiedLocationTracking',
      );
      const contexto = {
        rotaId: 'rota-1',
        motoristaId: 'motorista-1',
        motoristaNome: 'Ana',
        startedAt: '2026-10-24T10:00:00Z',
      };
      // Lido duas vezes: antes de decidir e de novo logo antes do stop.
      getTrackingContext
        .mockResolvedValueOnce(contexto)
        .mockResolvedValueOnce(contexto);
      // Concluída pela web há 30 min: chega pela consulta das concluídas
      mockRotasData = [];
      mockRotasConcluidas = createMockRoute({
        status: 'concluida',
        concluida_em: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      });
      mockParadasData = [];

      render(
        <RouteStatusProvider>
          <TestComponent />
        </RouteStatusProvider>,
      );

      await waitFor(() => {
        expect(stopBackgroundTracking).toHaveBeenCalled();
      });
    });

    it('deve retornar "last-stop" quando em_andamento com 1 parada pendente', async () => {
      mockRotasData = [createMockRoute({ status: 'em_andamento' })];
      mockParadasData = [
        createMockParada({
          id: 'p1',
          ordem: 1,
          status: 'concluida',
          is_checkpoint: true,
        }),
        createMockParada({
          id: 'p2',
          ordem: 2,
          status: 'pendente',
          is_checkpoint: true,
        }),
      ];

      const { getByTestId } = render(
        <RouteStatusProvider>
          <TestComponent />
        </RouteStatusProvider>,
      );

      await waitFor(() => {
        expect(getByTestId('loading').props.children).toBe('false');
      });

      expect(getByTestId('status').props.children).toBe('last-stop');
    });

    it('deve retornar "last-stop" quando em_andamento com 1 parada em_andamento', async () => {
      mockRotasData = [createMockRoute({ status: 'em_andamento' })];
      mockParadasData = [
        createMockParada({
          id: 'p1',
          ordem: 1,
          status: 'concluida',
          is_checkpoint: true,
        }),
        createMockParada({
          id: 'p2',
          ordem: 2,
          status: 'em_andamento',
          is_checkpoint: true,
        }),
      ];

      const { getByTestId } = render(
        <RouteStatusProvider>
          <TestComponent />
        </RouteStatusProvider>,
      );

      await waitFor(() => {
        expect(getByTestId('loading').props.children).toBe('false');
      });

      expect(getByTestId('status').props.children).toBe('last-stop');
    });

    it('deve retornar "active" quando em_andamento com 2+ paradas pendentes', async () => {
      mockRotasData = [createMockRoute({ status: 'em_andamento' })];
      mockParadasData = [
        createMockParada({
          id: 'p1',
          ordem: 1,
          status: 'concluida',
          is_checkpoint: true,
        }),
        createMockParada({
          id: 'p2',
          ordem: 2,
          status: 'pendente',
          is_checkpoint: true,
        }),
        createMockParada({
          id: 'p3',
          ordem: 3,
          status: 'pendente',
          is_checkpoint: true,
        }),
      ];

      const { getByTestId } = render(
        <RouteStatusProvider>
          <TestComponent />
        </RouteStatusProvider>,
      );

      await waitFor(() => {
        expect(getByTestId('loading').props.children).toBe('false');
      });

      expect(getByTestId('status').props.children).toBe('active');
    });

    it('deve retornar "active" quando em_andamento com mix de pendente e em_andamento', async () => {
      mockRotasData = [createMockRoute({ status: 'em_andamento' })];
      mockParadasData = [
        createMockParada({
          id: 'p1',
          ordem: 1,
          status: 'concluida',
          is_checkpoint: true,
        }),
        createMockParada({
          id: 'p2',
          ordem: 2,
          status: 'em_andamento',
          is_checkpoint: true,
        }),
        createMockParada({
          id: 'p3',
          ordem: 3,
          status: 'pendente',
          is_checkpoint: true,
        }),
      ];

      const { getByTestId } = render(
        <RouteStatusProvider>
          <TestComponent />
        </RouteStatusProvider>,
      );

      await waitFor(() => {
        expect(getByTestId('loading').props.children).toBe('false');
      });

      expect(getByTestId('status').props.children).toBe('active');
    });

    it('deve retornar "completed" quando concluida dentro de 1h', async () => {
      const agora = new Date();
      const trintaMinutosAtras = new Date(
        agora.getTime() - 30 * 60 * 1000,
      ).toISOString();

      // No active routes
      mockRotasData = [];
      // Completed route from maybeSingle
      mockRotasConcluidas = createMockRoute({
        status: 'concluida',
        concluida_em: trintaMinutosAtras,
      });
      mockParadasData = [
        createMockParada({
          id: 'p1',
          ordem: 1,
          status: 'concluida',
          is_checkpoint: true,
        }),
      ];

      const { getByTestId } = render(
        <RouteStatusProvider>
          <TestComponent />
        </RouteStatusProvider>,
      );

      await waitFor(() => {
        expect(getByTestId('loading').props.children).toBe('false');
      });

      expect(getByTestId('status').props.children).toBe('completed');
    });

    it('deve retornar "no-route" quando concluida apos 1h', async () => {
      const agora = new Date();
      const _duasHorasAtras = new Date(
        agora.getTime() - 2 * 60 * 60 * 1000,
      ).toISOString();

      // No active routes
      mockRotasData = [];
      // Completed route older than 1h - should not be returned by query
      // (the query filters with gte so this wouldn't be returned)
      mockRotasConcluidas = null;
      mockParadasData = [];

      const { getByTestId } = render(
        <RouteStatusProvider>
          <TestComponent />
        </RouteStatusProvider>,
      );

      await waitFor(() => {
        expect(getByTestId('loading').props.children).toBe('false');
      });

      expect(getByTestId('status').props.children).toBe('no-route');
    });

    it('deve ignorar checkpoints (is_checkpoint=false) ao calcular paradas pendentes', async () => {
      mockRotasData = [createMockRoute({ status: 'em_andamento' })];
      mockParadasData = [
        // Checkpoint de partida (ignorado)
        createMockParada({
          id: 'checkpoint-partida',
          ordem: 0,
          status: 'pendente',
          is_checkpoint: false,
        }),
        // Paradas reais
        createMockParada({
          id: 'p1',
          ordem: 1,
          status: 'concluida',
          is_checkpoint: true,
        }),
        createMockParada({
          id: 'p2',
          ordem: 2,
          status: 'pendente',
          is_checkpoint: true,
        }),
        // Checkpoint de chegada (ignorado)
        createMockParada({
          id: 'checkpoint-chegada',
          ordem: 99,
          status: 'pendente',
          is_checkpoint: false,
        }),
      ];

      const { getByTestId } = render(
        <RouteStatusProvider>
          <TestComponent />
        </RouteStatusProvider>,
      );

      await waitFor(() => {
        expect(getByTestId('loading').props.children).toBe('false');
      });

      // Apenas 1 parada real pendente -> last-stop
      expect(getByTestId('status').props.children).toBe('last-stop');
    });

    it('deve retornar "no-route" para status desconhecido', async () => {
      mockRotasData = [createMockRoute({ status: 'cancelada' })];
      mockParadasData = [];

      const { getByTestId } = render(
        <RouteStatusProvider>
          <TestComponent />
        </RouteStatusProvider>,
      );

      await waitFor(() => {
        expect(getByTestId('loading').props.children).toBe('false');
      });

      // 'cancelada' is not in ['pendente', 'em_andamento'] so won't be loaded
      expect(getByTestId('status').props.children).toBe('no-route');
    });
  });

  describe('getProgress() - Progress Calculation', () => {
    it('deve calcular progresso 0% sem paradas', async () => {
      mockRotasData = [createMockRoute({ status: 'em_andamento' })];
      mockParadasData = [];

      const { getByTestId } = render(
        <RouteStatusProvider>
          <TestComponent />
        </RouteStatusProvider>,
      );

      await waitFor(() => {
        expect(getByTestId('loading').props.children).toBe('false');
      });

      expect(getByTestId('progressPercentage').props.children).toBe(0);
      expect(getByTestId('progressCompleted').props.children).toBe(0);
      expect(getByTestId('progressTotal').props.children).toBe(0);
    });

    it('deve calcular progresso excluindo checkpoints', async () => {
      mockRotasData = [createMockRoute({ status: 'em_andamento' })];
      mockParadasData = [
        // Checkpoint partida (is_checkpoint=false, deve ser ignorado)
        createMockParada({
          id: 'cp1',
          ordem: 0,
          status: 'concluida',
          is_checkpoint: false,
        }),
        // Paradas reais
        createMockParada({
          id: 'p1',
          ordem: 1,
          status: 'concluida',
          is_checkpoint: true,
        }),
        createMockParada({
          id: 'p2',
          ordem: 2,
          status: 'concluida',
          is_checkpoint: true,
        }),
        createMockParada({
          id: 'p3',
          ordem: 3,
          status: 'pendente',
          is_checkpoint: true,
        }),
        createMockParada({
          id: 'p4',
          ordem: 4,
          status: 'pendente',
          is_checkpoint: true,
        }),
        // Checkpoint chegada (is_checkpoint=false, deve ser ignorado)
        createMockParada({
          id: 'cp2',
          ordem: 99,
          status: 'pendente',
          is_checkpoint: false,
        }),
      ];

      const { getByTestId } = render(
        <RouteStatusProvider>
          <TestComponent />
        </RouteStatusProvider>,
      );

      await waitFor(() => {
        expect(getByTestId('loading').props.children).toBe('false');
      });

      // 2 concluídas de 4 reais = 50%
      expect(getByTestId('progressCompleted').props.children).toBe(2);
      expect(getByTestId('progressTotal').props.children).toBe(4);
      expect(getByTestId('progressPercentage').props.children).toBe(50);
    });

    it('deve calcular progresso 100% quando todas concluidas', async () => {
      mockRotasData = [createMockRoute({ status: 'em_andamento' })];
      mockParadasData = [
        createMockParada({
          id: 'p1',
          ordem: 1,
          status: 'concluida',
          is_checkpoint: true,
        }),
        createMockParada({
          id: 'p2',
          ordem: 2,
          status: 'concluida',
          is_checkpoint: true,
        }),
        createMockParada({
          id: 'p3',
          ordem: 3,
          status: 'concluida',
          is_checkpoint: true,
        }),
      ];

      const { getByTestId } = render(
        <RouteStatusProvider>
          <TestComponent />
        </RouteStatusProvider>,
      );

      await waitFor(() => {
        expect(getByTestId('loading').props.children).toBe('false');
      });

      expect(getByTestId('progressCompleted').props.children).toBe(3);
      expect(getByTestId('progressTotal').props.children).toBe(3);
      expect(getByTestId('progressPercentage').props.children).toBe(100);
    });

    it('deve arredondar porcentagem para inteiro', async () => {
      mockRotasData = [createMockRoute({ status: 'em_andamento' })];
      mockParadasData = [
        createMockParada({
          id: 'p1',
          ordem: 1,
          status: 'concluida',
          is_checkpoint: true,
        }),
        createMockParada({
          id: 'p2',
          ordem: 2,
          status: 'pendente',
          is_checkpoint: true,
        }),
        createMockParada({
          id: 'p3',
          ordem: 3,
          status: 'pendente',
          is_checkpoint: true,
        }),
      ];

      const { getByTestId } = render(
        <RouteStatusProvider>
          <TestComponent />
        </RouteStatusProvider>,
      );

      await waitFor(() => {
        expect(getByTestId('loading').props.children).toBe('false');
      });

      // 1/3 = 33.33...% -> arredonda para 33
      expect(getByTestId('progressPercentage').props.children).toBe(33);
    });

    it('deve tratar paradas com is_checkpoint undefined como parada real', async () => {
      mockRotasData = [createMockRoute({ status: 'em_andamento' })];
      mockParadasData = [
        createMockParada({
          id: 'p1',
          ordem: 1,
          status: 'concluida',
          is_checkpoint: undefined,
        }),
        createMockParada({
          id: 'p2',
          ordem: 2,
          status: 'pendente',
          is_checkpoint: undefined,
        }),
      ];

      const { getByTestId } = render(
        <RouteStatusProvider>
          <TestComponent />
        </RouteStatusProvider>,
      );

      await waitFor(() => {
        expect(getByTestId('loading').props.children).toBe('false');
      });

      // undefined !== false, então são tratadas como paradas reais
      expect(getByTestId('progressCompleted').props.children).toBe(1);
      expect(getByTestId('progressTotal').props.children).toBe(2);
      expect(getByTestId('progressPercentage').props.children).toBe(50);
    });
  });

  describe('getCurrentStop() e getNextStop() - Stop Navigation', () => {
    it('deve retornar null quando não há paradas', async () => {
      mockRotasData = [createMockRoute({ status: 'em_andamento' })];
      mockParadasData = [];

      const { getByTestId } = render(
        <RouteStatusProvider>
          <TestComponent />
        </RouteStatusProvider>,
      );

      await waitFor(() => {
        expect(getByTestId('loading').props.children).toBe('false');
      });

      expect(getByTestId('currentStop').props.children).toBe('null');
      expect(getByTestId('nextStop').props.children).toBe('null');
    });

    it('deve retornar parada em_andamento como currentStop', async () => {
      mockRotasData = [createMockRoute({ status: 'em_andamento' })];
      mockParadasData = [
        createMockParada({
          id: 'p1',
          ordem: 1,
          status: 'concluida',
          is_checkpoint: true,
        }),
        createMockParada({
          id: 'p2',
          ordem: 2,
          status: 'em_andamento',
          is_checkpoint: true,
        }),
        createMockParada({
          id: 'p3',
          ordem: 3,
          status: 'pendente',
          is_checkpoint: true,
        }),
      ];

      const { getByTestId } = render(
        <RouteStatusProvider>
          <TestComponent />
        </RouteStatusProvider>,
      );

      await waitFor(() => {
        expect(getByTestId('loading').props.children).toBe('false');
      });

      expect(getByTestId('currentStop').props.children).toBe('p2');
      expect(getByTestId('nextStop').props.children).toBe('p3');
    });

    it('deve retornar primeira pendente como currentStop se nenhuma em_andamento', async () => {
      mockRotasData = [createMockRoute({ status: 'em_andamento' })];
      mockParadasData = [
        createMockParada({
          id: 'p1',
          ordem: 1,
          status: 'concluida',
          is_checkpoint: true,
        }),
        createMockParada({
          id: 'p2',
          ordem: 2,
          status: 'pendente',
          is_checkpoint: true,
        }),
        createMockParada({
          id: 'p3',
          ordem: 3,
          status: 'pendente',
          is_checkpoint: true,
        }),
      ];

      const { getByTestId } = render(
        <RouteStatusProvider>
          <TestComponent />
        </RouteStatusProvider>,
      );

      await waitFor(() => {
        expect(getByTestId('loading').props.children).toBe('false');
      });

      expect(getByTestId('currentStop').props.children).toBe('p2');
      expect(getByTestId('nextStop').props.children).toBe('p3');
    });

    it('deve ordenar paradas por ordem antes de selecionar', async () => {
      mockRotasData = [createMockRoute({ status: 'em_andamento' })];
      // Paradas fora de ordem no array
      mockParadasData = [
        createMockParada({
          id: 'p3',
          ordem: 3,
          status: 'pendente',
          is_checkpoint: true,
        }),
        createMockParada({
          id: 'p1',
          ordem: 1,
          status: 'concluida',
          is_checkpoint: true,
        }),
        createMockParada({
          id: 'p2',
          ordem: 2,
          status: 'pendente',
          is_checkpoint: true,
        }),
      ];

      const { getByTestId } = render(
        <RouteStatusProvider>
          <TestComponent />
        </RouteStatusProvider>,
      );

      await waitFor(() => {
        expect(getByTestId('loading').props.children).toBe('false');
      });

      // Deve pegar p2 (ordem 2) como current, não p3 (ordem 3)
      expect(getByTestId('currentStop').props.children).toBe('p2');
      expect(getByTestId('nextStop').props.children).toBe('p3');
    });

    it('deve ignorar checkpoints ao selecionar current/next stop', async () => {
      mockRotasData = [createMockRoute({ status: 'em_andamento' })];
      mockParadasData = [
        createMockParada({
          id: 'checkpoint',
          ordem: 0,
          status: 'pendente',
          is_checkpoint: false,
        }),
        createMockParada({
          id: 'p1',
          ordem: 1,
          status: 'pendente',
          is_checkpoint: true,
        }),
        createMockParada({
          id: 'p2',
          ordem: 2,
          status: 'pendente',
          is_checkpoint: true,
        }),
      ];

      const { getByTestId } = render(
        <RouteStatusProvider>
          <TestComponent />
        </RouteStatusProvider>,
      );

      await waitFor(() => {
        expect(getByTestId('loading').props.children).toBe('false');
      });

      // Checkpoint deve ser ignorado
      expect(getByTestId('currentStop').props.children).toBe('p1');
      expect(getByTestId('nextStop').props.children).toBe('p2');
    });

    it('deve retornar null para nextStop se não há mais pendentes', async () => {
      mockRotasData = [createMockRoute({ status: 'em_andamento' })];
      mockParadasData = [
        createMockParada({
          id: 'p1',
          ordem: 1,
          status: 'concluida',
          is_checkpoint: true,
        }),
        createMockParada({
          id: 'p2',
          ordem: 2,
          status: 'em_andamento',
          is_checkpoint: true,
        }),
      ];

      const { getByTestId } = render(
        <RouteStatusProvider>
          <TestComponent />
        </RouteStatusProvider>,
      );

      await waitFor(() => {
        expect(getByTestId('loading').props.children).toBe('false');
      });

      expect(getByTestId('currentStop').props.children).toBe('p2');
      expect(getByTestId('nextStop').props.children).toBe('null');
    });

    it('deve retornar null para currentStop se todas concluidas', async () => {
      mockRotasData = [createMockRoute({ status: 'em_andamento' })];
      mockParadasData = [
        createMockParada({
          id: 'p1',
          ordem: 1,
          status: 'concluida',
          is_checkpoint: true,
        }),
        createMockParada({
          id: 'p2',
          ordem: 2,
          status: 'concluida',
          is_checkpoint: true,
        }),
      ];

      const { getByTestId } = render(
        <RouteStatusProvider>
          <TestComponent />
        </RouteStatusProvider>,
      );

      await waitFor(() => {
        expect(getByTestId('loading').props.children).toBe('false');
      });

      expect(getByTestId('currentStop').props.children).toBe('null');
      expect(getByTestId('nextStop').props.children).toBe('null');
    });
  });

  describe('Pending Routes Count', () => {
    it('deve contar outras rotas pendentes além da atual', async () => {
      mockRotasData = [
        createMockRoute({
          id: 'rota-1',
          status: 'pendente',
          data: '2025-01-05',
        }),
        createMockRoute({
          id: 'rota-2',
          status: 'pendente',
          data: '2025-01-06',
        }),
        createMockRoute({
          id: 'rota-3',
          status: 'pendente',
          data: '2025-01-07',
        }),
      ];
      mockParadasData = [];

      const { getByTestId } = render(
        <RouteStatusProvider>
          <TestComponent />
        </RouteStatusProvider>,
      );

      await waitFor(() => {
        expect(getByTestId('loading').props.children).toBe('false');
      });

      // 3 pendentes - 1 (a atual) = 2 outras pendentes
      expect(getByTestId('pendingRoutesCount').props.children).toBe(2);
    });

    it('deve contar todas pendentes quando há rota em_andamento', async () => {
      mockRotasData = [
        createMockRoute({
          id: 'rota-1',
          status: 'em_andamento',
          data: '2025-01-05',
        }),
        createMockRoute({
          id: 'rota-2',
          status: 'pendente',
          data: '2025-01-06',
        }),
        createMockRoute({
          id: 'rota-3',
          status: 'pendente',
          data: '2025-01-07',
        }),
      ];
      mockParadasData = [];

      const { getByTestId } = render(
        <RouteStatusProvider>
          <TestComponent />
        </RouteStatusProvider>,
      );

      await waitFor(() => {
        expect(getByTestId('loading').props.children).toBe('false');
      });

      // em_andamento é selecionada, todas pendentes contam
      expect(getByTestId('pendingRoutesCount').props.children).toBe(2);
    });

    it('deve retornar 0 quando não há outras rotas pendentes', async () => {
      mockRotasData = [createMockRoute({ id: 'rota-1', status: 'pendente' })];
      mockParadasData = [];

      const { getByTestId } = render(
        <RouteStatusProvider>
          <TestComponent />
        </RouteStatusProvider>,
      );

      await waitFor(() => {
        expect(getByTestId('loading').props.children).toBe('false');
      });

      expect(getByTestId('pendingRoutesCount').props.children).toBe(0);
    });
  });

  describe('Realtime subscription', () => {
    it('deve renderizar sem erros', async () => {
      const { getByTestId } = render(
        <RouteStatusProvider>
          <TestComponent />
        </RouteStatusProvider>,
      );

      await waitFor(() => {
        expect(getByTestId('status')).toBeTruthy();
      });
    });
  });

  describe('useRouteStatus hook', () => {
    it('deve retornar contexto quando usado dentro do Provider', async () => {
      const { getByTestId } = render(
        <RouteStatusProvider>
          <TestComponent />
        </RouteStatusProvider>,
      );

      await waitFor(() => {
        expect(getByTestId('status')).toBeTruthy();
      });
    });

    it('deve funcionar corretamente dentro do Provider', async () => {
      const { getByTestId } = render(
        <RouteStatusProvider>
          <TestComponent />
        </RouteStatusProvider>,
      );

      await waitFor(() => {
        expect(getByTestId('paradas')).toBeTruthy();
      });
    });
  });
});

describe('RouteStatusContext com ações na fila offline', () => {
  const memoria = new Map<string, string>();

  function EnvioPendente() {
    const { paradasComEnvioPendente, progress } = useRouteStatus();
    return (
      <>
        <Text testID="pendentes">
          {[...(paradasComEnvioPendente ?? [])].join(',') || 'nenhuma'}
        </Text>
        <Text testID="concluidas">{progress.completed}</Text>
      </>
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    memoria.clear();
    _resetFilaAcoesParada();
    (AsyncStorage.getItem as jest.Mock).mockImplementation(
      async (k: string) => memoria.get(k) ?? null,
    );
    (AsyncStorage.setItem as jest.Mock).mockImplementation(
      async (k: string, v: string) => {
        memoria.set(k, v);
      },
    );
    mockRotasData = [createMockRoute({ status: 'em_andamento' })];
    mockParadasData = [
      createMockParada({ id: 'parada-1', ordem: 1, status: 'em_andamento' }),
      createMockParada({ id: 'parada-2', ordem: 2, status: 'pendente' }),
    ];
    mockUpdateCalls.length = 0;
    mockLeituraSemRede = false;
    // O `clearAllMocks` não desfaz o valor do NetInfo: sem isto, o "sem rede"
    // de um teste vazava para o seguinte.
    ficarOnline();
  });

  /**
   * Uma sessão anterior carregou com rede e guardou a rota no aparelho. Sem
   * rede confirmada (NetInfo `isConnected === false`) a carga nem consulta o
   * banco e usa esse retrato — o banco falso respondendo "sem rede" não é um
   * cenário real.
   */
  async function guardarRotaComRede() {
    ficarOnline();
    const anterior = render(
      <RouteStatusProvider>
        <EnvioPendente />
      </RouteStatusProvider>,
    );
    await waitFor(() => {
      expect(memoria.has('@rotamestre:rota_guardada')).toBe(true);
    });
    anterior.unmount();
  }

  afterAll(() => {
    mockLeituraSemRede = false;
    (AsyncStorage.getItem as jest.Mock).mockImplementation(() =>
      Promise.resolve(null),
    );
    (AsyncStorage.setItem as jest.Mock).mockImplementation(() =>
      Promise.resolve(null),
    );
  });

  async function enfileirarConclusaoDaParada1() {
    await enfileirarAcaoParada(
      criarAcaoParada({
        tipo: 'concluir',
        paradaId: 'parada-1',
        rotaId: 'rota-1',
        motoristaId: 'motorista-1',
        em: '2026-10-23T12:00:00.000Z',
      }),
    );
  }

  it('sem rede: a parada guardada aparece concluída e marcada como envio pendente', async () => {
    await guardarRotaComRede();
    (NetInfo.fetch as jest.Mock).mockResolvedValue({
      isConnected: false,
      isInternetReachable: false,
    });
    await enfileirarConclusaoDaParada1();

    const { getByTestId } = render(
      <RouteStatusProvider>
        <EnvioPendente />
      </RouteStatusProvider>,
    );

    await waitFor(() => {
      expect(getByTestId('pendentes').props.children).toBe('parada-1');
    });
    expect(getByTestId('concluidas').props.children).toBe(1);
    expect(mockUpdateCalls).toHaveLength(0);
  });

  it('reaberto do zero sem rede: rota guardada na tela, com a fila por cima', async () => {
    // Sessão anterior (outro processo): carregou com rede e guardou a rota.
    const primeira = render(
      <RouteStatusProvider>
        <EnvioPendente />
      </RouteStatusProvider>,
    );
    await waitFor(() => {
      expect(memoria.has('@rotamestre:rota_guardada')).toBe(true);
    });
    primeira.unmount();

    // Sem rede: concluiu a parada 1 (fila), e o processo morreu.
    (NetInfo.fetch as jest.Mock).mockResolvedValue({
      isConnected: false,
      isInternetReachable: false,
    });
    await enfileirarConclusaoDaParada1();
    _resetFilaAcoesParada(); // memória do processo novo: só o disco sobra
    mockLeituraSemRede = true;

    function RotaNaTela() {
      const { route, paradas, error, atualizadoEm } = useRouteStatus();
      return (
        <>
          <Text testID="rota">{route?.id ?? 'nenhuma'}</Text>
          <Text testID="parada-1">
            {paradas.find((p) => p.id === 'parada-1')?.status ?? '-'}
          </Text>
          <Text testID="dados-de">
            {error && atualizadoEm !== null ? 'com-hora' : 'sem-hora'}
          </Text>
        </>
      );
    }
    const { getByTestId } = render(
      <RouteStatusProvider>
        <RotaNaTela />
        <EnvioPendente />
      </RouteStatusProvider>,
    );

    await waitFor(() => {
      expect(getByTestId('rota').props.children).toBe('rota-1');
    });
    expect(getByTestId('dados-de').props.children).toBe('com-hora');
    await waitFor(() => {
      expect(getByTestId('parada-1').props.children).toBe('concluida');
    });
    expect(getByTestId('pendentes').props.children).toBe('parada-1');
  });

  // Ação que foi para a fila com o NetInfo "conectado" (timeout em sinal
  // fraco) não tem mudança de rede para dispará-la: estes gatilhos cobrem.
  function ficarOffline() {
    (NetInfo.fetch as jest.Mock).mockResolvedValue({
      isConnected: false,
      isInternetReachable: false,
    });
  }
  function ficarOnline() {
    (NetInfo.fetch as jest.Mock).mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    });
  }
  const enviouParada1 = () =>
    mockUpdateCalls.some(
      (c) => c.filter.value === 'parada-1' && c.data.status === 'concluida',
    );

  it('voltar ao primeiro plano envia a fila', async () => {
    // Embrulha o addEventListener de verdade (sem trocar o retorno), só para
    // poder disparar o 'active' depois.
    const ouvintes: ((estado: string) => void)[] = [];
    const original = AppState.addEventListener;
    AppState.addEventListener = ((tipo: 'change', fn: (e: string) => void) => {
      ouvintes.push(fn);
      return original.call(AppState, tipo, fn as never);
    }) as typeof AppState.addEventListener;
    await guardarRotaComRede();
    ficarOffline();
    await enfileirarConclusaoDaParada1();
    const { getByTestId, unmount } = render(
      <RouteStatusProvider>
        <EnvioPendente />
      </RouteStatusProvider>,
    );
    await waitFor(() => {
      expect(getByTestId('pendentes').props.children).toBe('parada-1');
    });
    expect(enviouParada1()).toBe(false);

    ficarOnline();
    await act(async () => {
      ouvintes.forEach((fn) => fn('active'));
    });

    await waitFor(() => expect(enviouParada1()).toBe(true));
    unmount();
    AppState.addEventListener = original;
  });

  it('puxar para atualizar envia a fila', async () => {
    ficarOffline();
    await enfileirarConclusaoDaParada1();
    let atualizar: () => Promise<void> = async () => undefined;
    function Captura() {
      atualizar = useRouteStatus().refreshRoute;
      return null;
    }
    render(
      <RouteStatusProvider>
        <Captura />
      </RouteStatusProvider>,
    );
    await waitFor(() => expect(mockRotasData).toBeTruthy());

    ficarOnline();
    await act(async () => {
      await atualizar();
    });

    await waitFor(() => expect(enviouParada1()).toBe(true));
  });

  // A fila esvazia (enviada) e a recarga que viria confirmar falha (sinal
  // fraco: o UPDATE passou, a leitura não). A parada não pode voltar a
  // "pendente" — nem na tela, nem no retrato que reabre o app sem rede.
  it('fila enviada e recarga falhando: a parada segue concluída na memória e no retrato', async () => {
    await guardarRotaComRede();
    ficarOffline();
    await enfileirarConclusaoDaParada1();
    function Parada1() {
      const { paradas } = useRouteStatus();
      return (
        <Text testID="parada-1">
          {paradas.find((p) => p.id === 'parada-1')?.status ?? '-'}
        </Text>
      );
    }
    let atualizar: () => Promise<void> = async () => undefined;
    function Captura() {
      atualizar = useRouteStatus().refreshRoute;
      return null;
    }
    const { getByTestId } = render(
      <RouteStatusProvider>
        <Parada1 />
        <EnvioPendente />
        <Captura />
      </RouteStatusProvider>,
    );
    await waitFor(() => {
      expect(getByTestId('pendentes').props.children).toBe('parada-1');
    });

    // Volta a rede para o envio, mas toda leitura da rota falha.
    ficarOnline();
    mockLeituraSemRede = true;
    await act(async () => {
      await atualizar();
    });
    await waitFor(() => expect(enviouParada1()).toBe(true));
    await waitFor(() => {
      expect(getByTestId('pendentes').props.children).toBe('nenhuma');
    });

    expect(getByTestId('parada-1').props.children).toBe('concluida');
    await waitFor(() => {
      const registro = JSON.parse(
        memoria.get('@rotamestre:rota_guardada') ?? '{}',
      );
      const guardada = registro.retrato.paradas.find(
        (p: ParadaData) => p.id === 'parada-1',
      );
      expect(guardada.status).toBe('concluida');
    });
  });

  it('com rede ao abrir: envia a fila para o banco e tira o selo', async () => {
    (NetInfo.fetch as jest.Mock).mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    });
    await enfileirarConclusaoDaParada1();

    const { getByTestId } = render(
      <RouteStatusProvider>
        <EnvioPendente />
      </RouteStatusProvider>,
    );

    await waitFor(() => {
      expect(
        mockUpdateCalls.find(
          (c) => c.filter.value === 'parada-1' && c.data.status === 'concluida',
        ),
      ).toBeDefined();
    });
    await waitFor(() => {
      expect(getByTestId('pendentes').props.children).toBe('nenhuma');
    });
  });
});

describe('RouteStatusContext actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRotasData = null;
    mockRotasConcluidas = null;
    mockParadasData = null;
    mockUpdateError = null;
    mockUpdateCalls.length = 0;
    mockRpcCalls.length = 0;
  });

  describe('startRoute()', () => {
    it('deve ter funcao startRoute', async () => {
      const { getByTestId } = render(
        <RouteStatusProvider>
          <TestComponentWithActions />
        </RouteStatusProvider>,
      );

      await waitFor(() => {
        expect(getByTestId('startRoute')).toBeTruthy();
      });
    });

    it('nao deve executar se route.status !== "pendente"', async () => {
      mockRotasData = [createMockRoute({ status: 'em_andamento' })];
      mockParadasData = [createMockParada()];

      const { getByTestId } = render(
        <RouteStatusProvider>
          <TestComponentWithActions />
        </RouteStatusProvider>,
      );

      await waitFor(() => {
        expect(getByTestId('routeDbStatus').props.children).toBe(
          'em_andamento',
        );
      });

      await act(async () => {
        fireEvent.press(getByTestId('startRoute'));
      });

      // Nenhum update deve ter sido chamado
      expect(mockUpdateCalls).toHaveLength(0);
    });

    it('nao deve executar se route é null', async () => {
      mockRotasData = null;
      mockParadasData = [];

      const { getByTestId } = render(
        <RouteStatusProvider>
          <TestComponentWithActions />
        </RouteStatusProvider>,
      );

      await waitFor(() => {
        expect(getByTestId('routeId').props.children).toBe('null');
      });

      await act(async () => {
        fireEvent.press(getByTestId('startRoute'));
      });

      expect(mockUpdateCalls).toHaveLength(0);
    });

    it('deve atualizar status da rota para em_andamento', async () => {
      mockRotasData = [createMockRoute({ id: 'rota-123', status: 'pendente' })];
      mockParadasData = [
        createMockParada({
          id: 'p1',
          ordem: 1,
          status: 'pendente',
          is_checkpoint: true,
        }),
      ];

      const { getByTestId } = render(
        <RouteStatusProvider>
          <TestComponentWithActions />
        </RouteStatusProvider>,
      );

      await waitFor(() => {
        expect(getByTestId('routeDbStatus').props.children).toBe('pendente');
      });

      await act(async () => {
        fireEvent.press(getByTestId('startRoute'));
      });

      // Verifica se o update foi chamado para a rota
      const rotaUpdate = mockUpdateCalls.find(
        (c) => c.table === 'rotas' && c.data.status === 'em_andamento',
      );
      expect(rotaUpdate).toBeDefined();
      expect(rotaUpdate?.filter.value).toBe('rota-123');
    });

    it('deve marcar checkpoint de partida como concluido', async () => {
      mockRotasData = [createMockRoute({ id: 'rota-123', status: 'pendente' })];
      mockParadasData = [
        createMockParada({
          id: 'checkpoint-partida',
          ordem: 0,
          status: 'pendente',
          is_checkpoint: false,
        }),
        createMockParada({
          id: 'p1',
          ordem: 1,
          status: 'pendente',
          is_checkpoint: true,
        }),
      ];

      const { getByTestId } = render(
        <RouteStatusProvider>
          <TestComponentWithActions />
        </RouteStatusProvider>,
      );

      await waitFor(() => {
        expect(getByTestId('routeDbStatus').props.children).toBe('pendente');
      });

      await act(async () => {
        fireEvent.press(getByTestId('startRoute'));
      });

      // Verifica se o checkpoint foi atualizado
      const checkpointUpdate = mockUpdateCalls.find(
        (c) => c.table === 'paradas' && c.filter.value === 'checkpoint-partida',
      );
      expect(checkpointUpdate).toBeDefined();
      expect(checkpointUpdate?.data.status).toBe('concluida');
    });

    it('deve marcar primeira parada real como em_andamento', async () => {
      mockRotasData = [createMockRoute({ id: 'rota-123', status: 'pendente' })];
      mockParadasData = [
        createMockParada({
          id: 'checkpoint-partida',
          ordem: 0,
          status: 'pendente',
          is_checkpoint: false,
        }),
        createMockParada({
          id: 'p1',
          ordem: 1,
          status: 'pendente',
          is_checkpoint: true,
        }),
        createMockParada({
          id: 'p2',
          ordem: 2,
          status: 'pendente',
          is_checkpoint: true,
        }),
      ];

      const { getByTestId } = render(
        <RouteStatusProvider>
          <TestComponentWithActions />
        </RouteStatusProvider>,
      );

      await waitFor(() => {
        expect(getByTestId('routeDbStatus').props.children).toBe('pendente');
      });

      await act(async () => {
        fireEvent.press(getByTestId('startRoute'));
      });

      // Verifica se a primeira parada real foi marcada como em_andamento
      const paradaUpdate = mockUpdateCalls.find(
        (c) => c.table === 'paradas' && c.data.status === 'em_andamento',
      );
      expect(paradaUpdate).toBeDefined();
      expect(paradaUpdate?.filter.value).toBe('p1');
    });
  });

  describe('completeStop()', () => {
    it('deve ter funcao completeStop', async () => {
      const { getByTestId } = render(
        <RouteStatusProvider>
          <TestComponentWithActions />
        </RouteStatusProvider>,
      );

      await waitFor(() => {
        expect(getByTestId('completeStop')).toBeTruthy();
      });
    });

    it('so deve executar se rota em andamento', async () => {
      mockRotasData = [createMockRoute({ status: 'pendente' })];
      mockParadasData = [createMockParada({ id: 'parada-1' })];

      let caughtError: Error | null = null;
      const { getByTestId } = render(
        <RouteStatusProvider>
          <TestComponentWithActions
            onError={(e) => {
              caughtError = e;
            }}
          />
        </RouteStatusProvider>,
      );

      await waitFor(() => {
        expect(getByTestId('routeDbStatus').props.children).toBe('pendente');
      });

      await act(async () => {
        fireEvent.press(getByTestId('completeStop'));
      });

      expect(caughtError).toBeTruthy();
      expect(caughtError?.message).toContain('precisa estar em andamento');
    });

    it('deve atualizar parada para concluida com foto', async () => {
      mockRotasData = [createMockRoute({ status: 'em_andamento' })];
      mockParadasData = [
        createMockParada({
          id: 'parada-1',
          ordem: 1,
          status: 'em_andamento',
          is_checkpoint: true,
        }),
        createMockParada({
          id: 'parada-2',
          ordem: 2,
          status: 'pendente',
          is_checkpoint: true,
        }),
      ];

      const { getByTestId } = render(
        <RouteStatusProvider>
          <TestComponentWithActions />
        </RouteStatusProvider>,
      );

      await waitFor(() => {
        expect(getByTestId('routeDbStatus').props.children).toBe(
          'em_andamento',
        );
      });

      await act(async () => {
        fireEvent.press(getByTestId('completeStop'));
      });

      const paradaUpdate = mockUpdateCalls.find(
        (c) => c.table === 'paradas' && c.data.status === 'concluida',
      );
      expect(paradaUpdate).toBeDefined();
      expect(paradaUpdate?.filter.value).toBe('parada-1');
      // A URL legada vai num UPDATE próprio: a conclusão passa pela fila de
      // ações, que só grava status/horário.
      const fotoUpdate = mockUpdateCalls.find(
        (c) => c.table === 'paradas' && c.data.foto_url,
      );
      expect(fotoUpdate?.data).toEqual({
        foto_url: 'https://foto.url/test.jpg',
      });
    });

    it('deve marcar proxima parada como em_andamento', async () => {
      mockRotasData = [createMockRoute({ status: 'em_andamento' })];
      mockParadasData = [
        createMockParada({
          id: 'parada-1',
          ordem: 1,
          status: 'em_andamento',
          is_checkpoint: true,
        }),
        createMockParada({
          id: 'parada-2',
          ordem: 2,
          status: 'pendente',
          is_checkpoint: true,
        }),
      ];

      const { getByTestId } = render(
        <RouteStatusProvider>
          <TestComponentWithActions />
        </RouteStatusProvider>,
      );

      await waitFor(() => {
        expect(getByTestId('routeDbStatus').props.children).toBe(
          'em_andamento',
        );
      });

      await act(async () => {
        fireEvent.press(getByTestId('completeStop'));
      });

      const nextParadaUpdate = mockUpdateCalls.find(
        (c) => c.table === 'paradas' && c.data.status === 'em_andamento',
      );
      expect(nextParadaUpdate).toBeDefined();
      expect(nextParadaUpdate?.filter.value).toBe('parada-2');
    });
  });

  describe('skipStop()', () => {
    it('deve ter funcao skipStop', async () => {
      const { getByTestId } = render(
        <RouteStatusProvider>
          <TestComponentWithActions />
        </RouteStatusProvider>,
      );

      await waitFor(() => {
        expect(getByTestId('skipStop')).toBeTruthy();
      });
    });

    it('so deve executar se rota em andamento', async () => {
      mockRotasData = [createMockRoute({ status: 'pendente' })];
      mockParadasData = [createMockParada({ id: 'parada-1' })];

      let caughtError: Error | null = null;
      const { getByTestId } = render(
        <RouteStatusProvider>
          <TestComponentWithActions
            onError={(e) => {
              caughtError = e;
            }}
          />
        </RouteStatusProvider>,
      );

      await waitFor(() => {
        expect(getByTestId('routeDbStatus').props.children).toBe('pendente');
      });

      await act(async () => {
        fireEvent.press(getByTestId('skipStop'));
      });

      expect(caughtError).toBeTruthy();
      expect(caughtError?.message).toContain('precisa estar em andamento');
    });

    it('deve atualizar parada para pulada', async () => {
      mockRotasData = [createMockRoute({ status: 'em_andamento' })];
      mockParadasData = [
        createMockParada({
          id: 'parada-1',
          ordem: 1,
          status: 'em_andamento',
          is_checkpoint: true,
        }),
        createMockParada({
          id: 'parada-2',
          ordem: 2,
          status: 'pendente',
          is_checkpoint: true,
        }),
      ];

      const { getByTestId } = render(
        <RouteStatusProvider>
          <TestComponentWithActions />
        </RouteStatusProvider>,
      );

      await waitFor(() => {
        expect(getByTestId('routeDbStatus').props.children).toBe(
          'em_andamento',
        );
      });

      await act(async () => {
        fireEvent.press(getByTestId('skipStop'));
      });

      const paradaUpdate = mockUpdateCalls.find(
        (c) => c.table === 'paradas' && c.data.status === 'pulada',
      );
      expect(paradaUpdate).toBeDefined();
      expect(paradaUpdate?.filter.value).toBe('parada-1');
      expect(paradaUpdate?.data.motivo_skip).toBe('cliente_ausente');
    });

    it('deve marcar proxima parada como em_andamento apos pular', async () => {
      mockRotasData = [createMockRoute({ status: 'em_andamento' })];
      mockParadasData = [
        createMockParada({
          id: 'parada-1',
          ordem: 1,
          status: 'em_andamento',
          is_checkpoint: true,
        }),
        createMockParada({
          id: 'parada-2',
          ordem: 2,
          status: 'pendente',
          is_checkpoint: true,
        }),
      ];

      const { getByTestId } = render(
        <RouteStatusProvider>
          <TestComponentWithActions />
        </RouteStatusProvider>,
      );

      await waitFor(() => {
        expect(getByTestId('routeDbStatus').props.children).toBe(
          'em_andamento',
        );
      });

      await act(async () => {
        fireEvent.press(getByTestId('skipStop'));
      });

      const nextParadaUpdate = mockUpdateCalls.find(
        (c) => c.table === 'paradas' && c.data.status === 'em_andamento',
      );
      expect(nextParadaUpdate).toBeDefined();
      expect(nextParadaUpdate?.filter.value).toBe('parada-2');
    });
  });

  describe('completeRoute()', () => {
    it('deve ter funcao completeRoute', async () => {
      const { getByTestId } = render(
        <RouteStatusProvider>
          <TestComponentWithActions />
        </RouteStatusProvider>,
      );

      await waitFor(() => {
        expect(getByTestId('completeRoute')).toBeTruthy();
      });
    });

    it('nao deve executar se route é null', async () => {
      mockRotasData = null;
      mockParadasData = [];

      const { getByTestId } = render(
        <RouteStatusProvider>
          <TestComponentWithActions />
        </RouteStatusProvider>,
      );

      await waitFor(() => {
        expect(getByTestId('routeId').props.children).toBe('null');
      });

      await act(async () => {
        fireEvent.press(getByTestId('completeRoute'));
      });

      expect(mockUpdateCalls).toHaveLength(0);
    });

    it('deve atualizar status da rota para concluida', async () => {
      mockRotasData = [
        createMockRoute({ id: 'rota-123', status: 'em_andamento' }),
      ];
      mockParadasData = [
        createMockParada({
          id: 'p1',
          ordem: 1,
          status: 'concluida',
          is_checkpoint: true,
        }),
      ];

      const { getByTestId } = render(
        <RouteStatusProvider>
          <TestComponentWithActions />
        </RouteStatusProvider>,
      );

      await waitFor(() => {
        expect(getByTestId('routeDbStatus').props.children).toBe(
          'em_andamento',
        );
      });

      await act(async () => {
        fireEvent.press(getByTestId('completeRoute'));
      });

      // Uma operação só no banco (RPC em transação), nunca UPDATE direto.
      expect(mockRpcCalls).toEqual([
        { fn: 'finalizar_rota', args: { p_rota_id: 'rota-123' } },
      ]);
      expect(mockUpdateCalls.filter((c) => c.table === 'rotas')).toEqual([]);
    });

    it('a chegada é concluída pela RPC, não por UPDATE do cliente', async () => {
      mockRotasData = [
        createMockRoute({ id: 'rota-123', status: 'em_andamento' }),
      ];
      mockParadasData = [
        createMockParada({
          id: 'checkpoint-partida',
          ordem: 0,
          status: 'concluida',
          is_checkpoint: false,
        }),
        createMockParada({
          id: 'p1',
          ordem: 1,
          status: 'concluida',
          is_checkpoint: true,
        }),
        createMockParada({
          id: 'checkpoint-chegada',
          ordem: 99,
          status: 'pendente',
          is_checkpoint: false,
        }),
      ];

      const { getByTestId } = render(
        <RouteStatusProvider>
          <TestComponentWithActions />
        </RouteStatusProvider>,
      );

      await waitFor(() => {
        expect(getByTestId('routeDbStatus').props.children).toBe(
          'em_andamento',
        );
      });

      await act(async () => {
        fireEvent.press(getByTestId('completeRoute'));
      });

      // A RPC `finalizar_rota` marca o checkpoint de maior ordem junto com a
      // rota (Migration 40); o cliente não grava a chegada em separado.
      expect(mockRpcCalls).toHaveLength(1);
      expect(
        mockUpdateCalls.find(
          (c) =>
            c.table === 'paradas' && c.filter.value === 'checkpoint-chegada',
        ),
      ).toBeUndefined();
    });
  });

  describe('refreshRoute()', () => {
    it('deve ter funcao refreshRoute', async () => {
      const { getByTestId } = render(
        <RouteStatusProvider>
          <TestComponentWithActions />
        </RouteStatusProvider>,
      );

      await waitFor(() => {
        expect(getByTestId('refreshRoute')).toBeTruthy();
      });
    });

    it('deve recarregar dados ao chamar refreshRoute', async () => {
      mockRotasData = [createMockRoute({ status: 'pendente' })];
      mockParadasData = [];

      const { getByTestId } = render(
        <RouteStatusProvider>
          <TestComponentWithActions />
        </RouteStatusProvider>,
      );

      await waitFor(() => {
        expect(getByTestId('routeStatus').props.children).toBe('pending');
      });

      // Update mock data
      mockRotasData = [createMockRoute({ status: 'em_andamento' })];
      mockParadasData = [
        createMockParada({
          id: 'p1',
          ordem: 1,
          status: 'pendente',
          is_checkpoint: true,
        }),
        createMockParada({
          id: 'p2',
          ordem: 2,
          status: 'pendente',
          is_checkpoint: true,
        }),
      ];

      await act(async () => {
        fireEvent.press(getByTestId('refreshRoute'));
      });

      await waitFor(() => {
        expect(getByTestId('routeStatus').props.children).toBe('active');
      });
    });

    // Queda observada e nada em memória: a carga inicial usa o atalho, mas
    // "puxar para atualizar" é pedido do usuário e vai à rede.
    it('com queda observada e sem memória, refreshRoute consulta o banco', async () => {
      const { registrarFalhaDeRede, _resetRedeObservada } = jest.requireActual<
        typeof import('@/lib/redeObservada')
      >('@/lib/redeObservada');
      const { supabase } = jest.requireMock('@/lib/supabase');
      mockRotasData = [createMockRoute({ status: 'pendente' })];
      mockParadasData = [];
      registrarFalhaDeRede();

      try {
        const { getByTestId } = render(
          <RouteStatusProvider>
            <TestComponentWithActions />
          </RouteStatusProvider>,
        );
        await act(async () => {
          await Promise.resolve();
        });
        const consultasDeRota = () =>
          (supabase.from as jest.Mock).mock.calls.filter(
            ([tabela]: [string]) => tabela === 'rotas',
          ).length;
        expect(consultasDeRota()).toBe(0);
        expect(getByTestId('routeStatus').props.children).not.toBe('pending');

        await act(async () => {
          fireEvent.press(getByTestId('refreshRoute'));
        });

        await waitFor(() => {
          expect(consultasDeRota()).toBeGreaterThan(0);
          expect(getByTestId('routeStatus').props.children).toBe('pending');
        });
      } finally {
        _resetRedeObservada();
      }
    });
  });
});

describe('RouteStatusContext edge cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRotasData = null;
    mockRotasConcluidas = null;
    mockParadasData = null;
    mockUpdateError = null;
    mockUpdateCalls.length = 0;
    mockRpcCalls.length = 0;
  });

  it('deve priorizar rota em_andamento sobre pendente', async () => {
    mockRotasData = [
      createMockRoute({
        id: 'rota-pendente',
        status: 'pendente',
        data: '2025-01-05',
      }),
      createMockRoute({
        id: 'rota-andamento',
        status: 'em_andamento',
        data: '2025-01-04',
      }),
    ];
    mockParadasData = [
      createMockParada({
        id: 'p1',
        ordem: 1,
        status: 'pendente',
        is_checkpoint: true,
      }),
    ];

    const { getByTestId } = render(
      <RouteStatusProvider>
        <TestComponent />
      </RouteStatusProvider>,
    );

    await waitFor(() => {
      expect(getByTestId('loading').props.children).toBe('false');
    });

    // Deve selecionar a rota em andamento
    expect(getByTestId('route').props.children).toBe('rota-andamento');
    expect(getByTestId('status').props.children).toBe('last-stop');
  });

  it('deve tratar erro de update graciosamente', async () => {
    mockRotasData = [createMockRoute({ status: 'pendente' })];
    mockParadasData = [createMockParada()];
    mockUpdateError = { message: 'Database error' };

    const { getByTestId } = render(
      <RouteStatusProvider>
        <TestComponentWithActions />
      </RouteStatusProvider>,
    );

    await waitFor(() => {
      expect(getByTestId('routeDbStatus').props.children).toBe('pendente');
    });

    // Deve lançar erro ao tentar iniciar rota
    let _caughtError: Error | null = null;
    await act(async () => {
      try {
        fireEvent.press(getByTestId('startRoute'));
      } catch (e) {
        _caughtError = e as Error;
      }
    });

    // O erro deve ter sido capturado internamente pelo context
    // mas a interface não deve quebrar
    expect(getByTestId('routeDbStatus')).toBeTruthy();
  });

  it('deve manter estado consistente após múltiplas operações', async () => {
    mockRotasData = [createMockRoute({ status: 'em_andamento' })];
    mockParadasData = [
      createMockParada({
        id: 'p1',
        ordem: 1,
        status: 'em_andamento',
        is_checkpoint: true,
      }),
      createMockParada({
        id: 'p2',
        ordem: 2,
        status: 'pendente',
        is_checkpoint: true,
      }),
      createMockParada({
        id: 'p3',
        ordem: 3,
        status: 'pendente',
        is_checkpoint: true,
      }),
    ];

    const { getByTestId } = render(
      <RouteStatusProvider>
        <TestComponentWithActions />
      </RouteStatusProvider>,
    );

    await waitFor(() => {
      expect(getByTestId('routeStatus').props.children).toBe('active');
    });

    // Simula completar várias paradas
    await act(async () => {
      fireEvent.press(getByTestId('completeStop'));
    });

    // Context deve continuar funcionando
    expect(getByTestId('routeStatus')).toBeTruthy();
  });
});
