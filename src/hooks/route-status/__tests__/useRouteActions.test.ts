import { Platform } from 'react-native';

import type { ParadaData, RouteData } from '@/context/route-status/types';
import { getErrorMessage } from '@/lib/errorMapping';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import {
  requestAndStartTracking,
  stopBackgroundTracking,
} from '@/services/unifiedLocationTracking';

import { useRouteActions } from '../useRouteActions';

jest.mock('@/lib/supabase');
jest.mock('@/services/unifiedLocationTracking');
jest.mock('@/lib/logger');

// ---------------------------------------------------------------------------
// Supabase chain mock helpers
// ---------------------------------------------------------------------------

// Update chain: from(table).update(data).eq(col, val) -> { error }
const mockUpdateEq = jest.fn();
const mockUpdate = jest.fn(() => ({ eq: mockUpdateEq }));

// Select chain: from(table).select(cols).eq(col, val).order(col) -> { data }
const mockSelectOrder = jest.fn();
const mockSelectEq = jest.fn(() => ({ order: mockSelectOrder }));
const mockSelect = jest.fn(() => ({ eq: mockSelectEq }));

const mockFrom = jest.fn(() => ({
  update: mockUpdate,
  select: mockSelect,
}));
(supabase.from as jest.Mock) = mockFrom;

/** Default fresh paradas returned by select queries */
let freshParadasResponse: { data: Partial<ParadaData>[] | null; error: null } =
  {
    data: [],
    error: null,
  };

function makeRoute(overrides: Partial<RouteData> = {}): RouteData {
  return {
    id: 'route-1',
    unidade_id: 'unit-1',
    status: 'pendente',
    unidade_nome: 'Unidade A',
    ...overrides,
  };
}

function makeParada(overrides: Partial<ParadaData> = {}): ParadaData {
  return {
    id: 'parada-1',
    endereco: 'Rua A, 123',
    ordem: 1,
    status: 'pendente',
    tipo: 'entrega',
    latitude: -23.55,
    longitude: -46.63,
    ...overrides,
  };
}

const porta = {
  lerParada: jest.fn(),
  atualizarSeAberta: jest.fn(),
  avancarProxima: jest.fn(),
};

function setup(
  overrides: {
    route?: RouteData | null;
    paradas?: ParadaData[];
    userData?: { id: string; nome?: string } | null;
  } = {},
) {
  const loadActiveRoute = jest.fn().mockResolvedValue(undefined);
  // eslint-disable-next-line react-hooks/rules-of-hooks -- useRouteActions is not a real hook (no useState/useEffect)
  const actions = useRouteActions({
    route: 'route' in overrides ? overrides.route! : makeRoute(),
    paradas: overrides.paradas ?? [],
    userData:
      'userData' in overrides
        ? overrides.userData!
        : { id: 'user-1', nome: 'Joao' },
    loadActiveRoute,
    portaParadas: porta,
  });
  return { ...actions, loadActiveRoute };
}

beforeEach(() => {
  jest.clearAllMocks();
  porta.lerParada.mockResolvedValue({
    status: 'em_andamento',
    rota_id: 'route-1',
    rota: { status: 'em_andamento', motorista_id: 'user-1' },
  });
  porta.atualizarSeAberta.mockResolvedValue(true);
  porta.avancarProxima.mockResolvedValue(undefined);
  // Default: update chain succeeds
  mockUpdateEq.mockResolvedValue({ error: null });
  // Default: select chain returns empty fresh paradas
  freshParadasResponse = { data: [], error: null };
  mockSelectOrder.mockImplementation(() => freshParadasResponse);
  // Default to web platform to avoid location tracking calls
  (Platform as any).OS = 'web';
});

// ============================================================================
// startRoute
// ============================================================================

describe('startRoute', () => {
  it('returns early when route is null', async () => {
    const { startRoute } = setup({ route: null });
    await startRoute();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('returns early when userData is null', async () => {
    const { startRoute } = setup({ userData: null });
    await startRoute();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('logs warn and returns when status is not pendente', async () => {
    const { startRoute } = setup({
      route: makeRoute({ status: 'em_andamento' }),
    });
    await startRoute();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('em_andamento'),
    );
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('updates rota status to em_andamento', async () => {
    const { startRoute } = setup({
      paradas: [makeParada()],
    });
    await startRoute();

    expect(mockFrom).toHaveBeenCalledWith('rotas');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'em_andamento',
        iniciada_em: expect.any(String),
      }),
    );
    expect(mockUpdateEq).toHaveBeenCalledWith('id', 'route-1');
  });

  it('marks checkpoint partida (ordem=0, is_checkpoint=false) as concluida', async () => {
    const checkpoint = makeParada({
      id: 'cp-start',
      ordem: 0,
      is_checkpoint: false,
    });
    const parada = makeParada({ id: 'parada-1', ordem: 1 });
    const { startRoute } = setup({ paradas: [checkpoint, parada] });

    await startRoute();

    // First call: update rota, Second call: update checkpoint, Third call: next parada
    expect(mockFrom).toHaveBeenCalledWith('paradas');
    const updateCalls = mockUpdate.mock.calls;
    expect(
      updateCalls.some(
        (c: any[]) => c[0]?.status === 'concluida' && c[0]?.concluida_em,
      ),
    ).toBe(true);
  });

  it('calls marcarProximaParadaEmAndamento for first real parada', async () => {
    const paradas = [
      makeParada({ id: 'p1', ordem: 1, status: 'pendente' }),
      makeParada({ id: 'p2', ordem: 2, status: 'pendente' }),
    ];
    const { startRoute } = setup({ paradas });

    await startRoute();

    // Should update the first pendente parada to em_andamento
    const eqCalls = mockUpdateEq.mock.calls;
    expect(eqCalls.some((c: any[]) => c[0] === 'id' && c[1] === 'p1')).toBe(
      true,
    );
  });

  it('calls loadActiveRoute on success', async () => {
    const { startRoute, loadActiveRoute } = setup({
      paradas: [makeParada()],
    });
    await startRoute();
    expect(loadActiveRoute).toHaveBeenCalled();
  });

  it('throws and logs error on supabase failure', async () => {
    mockUpdateEq.mockResolvedValueOnce({ error: { message: 'DB error' } });
    const { startRoute } = setup({ paradas: [makeParada()] });

    await expect(startRoute()).rejects.toEqual({ message: 'DB error' });
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('iniciar rota'),
      expect.anything(),
    );
  });

  it('calls requestAndStartTracking on mobile', async () => {
    (Platform as any).OS = 'android';
    const { startRoute } = setup({
      paradas: [makeParada()],
      userData: { id: 'user-1', nome: 'Carlos' },
    });

    await startRoute();

    expect(requestAndStartTracking).toHaveBeenCalledWith(
      expect.objectContaining({
        rotaId: 'route-1',
        motoristaId: 'user-1',
        motoristaNome: 'Carlos',
      }),
    );
  });

  it('does not call requestAndStartTracking on web', async () => {
    (Platform as any).OS = 'web';
    const { startRoute } = setup({ paradas: [makeParada()] });

    await startRoute();

    expect(requestAndStartTracking).not.toHaveBeenCalled();
  });
});

// ============================================================================
// completeStop
// ============================================================================

describe('completeStop', () => {
  it('throws when route is null', async () => {
    const { completeStop } = setup({ route: null });
    await expect(completeStop('p1')).rejects.toThrow('em andamento');
  });

  it('throws when route status is not em_andamento', async () => {
    const { completeStop } = setup({
      route: makeRoute({ status: 'pendente' }),
    });
    await expect(completeStop('p1')).rejects.toThrow('em andamento');
  });

  it('caminho legado com URL: grava foto_url antes de concluir', async () => {
    const { completeStop } = setup({
      route: makeRoute({ status: 'em_andamento' }),
      paradas: [makeParada({ id: 'p1', status: 'em_andamento' })],
    });

    await completeStop('p1', 'https://storage.com/photo.jpg');

    expect(mockUpdate).toHaveBeenCalledWith({
      foto_url: 'https://storage.com/photo.jpg',
    });
    expect(porta.atualizarSeAberta).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({ status: 'concluida' }),
    );
  });

  it('conclui pela porta (UPDATE só de parada aberta) e recarrega a rota', async () => {
    const { completeStop, loadActiveRoute } = setup({
      route: makeRoute({ status: 'em_andamento' }),
      paradas: [makeParada({ id: 'p1' })],
    });

    await expect(completeStop('p1')).resolves.toBe('enviada');
    expect(porta.atualizarSeAberta).toHaveBeenCalledWith('p1', {
      status: 'concluida',
      concluida_em: expect.any(String),
    });
    expect(porta.avancarProxima).toHaveBeenCalledWith('route-1');
    expect(loadActiveRoute).toHaveBeenCalled();
  });
});

// ============================================================================
// skipStop
// ============================================================================

describe('skipStop', () => {
  it('throws when route is not em_andamento', async () => {
    const { skipStop } = setup({
      route: makeRoute({ status: 'pendente' }),
    });
    await expect(skipStop('p1', 'cliente_ausente')).rejects.toThrow(
      'em andamento',
    );
  });

  it('pula pela porta com motivo, sem observações quando não há', async () => {
    const { skipStop, loadActiveRoute } = setup({
      route: makeRoute({ status: 'em_andamento' }),
      paradas: [makeParada({ id: 'p1', status: 'em_andamento' })],
    });

    await expect(skipStop('p1', 'recusa')).resolves.toBe('enviada');
    expect(porta.atualizarSeAberta).toHaveBeenCalledWith('p1', {
      status: 'pulada',
      motivo_skip: 'recusa',
    });
    expect(porta.avancarProxima).toHaveBeenCalledWith('route-1');
    expect(loadActiveRoute).toHaveBeenCalled();
  });

  it('inclui observações quando informadas', async () => {
    const { skipStop } = setup({
      route: makeRoute({ status: 'em_andamento' }),
      paradas: [makeParada({ id: 'p1', status: 'em_andamento' })],
    });

    await skipStop('p1', 'outro', 'Chuva forte');
    expect(porta.atualizarSeAberta).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({ observacoes: 'Chuva forte' }),
    );
  });
});

// ============================================================================
// completeRoute
// ============================================================================

/**
 * Finalizar a rota é UMA operação no banco: a RPC `finalizar_rota` confere
 * dono, status e paradas pendentes e marca chegada + rota numa transação.
 * Antes eram dois UPDATEs do cliente (rota, depois checkpoint, com o erro do
 * segundo ignorado) e o rastreamento parava ANTES — uma falha deixava a rota
 * em andamento sem rastreamento.
 */
describe('completeRoute', () => {
  const mockRpc = jest.fn();

  beforeEach(() => {
    mockRpc.mockReset().mockResolvedValue({ data: null, error: null });
    (supabase as unknown as { rpc: jest.Mock }).rpc = mockRpc;
  });

  it('returns early when route is null', async () => {
    const { completeRoute } = setup({ route: null });
    await completeRoute();
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('finaliza pela RPC atômica, sem UPDATE direto em rotas/paradas', async () => {
    const { completeRoute } = setup({
      route: makeRoute({ id: 'route-9', status: 'em_andamento' }),
      paradas: [makeParada({ id: 'cp-end', ordem: 99, is_checkpoint: false })],
    });

    await completeRoute();

    expect(mockRpc).toHaveBeenCalledWith('finalizar_rota', {
      p_rota_id: 'route-9',
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('para o rastreamento só DEPOIS do sucesso da RPC (mobile)', async () => {
    (Platform as any).OS = 'android';
    const { completeRoute } = setup({
      route: makeRoute({ status: 'em_andamento' }),
    });

    await completeRoute();

    expect(stopBackgroundTracking).toHaveBeenCalled();
    expect(mockRpc.mock.invocationCallOrder[0]).toBeLessThan(
      (stopBackgroundTracking as jest.Mock).mock.invocationCallOrder[0],
    );
  });

  it('erro da RPC propaga e NÃO para o rastreamento', async () => {
    (Platform as any).OS = 'android';
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: {
        message: 'Não é possível finalizar a rota com 1 parada(s) pendente(s).',
      },
    });
    const { completeRoute, loadActiveRoute } = setup({
      route: makeRoute({ status: 'em_andamento' }),
    });

    await expect(completeRoute()).rejects.toEqual(
      expect.objectContaining({ message: expect.stringContaining('pendente') }),
    );
    expect(stopBackgroundTracking).not.toHaveBeenCalled();
    expect(loadActiveRoute).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('concluir rota'),
      expect.anything(),
    );
  });

  it('falha ao parar o rastreamento depois do sucesso não desfaz a finalização', async () => {
    (Platform as any).OS = 'android';
    (stopBackgroundTracking as jest.Mock).mockRejectedValueOnce(
      new Error('task'),
    );
    const { completeRoute, loadActiveRoute } = setup({
      route: makeRoute({ status: 'em_andamento' }),
    });

    await expect(completeRoute()).resolves.toBeUndefined();
    expect(loadActiveRoute).toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('does not call stopBackgroundTracking on web', async () => {
    (Platform as any).OS = 'web';
    const { completeRoute } = setup({
      route: makeRoute({ status: 'em_andamento' }),
    });

    await completeRoute();

    expect(stopBackgroundTracking).not.toHaveBeenCalled();
  });

  it('calls loadActiveRoute on success', async () => {
    const { completeRoute, loadActiveRoute } = setup({
      route: makeRoute({ status: 'em_andamento' }),
    });

    await completeRoute();
    expect(loadActiveRoute).toHaveBeenCalled();
  });

  it('recusa já no cliente quando há parada real pendente (sem chamar a RPC)', async () => {
    const paradas = [
      makeParada({
        id: 'cp-start',
        ordem: 0,
        is_checkpoint: false,
        status: 'concluida',
      }),
      makeParada({ id: 'p1', ordem: 1, status: 'concluida' }),
      makeParada({ id: 'p2', ordem: 2, status: 'pendente' }),
      makeParada({ id: 'p3', ordem: 3, status: 'em_andamento' }),
      makeParada({
        id: 'cp-end',
        ordem: 99,
        is_checkpoint: false,
        status: 'pendente',
      }),
    ];
    const { completeRoute } = setup({
      route: makeRoute({ status: 'em_andamento' }),
      paradas,
    });

    await expect(completeRoute()).rejects.toThrow('2 parada(s) pendentes');
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('a recusa do atalho do cliente vira mensagem útil, não "erro inesperado"', async () => {
    const { completeRoute } = setup({
      route: makeRoute({ status: 'em_andamento' }),
      paradas: [makeParada({ id: 'p1', status: 'pendente' })],
    });

    const erro = await completeRoute().catch((e: unknown) => e);

    expect(getErrorMessage(erro).code).toBe('ROUTE_STOPS_PENDING');
  });
});

// ============================================================================
// Error propagation: marcarProximaParadaEmAndamento
// ============================================================================

describe('marcarProximaParadaEmAndamento error propagation', () => {
  it('completeStop: entrega gravada + falha ao promover a próxima não vira erro', async () => {
    porta.avancarProxima.mockRejectedValueOnce({ message: 'promotion failed' });
    const { completeStop, loadActiveRoute } = setup({
      route: makeRoute({ status: 'em_andamento' }),
      paradas: [makeParada({ id: 'p1', status: 'em_andamento' })],
    });

    await expect(completeStop('p1')).resolves.toBe('enviada');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('próxima'),
      expect.objectContaining({ message: 'promotion failed' }),
    );
    expect(loadActiveRoute).toHaveBeenCalled();
  });

  it('skipStop: pulo gravado + falha ao promover a próxima não vira erro', async () => {
    porta.avancarProxima.mockRejectedValueOnce({
      message: 'skip promotion failed',
    });
    const { skipStop } = setup({
      route: makeRoute({ status: 'em_andamento' }),
      paradas: [makeParada({ id: 'p1', status: 'em_andamento' })],
    });

    await expect(skipStop('p1', 'cliente_ausente')).resolves.toBe('enviada');
  });

  it('propagates error to startRoute caller when promoting first parada fails', async () => {
    const paradas = [makeParada({ id: 'p1', ordem: 1, status: 'pendente' })];

    const { startRoute } = setup({ paradas });

    // First update (rota status) succeeds, second (promote p1) fails
    mockUpdateEq
      .mockResolvedValueOnce({ error: null }) // startRoute: update rota
      .mockResolvedValueOnce({ error: { message: 'start promotion failed' } }); // marcarProximaParadaEmAndamento

    await expect(startRoute()).rejects.toEqual({
      message: 'start promotion failed',
    });
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('iniciar rota'),
      expect.anything(),
    );
  });
});

// ============================================================================
// Error propagation: startRoute checkpoint update
// ============================================================================

describe('startRoute checkpoint update error', () => {
  it('throws when checkpoint partida update fails', async () => {
    const checkpoint = makeParada({
      id: 'cp-start',
      ordem: 0,
      is_checkpoint: false,
    });
    const parada = makeParada({ id: 'p1', ordem: 1 });

    const { startRoute } = setup({ paradas: [checkpoint, parada] });

    // First update (rota status) succeeds, second (checkpoint) fails
    mockUpdateEq
      .mockResolvedValueOnce({ error: null }) // update rota
      .mockResolvedValueOnce({
        error: { message: 'checkpoint update failed' },
      }); // update checkpoint

    await expect(startRoute()).rejects.toEqual({
      message: 'checkpoint update failed',
    });
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('iniciar rota'),
      expect.objectContaining({ message: 'checkpoint update failed' }),
    );
  });

  it('does not proceed to marcarProximaParadaEmAndamento when checkpoint fails', async () => {
    const checkpoint = makeParada({
      id: 'cp-start',
      ordem: 0,
      is_checkpoint: false,
    });
    const parada = makeParada({ id: 'p1', ordem: 1, status: 'pendente' });

    const { startRoute, loadActiveRoute } = setup({
      paradas: [checkpoint, parada],
    });

    // First update (rota) succeeds, second (checkpoint) fails
    mockUpdateEq
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: 'checkpoint failed' } });

    await expect(startRoute()).rejects.toEqual({
      message: 'checkpoint failed',
    });

    // Should only have 2 update calls (rota + checkpoint), NOT 3 (no promotion)
    expect(mockUpdateEq).toHaveBeenCalledTimes(2);
    // loadActiveRoute should not be called since we threw
    expect(loadActiveRoute).not.toHaveBeenCalled();
  });
});
