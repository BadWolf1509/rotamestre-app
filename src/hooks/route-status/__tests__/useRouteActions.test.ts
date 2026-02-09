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

// Supabase chain mock helper
const mockEq = jest.fn();
const mockUpdate = jest.fn(() => ({ eq: mockEq }));
const mockFrom = jest.fn(() => ({ update: mockUpdate }));
(supabase.from as jest.Mock) = mockFrom;

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
    userData: 'userData' in overrides ? overrides.userData! : { id: 'user-1', nome: 'João' },
    loadActiveRoute,
  });
  return { ...actions, loadActiveRoute };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockEq.mockResolvedValue({ error: null });
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
    expect(mockEq).toHaveBeenCalledWith('id', 'route-1');
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
    const eqCalls = mockEq.mock.calls;
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
    mockEq.mockResolvedValueOnce({ error: { message: 'DB error' } });
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
    expect(mockEq).toHaveBeenCalledWith('id', 'p1');
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

  it('advances to next pending parada', async () => {
    const paradas = [
      makeParada({ id: 'p1', ordem: 1, status: 'em_andamento' }),
      makeParada({ id: 'p2', ordem: 2, status: 'pendente' }),
    ];
    const { completeStop } = setup({
      route: makeRoute({ status: 'em_andamento' }),
      paradas,
    });

    await completeStop('p1');

    // Should update p2 to em_andamento
    const eqCalls = mockEq.mock.calls;
    expect(eqCalls.some((c: any[]) => c[0] === 'id' && c[1] === 'p2')).toBe(true);
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

  it('advances to next pending parada and calls loadActiveRoute', async () => {
    const paradas = [
      makeParada({ id: 'p1', ordem: 1, status: 'em_andamento' }),
      makeParada({ id: 'p2', ordem: 2, status: 'pendente' }),
    ];
    const { skipStop, loadActiveRoute } = setup({
      route: makeRoute({ status: 'em_andamento' }),
      paradas,
    });

    await skipStop('p1', 'endereco_incorreto');

    const eqCalls = mockEq.mock.calls;
    expect(eqCalls.some((c: any[]) => c[0] === 'id' && c[1] === 'p2')).toBe(true);
    expect(loadActiveRoute).toHaveBeenCalled();
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

    const eqCalls = mockEq.mock.calls;
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
    mockEq.mockResolvedValueOnce({ error: { message: 'DB fail' } });
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
