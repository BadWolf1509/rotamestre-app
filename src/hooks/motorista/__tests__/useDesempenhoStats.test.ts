/**
 * useDesempenhoStats - Tests
 *
 * Os totais vêm da RPC `resumo_desempenho_motorista` (Migration 55). Antes, o
 * hook buscava as rotas e depois `paradas .in('rota_id', todas)`: acima de
 * 1.000 paradas o PostgREST cortava a resposta sem erro e os contadores
 * ficavam errados (motorista real: 393 rotas, 2.235 paradas).
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';

const mockRpc = jest.fn();
const mockFrom = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

import { logger } from '@/lib/logger';

import { useDesempenhoStats } from '../useDesempenhoStats';

const linha = (over: Record<string, unknown> = {}) => ({
  desde: null,
  total_rotas: 0,
  rotas_concluidas: 0,
  rotas_canceladas: 0,
  distancia_total: 0,
  total_paradas: 0,
  paradas_concluidas: 0,
  paradas_puladas: 0,
  entregas_em_rotas_concluidas: 0,
  ...over,
});

const rpcDevolve = (over: Record<string, unknown> = {}) =>
  mockRpc.mockResolvedValue({ data: [linha(over)], error: null });

describe('useDesempenhoStats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sem userId não chama nada e fica sem stats', async () => {
    const { result } = renderHook(() => useDesempenhoStats(undefined));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.stats).toBeNull();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('o padrão é 30 dias e vai à RPC com o motorista', async () => {
    rpcDevolve();
    const { result } = renderHook(() => useDesempenhoStats('m1'));
    expect(result.current.periodo).toBe('30d');
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockRpc).toHaveBeenCalledWith('resumo_desempenho_motorista', {
      p_motorista_id: 'm1',
      p_dias: 30,
    });
    // Nenhuma consulta de lista: os totais vêm prontos.
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('mostra os totais do motorista grande sem corte (393 rotas, 1.449 paradas)', async () => {
    rpcDevolve({
      total_rotas: 393,
      rotas_concluidas: 390,
      rotas_canceladas: 1,
      distancia_total: '18241.94',
      total_paradas: 1449,
      paradas_concluidas: 1273,
      paradas_puladas: 160,
    });
    const { result } = renderHook(() => useDesempenhoStats('m1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.stats).toEqual({
      totalRotas: 393,
      rotasConcluidas: 390,
      rotasCanceladas: 1,
      taxaSucesso: 99,
      totalKm: 18241.94,
      mediaParadasPorRota: 4,
      totalParadas: 1449,
      paradasConcluidas: 1273,
      paradasPuladas: 160,
    });
    expect(result.current.error).toBeNull();
  });

  it('sem rotas: zeros, sem dividir por zero', async () => {
    rpcDevolve();
    const { result } = renderHook(() => useDesempenhoStats('m1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.stats).toMatchObject({
      totalRotas: 0,
      taxaSucesso: 0,
      mediaParadasPorRota: 0,
      totalKm: 0,
    });
  });

  it.each([
    // 30d é o padrão, coberto acima.
    ['7d', 7],
    ['all', null],
  ] as const)('o período %s vira p_dias = %s', async (periodo, dias) => {
    rpcDevolve();
    const { result } = renderHook(() => useDesempenhoStats('m1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    mockRpc.mockClear();

    act(() => result.current.setPeriodo(periodo));

    await waitFor(() =>
      expect(mockRpc).toHaveBeenCalledWith('resumo_desempenho_motorista', {
        p_motorista_id: 'm1',
        p_dias: dias,
      }),
    );
  });

  it('erro da RPC vira a mensagem da tela e limpa no próximo sucesso', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { code: '42501', message: 'Sem permissão' },
    });
    const { result } = renderHook(() => useDesempenhoStats('m1'));
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.stats).toBeNull();
    expect(logger.error).toHaveBeenCalled();

    rpcDevolve({ total_rotas: 2, rotas_concluidas: 2 });
    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.stats?.totalRotas).toBe(2));
    expect(result.current.error).toBeNull();
    expect(result.current.refreshing).toBe(false);
  });

  it('troca de motorista recarrega; userId some limpa', async () => {
    rpcDevolve({ total_rotas: 1 });
    const { result, rerender } = renderHook(
      ({ id }: { id: string | undefined }) => useDesempenhoStats(id),
      { initialProps: { id: 'm1' as string | undefined } },
    );
    await waitFor(() => expect(result.current.stats?.totalRotas).toBe(1));

    rpcDevolve({ total_rotas: 5 });
    rerender({ id: 'm2' });
    await waitFor(() => expect(result.current.stats?.totalRotas).toBe(5));
    expect(mockRpc).toHaveBeenLastCalledWith('resumo_desempenho_motorista', {
      p_motorista_id: 'm2',
      p_dias: 30,
    });

    rerender({ id: undefined });
    await waitFor(() => expect(result.current.stats).toBeNull());
  });
});
