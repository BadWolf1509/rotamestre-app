import { renderHook } from '@testing-library/react-native';
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

// Update chain: from(table).update(data).eq(col, val)[.eq(...)][.select(...)]
// -> { error } / { data, error }. `mockUpdateEq` recebe o PRIMEIRO `.eq` de
// cada UPDATE (uma chamada por UPDATE, na ordem) e devolve o resultado; os
// filtros seguintes caem em `mockUpdateFiltro`. Com `.select()`, resultado
// sem `data` e sem erro vira 1 linha afetada.
type ResultadoUpdate = { data?: unknown; error: unknown };
const mockUpdateEq = jest.fn();
const mockUpdateFiltro = jest.fn();
const mockUpdateSelect = jest.fn();
function consultaUpdate(resultado: unknown): unknown {
  const p = Promise.resolve(resultado as ResultadoUpdate);
  return {
    eq: (...args: unknown[]) => {
      mockUpdateFiltro(...args);
      return consultaUpdate(p);
    },
    select: (...args: unknown[]) => {
      mockUpdateSelect(...args);
      return consultaUpdate(
        p.then((r) => ({
          ...r,
          data:
            r.data !== undefined ? r.data : r.error ? null : [{ id: 'linha' }],
        })),
      );
    },
    then: (
      ok: (r: ResultadoUpdate) => unknown,
      falha: (e: unknown) => unknown,
    ) => p.then(ok, falha),
  };
}
const mockUpdate = jest.fn(() => ({
  eq: (...args: unknown[]) => consultaUpdate(mockUpdateEq(...args)),
}));

// Select chain: from(table).select(cols).eq(col, val).order(col) -> { data }
const mockSelectOrder = jest.fn();
// `.maybeSingle()`: a releitura da rota quando o UPDATE do início volta vazio.
const mockSelectMaybeSingle = jest.fn();
const mockSelectEq = jest.fn(() => ({
  order: mockSelectOrder,
  maybeSingle: mockSelectMaybeSingle,
}));
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
  const { result } = renderHook(() =>
    useRouteActions({
      route: 'route' in overrides ? overrides.route! : makeRoute(),
      paradas: overrides.paradas ?? [],
      userData:
        'userData' in overrides
          ? overrides.userData!
          : { id: 'user-1', nome: 'Joao' },
      loadActiveRoute,
      portaParadas: porta,
    }),
  );
  return { ...result.current, loadActiveRoute };
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
  mockSelectMaybeSingle.mockResolvedValue({ data: null, error: null });
  // Default to web platform to avoid location tracking calls
  (Platform as any).OS = 'web';
});

// ============================================================================
// startRoute — pela RPC transacional `iniciar_rota` (Migration 88)
// ============================================================================

/**
 * O início é uma operação só no banco: a RPC confere que a rota é deste
 * motorista, ativo e com vínculo ativo na loja, e grava rota, partida e 1ª
 * parada juntas. O app não escreve mais em `rotas`/`paradas` para iniciar.
 */
describe('startRoute', () => {
  const mockRpc = jest.fn();

  beforeEach(() => {
    mockRpc.mockReset().mockResolvedValue({ data: 'iniciada', error: null });
    (supabase as unknown as { rpc: jest.Mock }).rpc = mockRpc;
  });

  it('returns early when route is null', async () => {
    const { startRoute } = setup({ route: null });
    await startRoute();
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('returns early when userData is null', async () => {
    const { startRoute } = setup({ userData: null });
    await startRoute();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('logs warn and returns when status is not pendente', async () => {
    const { startRoute } = setup({
      route: makeRoute({ status: 'em_andamento' }),
    });
    await startRoute();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('em_andamento'),
    );
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('inicia pela RPC, sem UPDATE direto em rotas/paradas', async () => {
    const checkpoint = makeParada({ id: 'cp', ordem: 0, is_checkpoint: false });
    const { startRoute } = setup({
      paradas: [checkpoint, makeParada({ id: 'p1', ordem: 1 })],
    });

    await startRoute();

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('iniciar_rota', {
      p_rota_id: 'route-1',
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('iniciada: liga o rastreamento (mobile) e recarrega a rota', async () => {
    (Platform as any).OS = 'android';
    const { startRoute, loadActiveRoute } = setup({
      paradas: [makeParada()],
      userData: { id: 'user-1', nome: 'Carlos' },
    });

    await expect(startRoute()).resolves.toBeUndefined();

    expect(requestAndStartTracking).toHaveBeenCalledWith(
      expect.objectContaining({
        rotaId: 'route-1',
        motoristaId: 'user-1',
        motoristaNome: 'Carlos',
        startedAt: expect.any(String),
      }),
    );
    expect(loadActiveRoute).toHaveBeenCalledTimes(1);
    // Iniciada agora: não precisa reler a hora do início.
    expect(mockSelectMaybeSingle).not.toHaveBeenCalled();
  });

  it('does not call requestAndStartTracking on web', async () => {
    (Platform as any).OS = 'web';
    const { startRoute, loadActiveRoute } = setup({ paradas: [makeParada()] });

    await startRoute();

    expect(requestAndStartTracking).not.toHaveBeenCalled();
    expect(loadActiveRoute).toHaveBeenCalled();
  });

  /**
   * Resposta perdida, toque duplo ou início em outro aparelho: a rota já está
   * em andamento com este motorista. A RPC completa o que faltava; o app segue
   * como iniciada, com o rastreamento a partir da hora real do início.
   */
  it('ja_iniciada: segue como iniciada, rastreando desde a hora real do início', async () => {
    (Platform as any).OS = 'android';
    mockRpc.mockResolvedValueOnce({ data: 'ja_iniciada', error: null });
    mockSelectMaybeSingle.mockResolvedValueOnce({
      data: {
        status: 'em_andamento',
        motorista_id: 'user-1',
        iniciada_em: '2026-10-26T12:00:00.000Z',
      },
      error: null,
    });
    const { startRoute, loadActiveRoute } = setup({ paradas: [makeParada()] });

    await expect(startRoute()).resolves.toBeUndefined();

    expect(requestAndStartTracking).toHaveBeenCalledWith(
      expect.objectContaining({ startedAt: '2026-10-26T12:00:00.000Z' }),
    );
    expect(loadActiveRoute).toHaveBeenCalledTimes(1);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('ja_iniciada com a releitura falhando: segue com a hora de agora', async () => {
    (Platform as any).OS = 'android';
    mockRpc.mockResolvedValueOnce({ data: 'ja_iniciada', error: null });
    mockSelectMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'falha' },
    });
    const { startRoute } = setup({ paradas: [makeParada()] });

    await expect(startRoute()).resolves.toBeUndefined();

    expect(requestAndStartTracking).toHaveBeenCalledWith(
      expect.objectContaining({ startedAt: expect.any(String) }),
    );
  });

  // A tela estava velha: o gestor cancelou, passou a rota a outro motorista,
  // ou o motorista perdeu o vínculo. Sem "Rota iniciada" e sem rastreamento.
  it.each(['situacao_mudou', 'sem_permissao'])(
    '%s: recarrega a rota, avisa e NÃO liga o rastreamento',
    async (resultado) => {
      (Platform as any).OS = 'android';
      mockRpc.mockResolvedValueOnce({ data: resultado, error: null });
      const { startRoute, loadActiveRoute } = setup({
        paradas: [makeParada()],
      });

      const erro = await startRoute().catch((e) => e);

      expect(getErrorMessage(erro).code).toBe('ROUTE_NOT_PENDING');
      expect(loadActiveRoute).toHaveBeenCalledTimes(1);
      expect(requestAndStartTracking).not.toHaveBeenCalled();
      expect(mockUpdate).not.toHaveBeenCalled();
    },
  );

  it('recusa com recarga falhando: o aviso ainda chega', async () => {
    mockRpc.mockResolvedValueOnce({ data: 'situacao_mudou', error: null });
    const { startRoute, loadActiveRoute } = setup({ paradas: [makeParada()] });
    loadActiveRoute.mockRejectedValueOnce(new Error('falha de rede'));

    const erro = await startRoute().catch((e) => e);

    expect(getErrorMessage(erro).code).toBe('ROUTE_NOT_PENDING');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('recarregar'),
      expect.any(Error),
    );
  });

  it('resposta fora do conjunto vira erro, sem anunciar início', async () => {
    (Platform as any).OS = 'android';
    mockRpc.mockResolvedValueOnce({ data: 'outra_coisa', error: null });
    const { startRoute, loadActiveRoute } = setup({ paradas: [makeParada()] });

    const erro = await startRoute().catch((e) => e);

    expect(erro).toBeInstanceOf(Error);
    expect(String(erro.message)).toContain('iniciar_rota');
    expect(requestAndStartTracking).not.toHaveBeenCalled();
    expect(loadActiveRoute).not.toHaveBeenCalled();
  });

  it('throws and logs error on supabase failure', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'DB error' },
    });
    const { startRoute } = setup({ paradas: [makeParada()] });

    await expect(startRoute()).rejects.toEqual({ message: 'DB error' });
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('iniciar rota'),
      expect.anything(),
    );
  });

  // Sem rede o supabase-js NÃO lança: devolve `{ data: null, error }`. O
  // erro vai para a tela, sem fila e sem virar "rota mudou" (não houve
  // resposta do servidor).
  it('erro de rede: relança o próprio erro, sem recarregar nem rastrear', async () => {
    (Platform as any).OS = 'android';
    const erroDeRede = {
      message: 'TypeError: Network request failed',
      details: '',
      hint: '',
      code: '',
    };
    mockRpc.mockResolvedValueOnce({ data: null, error: erroDeRede });
    const { startRoute, loadActiveRoute } = setup({ paradas: [makeParada()] });

    const erro = await startRoute().catch((e) => e);

    expect(erro).toBe(erroDeRede);
    expect(getErrorMessage(erro).code).toBe('NETWORK_ERROR');
    expect(loadActiveRoute).not.toHaveBeenCalled();
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

  it('pula pela porta com motivo; sem texto, observacao_pulo vai null', async () => {
    const { skipStop, loadActiveRoute } = setup({
      route: makeRoute({ status: 'em_andamento' }),
      paradas: [makeParada({ id: 'p1', status: 'em_andamento' })],
    });

    await expect(skipStop('p1', 'recusa')).resolves.toBe('enviada');
    expect(porta.atualizarSeAberta).toHaveBeenCalledWith('p1', {
      status: 'pulada',
      motivo_skip: 'recusa',
      observacao_pulo: null,
      concluida_em: expect.any(String),
    });
    expect(porta.avancarProxima).toHaveBeenCalledWith('route-1');
    expect(loadActiveRoute).toHaveBeenCalled();
  });

  it('o texto do pulo vai em observacao_pulo, nunca em observacoes (Migration 73)', async () => {
    const { skipStop } = setup({
      route: makeRoute({ status: 'em_andamento' }),
      paradas: [makeParada({ id: 'p1', status: 'em_andamento' })],
    });

    await skipStop('p1', 'outro', 'Chuva forte');
    expect(porta.atualizarSeAberta).toHaveBeenCalledWith('p1', {
      status: 'pulada',
      motivo_skip: 'outro',
      observacao_pulo: 'Chuva forte',
      concluida_em: expect.any(String),
    });
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
});
