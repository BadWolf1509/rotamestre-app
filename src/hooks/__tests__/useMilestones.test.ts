/**
 * Tests for useMilestones.ts
 *
 * O total de entregas vem da RPC `resumo_desempenho_motorista` (Migration 55).
 * Antes, o hook mandava `paradas .in('rota_id', <390 ids>)`: ~14 KB de URL,
 * perto do teto do gateway. O gráfico da semana conta as paradas com
 * paginação: o fake do PostgREST abaixo corta em 1.000 linhas, como o real.
 */

import { renderHook, waitFor } from '@testing-library/react-native';

import { toLocalISODate } from '@/lib/dateUtils';

import { useMilestones } from '../useMilestones';

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

const MAX_ROWS = 1000;
type Linha = Record<string, unknown>;

function consulta(todas: Linha[], inUsados: number[]) {
  const filtros: ((l: Linha) => boolean)[] = [];
  let faixa: [number, number] | null = null;
  const api = {
    select: () => api,
    eq: (c: string, v: unknown) => {
      filtros.push((l) => l[c] === v);
      return api;
    },
    gte: (c: string, v: string) => {
      filtros.push((l) => String(l[c]) >= v);
      return api;
    },
    in: (c: string, vs: unknown[]) => {
      inUsados.push(vs.length);
      filtros.push((l) => vs.includes(l[c]));
      return api;
    },
    or: () => api,
    order: () => api,
    range: (a: number, b: number) => {
      faixa = [a, b];
      return api;
    },
    then: (resolve: (r: unknown) => unknown) => {
      const f = todas.filter((l) => filtros.every((fn) => fn(l)));
      const [a, b] = faixa ?? [0, MAX_ROWS - 1];
      return Promise.resolve({
        data: f.slice(a, Math.min(b + 1, a + MAX_ROWS)),
        error: null,
      }).then(resolve);
    },
  };
  return api;
}

function montar(rotas: Linha[], paradas: Linha[]) {
  const inUsados: number[] = [];
  mockFrom.mockImplementation((t: string) =>
    consulta(t === 'rotas' ? rotas : paradas, inUsados),
  );
  return inUsados;
}

const resumo = (entregas: number, rotasConcluidas: number) =>
  mockRpc.mockResolvedValue({
    data: [
      {
        total_rotas: rotasConcluidas,
        rotas_concluidas: rotasConcluidas,
        rotas_canceladas: 0,
        distancia_total: 0,
        total_paradas: entregas,
        paradas_concluidas: entregas,
        paradas_puladas: 0,
        entregas_em_rotas_concluidas: entregas,
      },
    ],
    error: null,
  });

describe('useMilestones', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    montar([], []);
  });

  it('começa carregando, com os valores padrão', () => {
    resumo(0, 0);
    const { result } = renderHook(() =>
      useMilestones({ motoristaId: 'driver-1' }),
    );
    expect(result.current.isLoading).toBe(true);
    expect(result.current.totalEntregas).toBe(0);
    expect(result.current.nextMilestone).toBe(10);
    expect(result.current.weeklyData).toEqual([]);
  });

  it.each([
    [{}, 'sem motorista'],
    [{ motoristaId: 'driver-1', enabled: false }, 'desligado'],
  ])('%#: não consulta quando %s', async (opts, _rotulo) => {
    const { result } = renderHook(() => useMilestones(opts));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('o total de entregas vem da RPC, desde sempre, sem lista de ids', async () => {
    resumo(1273, 390);
    const inUsados = montar([], []);

    const { result } = renderHook(() =>
      useMilestones({ motoristaId: 'driver-1' }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockRpc).toHaveBeenCalledWith('resumo_desempenho_motorista', {
      p_motorista_id: 'driver-1',
      p_dias: null,
    });
    expect(result.current.totalEntregas).toBe(1273);
    expect(result.current.totalRotas).toBe(390);
    expect(result.current.currentMilestone).toBe(1000);
    expect(result.current.nextMilestone).toBeNull();
    expect(result.current.progress).toBe(100);
    // Nenhum `.in` com as 390 rotas concluídas.
    expect(inUsados).toEqual([]);
  });

  it('progresso até o próximo marco', async () => {
    resumo(30, 5);
    const { result } = renderHook(() =>
      useMilestones({ motoristaId: 'driver-1' }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.currentMilestone).toBe(25);
    expect(result.current.nextMilestone).toBe(50);
    expect(result.current.remaining).toBe(20);
    expect(result.current.progress).toBe(20);
  });

  it('o gráfico da semana conta todas as paradas do dia, acima de 1.000', async () => {
    resumo(1200, 2);
    const hoje = new Date();
    hoje.setHours(12, 0, 0, 0);
    const rotas = ['ra', 'rb'].map((id) => ({
      id,
      motorista_id: 'driver-1',
      status: 'concluida',
      concluida_em: hoje.toISOString(),
    }));
    const paradas: Linha[] = [];
    for (const r of rotas) {
      paradas.push({ id: `${r.id}-ini`, rota_id: r.id, status: 'concluida', is_checkpoint: false });
      for (let i = 0; i < 600; i++) {
        paradas.push({
          id: `${r.id}-${String(i).padStart(3, '0')}`,
          rota_id: r.id,
          status: i < 590 ? 'concluida' : 'pulada',
          is_checkpoint: i % 2 ? true : null,
        });
      }
    }
    montar(rotas, paradas);

    const { result } = renderHook(() =>
      useMilestones({ motoristaId: 'driver-1' }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const dia = result.current.weeklyData.find(
      (d) => d.date === toLocalISODate(hoje),
    );
    expect(dia).toEqual(
      expect.objectContaining({ rotas: 2, entregas: 2 * 590 }),
    );
    expect(result.current.weeklyData).toHaveLength(7);
    expect(result.current.bestDay).toBe(1180);
  });

  it('erro da RPC vira estado de erro', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'Sem permissão' },
    });
    const { result } = renderHook(() =>
      useMilestones({ motoristaId: 'driver-1' }),
    );
    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.isLoading).toBe(false);
  });
});
