/**
 * useDashboardData contra um banco falso que aplica os filtros de verdade
 * (eq/gte/lte/in/is, inclusive em coluna de tabela embutida como
 * `rotas.unidade_id`), em vez de mock que só registra chamadas.
 *
 * Cobre:
 * - "Hoje" sem limite superior incluía rotas de amanhã (gte sem lte).
 * - Recarga concorrente descartada: com carga em voo, a troca de filtro
 *   não rodava (`if (loadingRef.current) return`).
 * - Incidentes contados pelos motoristas da loja, não pela loja da rota.
 * - Erro de carga engolido pelo logger, sem estado.
 */
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { getTodayISO, toLocalISODate } from '@/lib/dateUtils';

import { useDashboardData } from '../useDashboardData';

jest.mock('@/hooks/useUser', () => ({
  useUser: () => ({ userData: { id: 'g1', nome: 'Gestor' } }),
}));
jest.mock('@/hooks/useRealtimeRoutes', () => ({
  useRealtimeRoutes: jest.fn(),
}));
jest.mock('@/hooks/useUnidadeAtiva', () => ({
  useUnidadeAtiva: () => ({ unidadeAtiva: 'loja-a' }),
}));
jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

type Linha = Record<string, unknown>;

const mockTabelas: Record<string, Linha[]> = {};
// Permite segurar a resposta de uma consulta de `rotas` (pela chave do
// filtro de status) para simular carga em voo.
const mockSeguradas: Record<string, Promise<void>> = {};
let mockFalharRotas = false;
// Tabelas cujas consultas devolvem erro (ex.: 'incidentes', 'usuario_unidades').
const mockTabelasComErro = new Set<string>();
// Registro de cada consulta (tabela + colunas pedidas).
const mockConsultas: { tabela: string; colunas: string; head: boolean }[] = [];
// Qual consulta de KPI (a 1ª é a da semana, a 2ª a do mês) devolve erro.
let mockKpiComErro: 'semana' | 'mes' | null = null;
let mockKpiContador = 0;

function mockValor(linha: Linha, coluna: string): unknown {
  return coluna
    .split('.')
    .reduce<unknown>((o, k) => (o as Linha | null)?.[k], linha);
}

function mockQuery(tabela: string) {
  const filtros: ((l: Linha) => boolean)[] = [];
  let contar = false;
  let statusFiltrado: string | null = null;
  let kpiDesta: 'semana' | 'mes' | null = null;
  const api = {
    select: (cols?: string, opts?: { count?: string; head?: boolean }) => {
      if (tabela === 'rotas' && (cols ?? '').includes('iniciada_em')) {
        kpiDesta = mockKpiContador++ % 2 === 0 ? 'semana' : 'mes';
      }
      mockConsultas.push({
        tabela,
        colunas: (cols ?? '').replace(/\s+/g, ' '),
        head: !!opts?.head,
      });
      contar = !!opts?.head;
      return api;
    },
    eq: (c: string, v: unknown) => {
      if (tabela === 'rotas' && c === 'status') statusFiltrado = v as string;
      filtros.push((l) => mockValor(l, c) === v);
      return api;
    },
    gte: (c: string, v: string) => {
      filtros.push((l) => String(mockValor(l, c)) >= v);
      return api;
    },
    lte: (c: string, v: string) => {
      filtros.push((l) => String(mockValor(l, c)) <= v);
      return api;
    },
    in: (c: string, vs: unknown[]) => {
      filtros.push((l) => vs.includes(mockValor(l, c)));
      return api;
    },
    is: (c: string, v: unknown) => {
      filtros.push((l) => (mockValor(l, c) ?? null) === v);
      return api;
    },
    order: () => api,
    then: (resolve: (v: unknown) => void, reject: (e: unknown) => void) => {
      const segura =
        tabela === 'rotas' ? mockSeguradas[statusFiltrado ?? 'todas'] : null;
      Promise.resolve(segura)
        .then(() => {
          if (tabela === 'rotas' && mockFalharRotas) {
            return { data: null, error: { message: 'rede' } };
          }
          if (kpiDesta && kpiDesta === mockKpiComErro) {
            return { data: null, error: { message: 'kpi falhou' } };
          }
          if (mockTabelasComErro.has(tabela)) {
            return { data: null, count: null, error: { message: 'falhou' } };
          }
          const linhas = (mockTabelas[tabela] ?? []).filter((l) =>
            filtros.every((f) => f(l)),
          );
          return contar
            ? { data: null, count: linhas.length, error: null }
            : { data: linhas, error: null };
        })
        .then(resolve, reject);
    },
  };
  return api;
}

// RPC nomes_motoristas_das_rotas (Migration 72): rota_id → nome.
const mockNomesForaDaLoja: Record<string, string> = {};
const mockRpc = jest.fn(
  (_nome: string, { p_rota_ids }: { p_rota_ids: string[] }) =>
    Promise.resolve({
      data: p_rota_ids
        .filter((id) => mockNomesForaDaLoja[id])
        .map((id) => ({ rota_id: id, nome: mockNomesForaDaLoja[id] })),
      error: null,
    }),
);

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (t: string) => mockQuery(t),
    rpc: (nome: string, args: { p_rota_ids: string[] }) => mockRpc(nome, args),
  },
  isSupabaseConfigured: true,
}));

const hoje = getTodayISO();
const amanha = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toLocalISODate(d);
})();

function rota(id: string, data: string, status = 'pendente', loja = 'loja-a') {
  return {
    id,
    data,
    status,
    unidade_id: loja,
    distancia_total: 1,
    motorista_id: 'm1',
    usuarios: { nome: 'Ana' },
    paradas: [],
  };
}

beforeEach(() => {
  mockConsultas.length = 0;
  mockRpc.mockClear();
  for (const k of Object.keys(mockNomesForaDaLoja)) {
    delete mockNomesForaDaLoja[k];
  }
  mockFalharRotas = false;
  mockKpiComErro = null;
  mockKpiContador = 0;
  mockTabelasComErro.clear();
  for (const k of Object.keys(mockSeguradas)) delete mockSeguradas[k];
  mockTabelas.rotas = [
    rota('hoje-1', hoje),
    rota('hoje-2', hoje, 'concluida'),
    rota('amanha-1', amanha),
    rota('outra-loja', hoje, 'pendente', 'loja-b'),
  ];
  // Ana (m1) atende as duas lojas; Bia (m2) só a loja A.
  mockTabelas.usuario_unidades = [
    { usuario_id: 'm1', unidade_id: 'loja-a', papel: 'motorista', ativo: true },
    { usuario_id: 'm1', unidade_id: 'loja-b', papel: 'motorista', ativo: true },
    { usuario_id: 'm2', unidade_id: 'loja-a', papel: 'motorista', ativo: true },
  ];
  // A loja vem gravada no incidente (`unidade_id`, Migration 43).
  mockTabelas.incidentes = [
    // da rota da loja A: conta
    {
      id: 'i1',
      status: 'aberto',
      motorista_id: 'm1',
      rota_id: 'hoje-1',
      unidade_id: 'loja-a',
      rotas: { unidade_id: 'loja-a' },
    },
    // da rota da loja B, mesma motorista: NÃO conta na loja A
    {
      id: 'i2',
      status: 'aberto',
      motorista_id: 'm1',
      rota_id: 'outra-loja',
      unidade_id: 'loja-b',
      rotas: { unidade_id: 'loja-b' },
    },
    // sem rota, gravado na loja A: conta
    {
      id: 'i3',
      status: 'aberto',
      motorista_id: 'm2',
      rota_id: null,
      rotas: null,
      unidade_id: 'loja-a',
    },
    // resolvido: não conta
    {
      id: 'i4',
      status: 'resolvido',
      motorista_id: 'm2',
      rota_id: 'hoje-1',
      unidade_id: 'loja-a',
      rotas: { unidade_id: 'loja-a' },
    },
    // sem rota, da Ana (atende A e B), gravado na loja B: NÃO conta na A —
    // o vínculo da motorista com esta loja não traz o incidente da outra
    {
      id: 'i5',
      status: 'aberto',
      motorista_id: 'm1',
      rota_id: null,
      rotas: null,
      unidade_id: 'loja-b',
    },
  ];
});

describe('useDashboardData — KPI que falha', () => {
  it('consulta da semana com erro: rotasSemana é null (não 0) e o mês segue', async () => {
    mockKpiComErro = 'semana';
    const { result } = renderHook(() => useDashboardData());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.kpis.rotasSemana).toBeNull();
    expect(result.current.kpis.rotasMes).toBe(2);
  });

  it('consulta do mês com erro: rotasMes, tempo médio e destaque ficam null', async () => {
    mockKpiComErro = 'mes';
    const { result } = renderHook(() => useDashboardData());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.kpis.rotasMes).toBeNull();
    expect(result.current.kpis.tempoMedioMinutos).toBeNull();
    expect(result.current.kpis.motoristaDestaque).toBeNull();
    expect(result.current.kpis.rotasSemana).not.toBeNull();
  });

  it('motorista_id com embed escondido pela RLS não vira "Sem motorista"', async () => {
    mockTabelas.rotas = [
      { ...rota('oculta', hoje), usuarios: null },
      { ...rota('sem', hoje), motorista_id: null, usuarios: null },
    ];
    const { result } = renderHook(() => useDashboardData());

    await waitFor(() => expect(result.current.loading).toBe(false));
    const nome = (id: string) =>
      result.current.rotas.find((r) => r.id === id)?.motorista_nome;
    expect(nome('oculta')).toBe('Motorista removido da loja');
    expect(nome('sem')).toBe('Sem motorista');
  });

  it("rota oculta com nome devolvido pela RPC mostra 'Nome (fora da loja)'", async () => {
    mockTabelas.rotas = [
      { ...rota('oculta', hoje), motorista_id: 'm9', usuarios: null },
      { ...rota('oculta-sem-nome', hoje), motorista_id: 'm8', usuarios: null },
      rota('visivel', hoje),
    ];
    mockNomesForaDaLoja.oculta = 'Bia';
    const { result } = renderHook(() => useDashboardData());

    await waitFor(() => expect(result.current.loading).toBe(false));
    const nome = (id: string) =>
      result.current.rotas.find((r) => r.id === id)?.motorista_nome;
    expect(nome('oculta')).toBe('Bia (fora da loja)');
    expect(nome('oculta-sem-nome')).toBe('Motorista removido da loja');
    expect(nome('visivel')).toBe('Ana');
    // Só as ocultas vão à RPC.
    const ids = mockRpc.mock.calls.flatMap(([, a]) => a.p_rota_ids);
    expect(ids.sort()).toEqual(['oculta', 'oculta-sem-nome']);
  });
});

describe('useDashboardData — período "hoje"', () => {
  it('sem filtro de data, lista só as rotas de hoje (não as de amanhã)', async () => {
    const { result } = renderHook(() => useDashboardData());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rotas.map((r) => r.id).sort()).toEqual([
      'hoje-1',
      'hoje-2',
    ]);
    expect(result.current.todayStats.totalHoje).toBe(2);
  });

  it('KPIs do mês não contam rota futura', async () => {
    const { result } = renderHook(() => useDashboardData());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.kpis.rotasMes).toBe(2);
  });

  it('o total de hoje sai de contagem HEAD (sem baixar as linhas)', async () => {
    const { result } = renderHook(() => useDashboardData());

    await waitFor(() => expect(result.current.loading).toBe(false));
    const contagensDeRotas = mockConsultas.filter(
      (c) => c.tabela === 'rotas' && c.head && c.colunas === 'id',
    );
    expect(contagensDeRotas).toHaveLength(1);
    expect(
      mockConsultas.some(
        (c) => c.tabela === 'rotas' && !c.head && c.colunas === 'id',
      ),
    ).toBe(false);
    expect(result.current.todayStats.totalHoje).toBe(2);
  });

  it('período com só dataInicio tem teto de 60 dias à frente de hoje', async () => {
    const em = (dias: number) => {
      const d = new Date();
      d.setDate(d.getDate() + dias);
      return toLocalISODate(d);
    };
    mockTabelas.rotas.push(
      rota('daqui-30', em(30)),
      rota('daqui-60', em(60)),
      rota('daqui-90', em(90)),
    );
    const { result } = renderHook(() =>
      useDashboardData({ filters: { dataInicio: new Date() } }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    const ids = result.current.rotas.map((r) => r.id);
    expect(ids).toContain('daqui-30');
    expect(ids).toContain('daqui-60');
    expect(ids).not.toContain('daqui-90');
  });

  it('com dataFim explícita, o teto não corta o que o gestor pediu', async () => {
    const dLonge = new Date();
    dLonge.setDate(dLonge.getDate() + 90);
    const longe = toLocalISODate(dLonge);
    mockTabelas.rotas.push(rota('daqui-90', longe));
    const { result } = renderHook(() =>
      useDashboardData({
        filters: { dataInicio: new Date(), dataFim: dLonge },
      }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rotas.map((r) => r.id)).toContain('daqui-90');
  });
});

describe('useDashboardData — incidentes abertos', () => {
  it('conta pela loja gravada no incidente, com ou sem rota', async () => {
    const { result } = renderHook(() => useDashboardData());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.stats.incidentesAbertos).toBe(2);
  });

  // Erro na contagem virava 0 calado: "0 incidentes abertos" é uma
  // afirmação, e falsa. Indisponível = null (a tela mostra "—").
  it('erro na contagem de incidentes da loja: indisponível, não 0', async () => {
    mockTabelasComErro.add('incidentes');
    const { result } = renderHook(() => useDashboardData());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.stats.incidentesAbertos).toBeNull();
  });

  // (o teste "erro ao ler os vínculos dos motoristas" saiu: a contagem não
  // lê mais os vínculos — a loja vem gravada no incidente)
});

describe('useDashboardData — recarga concorrente', () => {
  it('trocar o filtro com carga em voo roda a nova carga e descarta a velha', async () => {
    let soltarVelha: () => void = () => {};
    mockSeguradas.todas = new Promise<void>((r) => {
      soltarVelha = r;
    });

    const { result, rerender } = renderHook(
      ({ status }: { status: string | null }) =>
        useDashboardData({ filters: { status } }),
      { initialProps: { status: null as string | null } },
    );

    rerender({ status: 'concluida' });

    await waitFor(() =>
      expect(result.current.rotas.map((r) => r.id)).toEqual(['hoje-2']),
    );

    // A resposta velha (sem filtro) chega depois: não pode sobrescrever.
    await act(async () => {
      soltarVelha();
      await Promise.resolve();
    });
    expect(result.current.rotas.map((r) => r.id)).toEqual(['hoje-2']);
  });
});

describe('useDashboardData — erro de carga', () => {
  it('expõe o erro e "tentar novamente" (onRefresh) recarrega', async () => {
    mockFalharRotas = true;
    const { result } = renderHook(() => useDashboardData());

    await waitFor(() => expect(result.current.erroCarga).toBeTruthy());
    expect(result.current.dadosDe).toBeNull();

    mockFalharRotas = false;
    await act(async () => {
      await result.current.onRefresh();
    });
    expect(result.current.erroCarga).toBeNull();
    expect(result.current.rotas).toHaveLength(2);
  });

  it('falha numa recarga mantém os dados e diz de quando são', async () => {
    const { result } = renderHook(() => useDashboardData());
    await waitFor(() => expect(result.current.rotas).toHaveLength(2));

    mockFalharRotas = true;
    await act(async () => {
      await result.current.onRefresh();
    });

    expect(result.current.erroCarga).toBeTruthy();
    expect(result.current.rotas).toHaveLength(2);
    expect(typeof result.current.dadosDe).toBe('number');
  });
});

// DP-7: cada evento de realtime rodava as 5 consultas, inclusive as duas de
// KPI da semana e do mês (as mais pesadas). Agora o evento atualiza só o que
// muda com rota/parada (a lista e o "hoje"); KPIs e incidentes ficam para a
// carga inicial, a troca de filtro e o refresh manual.
describe('useDashboardData — eventos de realtime', () => {
  const realtimeMock = () =>
    jest.requireMock('@/hooks/useRealtimeRoutes')
      .useRealtimeRoutes as jest.Mock;
  /** O `onRouteUpdate` do último render (já com o debounce do hook). */
  const dispararEvento = () => {
    const chamadas = realtimeMock().mock.calls;
    return chamadas[chamadas.length - 1][0].onRouteUpdate();
  };
  const consultasDeKpi = () =>
    mockConsultas.filter(
      (c) => c.tabela === 'rotas' && c.colunas.includes('iniciada_em'),
    ).length;
  const consultasDeIncidentes = () =>
    mockConsultas.filter((c) => c.tabela === 'incidentes').length;

  it('evento atualiza a lista e o "hoje" sem refazer KPIs nem incidentes', async () => {
    const { result } = renderHook(() => useDashboardData());
    await waitFor(() => expect(result.current.rotas).toHaveLength(2));
    const kpisAntes = consultasDeKpi();
    const incidentesAntes = consultasDeIncidentes();
    expect(kpisAntes).toBe(2);

    mockTabelas.rotas.push({
      ...rota('hoje-3', hoje, 'concluida'),
      paradas: [{ id: 'p', status: 'concluida', is_checkpoint: true }],
    });
    await act(async () => {
      await dispararEvento();
    });

    await waitFor(() => expect(result.current.rotas).toHaveLength(3));
    expect(result.current.todayStats.totalHoje).toBe(3);
    // Derivados da lista acompanham o evento.
    expect(result.current.kpis.totalParadas).toBe(1);
    expect(result.current.kpis.taxaSucesso).toBe(100);
    // KPIs de semana/mês e incidentes: só na carga completa.
    expect(consultasDeKpi()).toBe(kpisAntes);
    expect(consultasDeIncidentes()).toBe(incidentesAntes);
    expect(result.current.kpis.rotasMes).toBe(2);
    // O evento não liga o "atualizando" da tela.
    expect(result.current.refreshing).toBe(false);
  });

  it('refresh manual refaz os KPIs', async () => {
    const { result } = renderHook(() => useDashboardData());
    await waitFor(() => expect(result.current.rotas).toHaveLength(2));
    mockTabelas.rotas.push(rota('hoje-3', hoje, 'concluida'));

    await act(async () => {
      await result.current.onRefresh();
    });

    expect(consultasDeKpi()).toBe(4);
    expect(result.current.kpis.rotasMes).toBe(3);
  });

  it('evento com a carga completa em voo não descarta os KPIs dela', async () => {
    let soltar: () => void = () => {};
    mockSeguradas.todas = new Promise<void>((r) => {
      soltar = r;
    });
    const { result } = renderHook(() => useDashboardData());

    await act(async () => {
      void dispararEvento();
      soltar();
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    await waitFor(() => expect(result.current.kpis.rotasMes).toBe(2));
    expect(result.current.rotas).toHaveLength(2);
  });
});
