import { Platform } from 'react-native';

import type { ParadaData, RouteData } from '@/context/route-status/types';
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
let freshParadasResponse: { data: Partial<ParadaData>[] | null; error: null } = {
  data: [],
  error: null,
};

function makeRoute(overrides: Partial<RouteData> = {}): RouteData {
  return {
    id: 'route-1',
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

function setup(overrides: {
  route?: RouteData | null;
  paradas?: ParadaData[];
  userData?: { id: string; nome?: string } | null;
} = {}) {
  const loadActiveRoute = jest.fn().mockResolvedValue(undefined);
  // eslint-disable-next-line react-hooks/rules-of-hooks -- useRouteActions is not a real hook (no useState/useEffect)
  const actions = useRouteActions({
    route: 'route' in overrides ? overrides.route! : makeRoute(),
    paradas: overrides.paradas ?? [],
    userData: 'userData' in overrides ? overrides.userData! : { id: 'user-1', nome: 'Joao' },
    loadActiveRoute,
  });
  return { ...actions, loadActiveRoute };
}

beforeEach(() => {
  jest.clearAllMocks();
  // Default: update chain succeeds
  mockUpdateEq.mockResolvedValue({ error: null });
  // Default: select chain returns empty fresh paradas
  freshParadasResponse = { data: [], error: null };
  mockSelectOrder.mockImplementation(() => freshParadasResponse);
  // Default to web platform to avoid location tracking calls
  (Platform as any).OS = 'web';
});

/**
 * Helper to set what the fresh paradas DB query returns.
 * Used by completeStop and skipStop tests.
 */
function setFreshParadas(paradas: Partial<ParadaData>[]) {
  freshParadasResponse = { data: paradas, error: null };
  mockSelectOrder.mockImplementation(() => freshParadasResponse);
}

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
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('em_andamento'));
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
    const checkpoint = makeParada({ id: 'cp-start', ordem: 0, is_checkpoint: false });
    const parada = makeParada({ id: 'parada-1', ordem: 1 });
    const { startRoute } = setup({ paradas: [checkpoint, parada] });

    await startRoute();

    // First call: update rota, Second call: update checkpoint, Third call: next parada
    expect(mockFrom).toHaveBeenCalledWith('paradas');
    const updateCalls = mockUpdate.mock.calls;
    expect(updateCalls.some((c: any[]) =>
      c[0]?.status === 'concluida' && c[0]?.concluida_em,
    )).toBe(true);
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
    expect(eqCalls.some((c: any[]) => c[0] === 'id' && c[1] === 'p1')).toBe(true);
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

  it('updates parada with status concluida', async () => {
    const { completeStop } = setup({
      route: makeRoute({ status: 'em_andamento' }),
      paradas: [makeParada({ id: 'p1', status: 'em_andamento' })],
    });

    await completeStop('p1');

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'concluida',
        concluida_em: expect.any(String),
      }),
    );
    expect(mockUpdateEq).toHaveBeenCalledWith('id', 'p1');
  });

  it('includes foto_url when provided', async () => {
    const { completeStop } = setup({
      route: makeRoute({ status: 'em_andamento' }),
      paradas: [makeParada({ id: 'p1', status: 'em_andamento' })],
    });

    await completeStop('p1', 'https://storage.com/photo.jpg');

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        foto_url: 'https://storage.com/photo.jpg',
      }),
    );
  });

  it('omits foto_url when not provided', async () => {
    const { completeStop } = setup({
      route: makeRoute({ status: 'em_andamento' }),
      paradas: [makeParada({ id: 'p1', status: 'em_andamento' })],
    });

    await completeStop('p1');

    const firstUpdateCall = mockUpdate.mock.calls[0][0];
    expect(firstUpdateCall).not.toHaveProperty('foto_url');
  });

  it('fetches fresh paradas from DB instead of using closure', async () => {
    // Set fresh paradas that the DB query will return
    setFreshParadas([
      { id: 'p1', ordem: 1, status: 'concluida', is_checkpoint: true },
      { id: 'p2', ordem: 2, status: 'pendente', is_checkpoint: true },
    ]);

    const { completeStop } = setup({
      route: makeRoute({ status: 'em_andamento' }),
      paradas: [
        makeParada({ id: 'p1', ordem: 1, status: 'em_andamento' }),
        makeParada({ id: 'p2', ordem: 2, status: 'pendente' }),
      ],
    });

    await completeStop('p1');

    // Verify select chain was called with correct params
    expect(mockSelect).toHaveBeenCalledWith('id, status, ordem, is_checkpoint');
    expect(mockSelectEq).toHaveBeenCalledWith('rota_id', 'route-1');
    expect(mockSelectOrder).toHaveBeenCalledWith('ordem');
  });

  it('advances to next pending parada from fresh DB data', async () => {
    // DB returns p1 already completed, p2 still pending
    setFreshParadas([
      { id: 'p1', ordem: 1, status: 'concluida', is_checkpoint: true },
      { id: 'p2', ordem: 2, status: 'pendente', is_checkpoint: true },
    ]);

    const { completeStop } = setup({
      route: makeRoute({ status: 'em_andamento' }),
      paradas: [
        makeParada({ id: 'p1', ordem: 1, status: 'em_andamento' }),
        makeParada({ id: 'p2', ordem: 2, status: 'pendente' }),
      ],
    });

    await completeStop('p1');

    // Should update p2 to em_andamento via marcarProximaParadaEmAndamento
    const eqCalls = mockUpdateEq.mock.calls;
    expect(eqCalls.some((c: any[]) => c[0] === 'id' && c[1] === 'p2')).toBe(true);
  });

  it('does not call marcarProximaParadaEmAndamento when fresh query returns null', async () => {
    mockSelectOrder.mockImplementation(() => ({ data: null, error: { message: 'query failed' } }));

    const { completeStop } = setup({
      route: makeRoute({ status: 'em_andamento' }),
      paradas: [
        makeParada({ id: 'p1', ordem: 1, status: 'em_andamento' }),
        makeParada({ id: 'p2', ordem: 2, status: 'pendente' }),
      ],
    });

    await completeStop('p1');

    // The update for the stop itself should have happened
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'concluida' }),
    );
    // But no second update for promoting the next stop should occur
    // (only 1 update call for the parada completion, no promotion)
    const updateEqCalls = mockUpdateEq.mock.calls.filter(
      (c: any[]) => c[0] === 'id' && c[1] === 'p2',
    );
    expect(updateEqCalls).toHaveLength(0);
  });

  it('uses fresh DB state even when closure paradas are stale (race condition fix)', async () => {
    // Simulate race condition: closure has both paradas as pendente,
    // but DB shows p1 is already concluida (completed by another rapid call)
    // and p2 is also concluida. The fresh query reveals p3 is the real next.
    setFreshParadas([
      { id: 'p1', ordem: 1, status: 'concluida', is_checkpoint: true },
      { id: 'p2', ordem: 2, status: 'concluida', is_checkpoint: true },
      { id: 'p3', ordem: 3, status: 'pendente', is_checkpoint: true },
    ]);

    // Closure has stale data where p2 and p3 are both pendente
    const { completeStop } = setup({
      route: makeRoute({ status: 'em_andamento' }),
      paradas: [
        makeParada({ id: 'p1', ordem: 1, status: 'em_andamento' }),
        makeParada({ id: 'p2', ordem: 2, status: 'pendente' }),
        makeParada({ id: 'p3', ordem: 3, status: 'pendente' }),
      ],
    });

    await completeStop('p1');

    // With the old stale closure logic, p2 would be promoted.
    // With the fresh DB query, p3 is promoted because p2 is already concluida.
    const eqCalls = mockUpdateEq.mock.calls;
    expect(eqCalls.some((c: any[]) => c[0] === 'id' && c[1] === 'p3')).toBe(true);
    // p2 should NOT be promoted
    expect(eqCalls.filter((c: any[]) => c[0] === 'id' && c[1] === 'p2')).toHaveLength(0);
  });

  it('calls loadActiveRoute', async () => {
    const { completeStop, loadActiveRoute } = setup({
      route: makeRoute({ status: 'em_andamento' }),
      paradas: [makeParada({ id: 'p1' })],
    });

    await completeStop('p1');
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
    await expect(skipStop('p1', 'cliente_ausente')).rejects.toThrow('em andamento');
  });

  it('updates parada with status pulada and motivo_skip', async () => {
    const { skipStop } = setup({
      route: makeRoute({ status: 'em_andamento' }),
      paradas: [makeParada({ id: 'p1', status: 'em_andamento' })],
    });

    await skipStop('p1', 'cliente_ausente');

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'pulada',
        motivo_skip: 'cliente_ausente',
      }),
    );
  });

  it('includes observacoes when provided', async () => {
    const { skipStop } = setup({
      route: makeRoute({ status: 'em_andamento' }),
      paradas: [makeParada({ id: 'p1', status: 'em_andamento' })],
    });

    await skipStop('p1', 'outro', 'Chuva forte');

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        observacoes: 'Chuva forte',
      }),
    );
  });

  it('omits observacoes when not provided', async () => {
    const { skipStop } = setup({
      route: makeRoute({ status: 'em_andamento' }),
      paradas: [makeParada({ id: 'p1', status: 'em_andamento' })],
    });

    await skipStop('p1', 'recusa');

    const firstUpdateCall = mockUpdate.mock.calls[0][0];
    expect(firstUpdateCall).not.toHaveProperty('observacoes');
  });

  it('fetches fresh paradas from DB instead of using closure', async () => {
    setFreshParadas([
      { id: 'p1', ordem: 1, status: 'pulada', is_checkpoint: true },
      { id: 'p2', ordem: 2, status: 'pendente', is_checkpoint: true },
    ]);

    const { skipStop } = setup({
      route: makeRoute({ status: 'em_andamento' }),
      paradas: [
        makeParada({ id: 'p1', ordem: 1, status: 'em_andamento' }),
        makeParada({ id: 'p2', ordem: 2, status: 'pendente' }),
      ],
    });

    await skipStop('p1', 'endereco_incorreto');

    // Verify select chain was called with correct params
    expect(mockSelect).toHaveBeenCalledWith('id, status, ordem, is_checkpoint');
    expect(mockSelectEq).toHaveBeenCalledWith('rota_id', 'route-1');
    expect(mockSelectOrder).toHaveBeenCalledWith('ordem');
  });

  it('advances to next pending parada from fresh DB data and calls loadActiveRoute', async () => {
    setFreshParadas([
      { id: 'p1', ordem: 1, status: 'pulada', is_checkpoint: true },
      { id: 'p2', ordem: 2, status: 'pendente', is_checkpoint: true },
    ]);

    const { skipStop, loadActiveRoute } = setup({
      route: makeRoute({ status: 'em_andamento' }),
      paradas: [
        makeParada({ id: 'p1', ordem: 1, status: 'em_andamento' }),
        makeParada({ id: 'p2', ordem: 2, status: 'pendente' }),
      ],
    });

    await skipStop('p1', 'endereco_incorreto');

    const eqCalls = mockUpdateEq.mock.calls;
    expect(eqCalls.some((c: any[]) => c[0] === 'id' && c[1] === 'p2')).toBe(true);
    expect(loadActiveRoute).toHaveBeenCalled();
  });

  it('does not call marcarProximaParadaEmAndamento when fresh query returns null', async () => {
    mockSelectOrder.mockImplementation(() => ({ data: null, error: { message: 'query failed' } }));

    const { skipStop } = setup({
      route: makeRoute({ status: 'em_andamento' }),
      paradas: [
        makeParada({ id: 'p1', ordem: 1, status: 'em_andamento' }),
        makeParada({ id: 'p2', ordem: 2, status: 'pendente' }),
      ],
    });

    await skipStop('p1', 'cliente_ausente');

    // The update for the skip itself should have happened
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pulada' }),
    );
    // But no promotion of p2 should occur
    const updateEqCalls = mockUpdateEq.mock.calls.filter(
      (c: any[]) => c[0] === 'id' && c[1] === 'p2',
    );
    expect(updateEqCalls).toHaveLength(0);
  });

  it('uses fresh DB state even when closure paradas are stale (race condition fix)', async () => {
    // Simulate: closure says p2 is pendente, but DB says p2 is already pulada.
    // The fresh query reveals p3 is the actual next pendente stop.
    setFreshParadas([
      { id: 'p1', ordem: 1, status: 'pulada', is_checkpoint: true },
      { id: 'p2', ordem: 2, status: 'pulada', is_checkpoint: true },
      { id: 'p3', ordem: 3, status: 'pendente', is_checkpoint: true },
    ]);

    const { skipStop } = setup({
      route: makeRoute({ status: 'em_andamento' }),
      paradas: [
        makeParada({ id: 'p1', ordem: 1, status: 'em_andamento' }),
        makeParada({ id: 'p2', ordem: 2, status: 'pendente' }),
        makeParada({ id: 'p3', ordem: 3, status: 'pendente' }),
      ],
    });

    await skipStop('p1', 'endereco_incorreto');

    // With fresh DB query, p3 should be promoted (not p2)
    const eqCalls = mockUpdateEq.mock.calls;
    expect(eqCalls.some((c: any[]) => c[0] === 'id' && c[1] === 'p3')).toBe(true);
    expect(eqCalls.filter((c: any[]) => c[0] === 'id' && c[1] === 'p2')).toHaveLength(0);
  });
});

// ============================================================================
// completeRoute
// ============================================================================

describe('completeRoute', () => {
  it('returns early when route is null', async () => {
    const { completeRoute } = setup({ route: null });
    await completeRoute();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('updates rota status to concluida', async () => {
    const { completeRoute } = setup({
      route: makeRoute({ status: 'em_andamento' }),
    });

    await completeRoute();

    expect(mockFrom).toHaveBeenCalledWith('rotas');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'concluida',
        concluida_em: expect.any(String),
      }),
    );
  });

  it('marks checkpoint chegada (highest ordem, is_checkpoint=false) as concluida', async () => {
    const paradas = [
      makeParada({ id: 'cp-start', ordem: 0, is_checkpoint: false }),
      makeParada({ id: 'p1', ordem: 1 }),
      makeParada({ id: 'cp-end', ordem: 99, is_checkpoint: false }),
    ];
    const { completeRoute } = setup({
      route: makeRoute({ status: 'em_andamento' }),
      paradas,
    });

    await completeRoute();

    const eqCalls = mockUpdateEq.mock.calls;
    expect(eqCalls.some((c: any[]) => c[0] === 'id' && c[1] === 'cp-end')).toBe(true);
  });

  it('calls stopBackgroundTracking on mobile', async () => {
    (Platform as any).OS = 'android';
    const { completeRoute } = setup({
      route: makeRoute({ status: 'em_andamento' }),
    });

    await completeRoute();

    expect(stopBackgroundTracking).toHaveBeenCalled();
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

  it('throws and logs error on supabase failure', async () => {
    mockUpdateEq.mockResolvedValueOnce({ error: { message: 'DB fail' } });
    const { completeRoute } = setup({
      route: makeRoute({ status: 'em_andamento' }),
    });

    await expect(completeRoute()).rejects.toEqual({ message: 'DB fail' });
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('concluir rota'),
      expect.anything(),
    );
  });
});

// ============================================================================
// Error propagation: marcarProximaParadaEmAndamento
// ============================================================================

describe('marcarProximaParadaEmAndamento error propagation', () => {
  it('propagates error to completeStop caller', async () => {
    // Fresh paradas from DB with a pending stop to promote
    setFreshParadas([
      { id: 'p1', ordem: 1, status: 'concluida', is_checkpoint: true },
      { id: 'p2', ordem: 2, status: 'pendente', is_checkpoint: true },
    ]);

    const { completeStop } = setup({
      route: makeRoute({ status: 'em_andamento' }),
      paradas: [
        makeParada({ id: 'p1', ordem: 1, status: 'em_andamento' }),
        makeParada({ id: 'p2', ordem: 2, status: 'pendente' }),
      ],
    });

    // First update call (complete p1) succeeds, second (promote p2) fails
    mockUpdateEq
      .mockResolvedValueOnce({ error: null }) // completeStop: update p1
      .mockResolvedValueOnce({ error: { message: 'promotion failed' } }); // marcarProximaParadaEmAndamento: update p2

    await expect(completeStop('p1')).rejects.toEqual({ message: 'promotion failed' });
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('marcarProximaParadaEmAndamento'),
      expect.objectContaining({ message: 'promotion failed' }),
    );
  });

  it('propagates error to skipStop caller', async () => {
    setFreshParadas([
      { id: 'p1', ordem: 1, status: 'pulada', is_checkpoint: true },
      { id: 'p2', ordem: 2, status: 'pendente', is_checkpoint: true },
    ]);

    const { skipStop } = setup({
      route: makeRoute({ status: 'em_andamento' }),
      paradas: [
        makeParada({ id: 'p1', ordem: 1, status: 'em_andamento' }),
        makeParada({ id: 'p2', ordem: 2, status: 'pendente' }),
      ],
    });

    // First update (skip p1) succeeds, second (promote p2) fails
    mockUpdateEq
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: 'skip promotion failed' } });

    await expect(skipStop('p1', 'cliente_ausente')).rejects.toEqual({ message: 'skip promotion failed' });
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('marcarProximaParadaEmAndamento'),
      expect.objectContaining({ message: 'skip promotion failed' }),
    );
  });

  it('propagates error to startRoute caller when promoting first parada fails', async () => {
    const paradas = [
      makeParada({ id: 'p1', ordem: 1, status: 'pendente' }),
    ];

    const { startRoute } = setup({ paradas });

    // First update (rota status) succeeds, second (promote p1) fails
    mockUpdateEq
      .mockResolvedValueOnce({ error: null }) // startRoute: update rota
      .mockResolvedValueOnce({ error: { message: 'start promotion failed' } }); // marcarProximaParadaEmAndamento

    await expect(startRoute()).rejects.toEqual({ message: 'start promotion failed' });
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
    const checkpoint = makeParada({ id: 'cp-start', ordem: 0, is_checkpoint: false });
    const parada = makeParada({ id: 'p1', ordem: 1 });

    const { startRoute } = setup({ paradas: [checkpoint, parada] });

    // First update (rota status) succeeds, second (checkpoint) fails
    mockUpdateEq
      .mockResolvedValueOnce({ error: null }) // update rota
      .mockResolvedValueOnce({ error: { message: 'checkpoint update failed' } }); // update checkpoint

    await expect(startRoute()).rejects.toEqual({ message: 'checkpoint update failed' });
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('iniciar rota'),
      expect.objectContaining({ message: 'checkpoint update failed' }),
    );
  });

  it('does not proceed to marcarProximaParadaEmAndamento when checkpoint fails', async () => {
    const checkpoint = makeParada({ id: 'cp-start', ordem: 0, is_checkpoint: false });
    const parada = makeParada({ id: 'p1', ordem: 1, status: 'pendente' });

    const { startRoute, loadActiveRoute } = setup({ paradas: [checkpoint, parada] });

    // First update (rota) succeeds, second (checkpoint) fails
    mockUpdateEq
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: 'checkpoint failed' } });

    await expect(startRoute()).rejects.toEqual({ message: 'checkpoint failed' });

    // Should only have 2 update calls (rota + checkpoint), NOT 3 (no promotion)
    expect(mockUpdateEq).toHaveBeenCalledTimes(2);
    // loadActiveRoute should not be called since we threw
    expect(loadActiveRoute).not.toHaveBeenCalled();
  });
});
