/**
 * useHistoricoData: o período e o status vão ao banco, em páginas de 50.
 *
 * O fake de `rotas` aplica gte/lte/eq e `range`, devolve o `count` exato e
 * guarda cada chamada, para provar o que o hook pediu ao banco. Antes o hook
 * baixava todas as rotas e filtrava no aparelho.
 */
import { act, renderHook, waitFor } from '@testing-library/react-native';

const mockFrom = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));

const mockUserData = { id: 'user-1', papel: 'motorista' };
const mockUsuario = { carregando: false };
jest.mock('@/hooks/useUser', () => ({
  useUser: () => ({
    userData: mockUsuario.carregando ? null : mockUserData,
    loading: mockUsuario.carregando,
  }),
}));

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

import { logger } from '@/lib/logger';

import { useHistoricoData } from '../useHistoricoData';

import type { FiltroStatus } from '../types';

const mockShowError = (global as any).mockUseAlert.showError;

type Linha = Record<string, unknown>;

interface Chamadas {
  gte: unknown[][];
  lte: unknown[][];
  eq: unknown[][];
  order: unknown[][];
  range: unknown[][];
}
let chamadas: Chamadas;
let consultasDeRotas: number;

function consulta(todas: Linha[], erro: unknown, registrar: boolean) {
  const filtros: ((l: Linha) => boolean)[] = [];
  let faixa: [number, number] | null = null;
  const reg = (k: keyof Chamadas, args: unknown[]) => {
    if (registrar) chamadas[k].push(args);
  };
  const api = {
    select: () => api,
    eq: (c: string, v: unknown) => {
      reg('eq', [c, v]);
      filtros.push((l) => l[c] === v);
      return api;
    },
    gte: (c: string, v: string) => {
      reg('gte', [c, v]);
      filtros.push((l) => String(l[c]) >= v);
      return api;
    },
    lte: (c: string, v: string) => {
      reg('lte', [c, v]);
      filtros.push((l) => String(l[c]) <= v);
      return api;
    },
    in: (c: string, vs: unknown[]) => {
      filtros.push((l) => vs.includes(l[c]));
      return api;
    },
    order: (...a: unknown[]) => {
      reg('order', a);
      return api;
    },
    range: (a: number, b: number) => {
      reg('range', [a, b]);
      faixa = [a, b];
      return api;
    },
    returns: () => api,
    then: (resolve: (r: unknown) => unknown) => {
      if (erro)
        return Promise.resolve({ data: null, error: erro }).then(resolve);
      const f = todas.filter((l) => filtros.every((fn) => fn(l)));
      const [a, b] = faixa ?? [0, 999];
      return Promise.resolve({
        data: f.slice(a, b + 1),
        count: f.length,
        error: null,
      }).then(resolve);
    },
  };
  return api;
}

function montar(
  rotas: Linha[],
  paradas: Linha[],
  erros: { rotas?: unknown; paradas?: unknown } = {},
) {
  mockFrom.mockImplementation((t: string) => {
    if (t === 'rotas') {
      consultasDeRotas++;
      return consulta(rotas, erros.rotas, true);
    }
    return consulta(paradas, erros.paradas, false);
  });
}

function rota(id: string, over: Linha = {}): Linha {
  return {
    id,
    motorista_id: 'user-1',
    data: '2026-11-05',
    status: 'concluida',
    distancia_total: 10,
    iniciada_em: null,
    concluida_em: null,
    unidades: { nome: 'Unidade A' },
    ...over,
  };
}

/** n rotas com partida + 3 concluídas + 1 pendente + chegada. */
function cenario(n: number) {
  const rotas: Linha[] = [];
  const paradas: Linha[] = [];
  for (let i = 0; i < n; i++) {
    const id = `r${String(i).padStart(4, '0')}`;
    rotas.push(rota(id));
    paradas.push(
      { id: `${id}-0`, rota_id: id, status: 'concluida', is_checkpoint: false },
      { id: `${id}-1`, rota_id: id, status: 'concluida', is_checkpoint: null },
      { id: `${id}-2`, rota_id: id, status: 'concluida', is_checkpoint: true },
      { id: `${id}-3`, rota_id: id, status: 'concluida', is_checkpoint: null },
      { id: `${id}-4`, rota_id: id, status: 'pendente', is_checkpoint: true },
      { id: `${id}-5`, rota_id: id, status: 'pendente', is_checkpoint: false },
    );
  }
  return { rotas, paradas };
}

interface Props {
  carregado?: boolean;
  de?: string | null;
  ate?: string | null;
  status?: FiltroStatus;
}
const entrada = (p: Props = {}) => ({
  carregado: true,
  de: '2026-11-01' as string | null,
  ate: '2026-11-30' as string | null,
  status: 'todos' as FiltroStatus,
  ...p,
});

describe('useHistoricoData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserData.id = 'user-1';
    mockUsuario.carregando = false;
    consultasDeRotas = 0;
    chamadas = { gte: [], lte: [], eq: [], order: [], range: [] };
  });

  it('começa carregando', () => {
    montar([], []);
    const { result } = renderHook(() => useHistoricoData(entrada()));
    expect(result.current.loading).toBe(true);
  });

  it('o período e a ordem vão ao banco, numa página só (range 0-49), sem loop', async () => {
    const { rotas, paradas } = cenario(393);
    montar(rotas, paradas);

    const { result } = renderHook(() => useHistoricoData(entrada()));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(chamadas.gte).toEqual([['data', '2026-11-01']]);
    expect(chamadas.lte).toEqual([['data', '2026-11-30']]);
    expect(chamadas.order).toEqual([
      ['data', { ascending: false }],
      ['id', { ascending: false }],
    ]);
    expect(chamadas.range).toEqual([[0, 49]]);
    expect(consultasDeRotas).toBe(1);
    expect(result.current.rotas).toHaveLength(50);
    expect(result.current.total).toBe(393);
    expect(result.current.temMais).toBe(true);
    // Contagem de paradas só da página; partida/chegada não contam.
    expect(result.current.rotas.every((r) => r.paradas_count === 4)).toBe(true);
    expect(result.current.rotas.every((r) => r.paradas_concluidas === 3)).toBe(
      true,
    );
  });

  it('"Hoje" não traz a rota de amanhã (lte data = hoje)', async () => {
    montar(
      [
        rota('hoje', { data: '2026-11-10' }),
        rota('amanha', { data: '2026-11-11' }),
      ],
      [],
    );
    const { result } = renderHook(() =>
      useHistoricoData(entrada({ de: '2026-11-10', ate: '2026-11-10' })),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(chamadas.lte).toEqual([['data', '2026-11-10']]);
    expect(result.current.rotas.map((r) => r.id)).toEqual(['hoje']);
  });

  it('Todo o período não manda gte nem lte', async () => {
    montar([rota('a')], []);
    const { result } = renderHook(() =>
      useHistoricoData(entrada({ de: null, ate: null })),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(chamadas.gte).toEqual([]);
    expect(chamadas.lte).toEqual([]);
  });

  it('o chip de status filtra no banco', async () => {
    montar([rota('a'), rota('b', { status: 'cancelada' })], []);
    const { result } = renderHook(() =>
      useHistoricoData(entrada({ status: 'cancelada' })),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(chamadas.eq).toContainEqual(['status', 'cancelada']);
    expect(result.current.rotas.map((r) => r.id)).toEqual(['b']);
    expect(result.current.total).toBe(1);
  });

  it('Carregar mais pede a página seguinte e acrescenta', async () => {
    const { rotas, paradas } = cenario(120);
    montar(rotas, paradas);
    const { result } = renderHook(() => useHistoricoData(entrada()));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.carregarMais());
    await waitFor(() => expect(result.current.rotas).toHaveLength(100));
    expect(chamadas.range).toEqual([
      [0, 49],
      [50, 99],
    ]);
    expect(result.current.rotas[99].id).toBe('r0099');

    act(() => result.current.carregarMais());
    await waitFor(() => expect(result.current.rotas).toHaveLength(120));
    expect(result.current.temMais).toBe(false);

    // Lista completa: não pede mais.
    act(() => result.current.carregarMais());
    expect(chamadas.range).toHaveLength(3);
  });

  it('só as rotas do motorista logado', async () => {
    montar([rota('minha'), rota('alheia', { motorista_id: 'outro' })], []);
    const { result } = renderHook(() => useHistoricoData(entrada()));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rotas.map((r) => r.id)).toEqual(['minha']);
  });

  it('sem rotas: lista vazia, sem buscar paradas', async () => {
    montar([], []);
    const { result } = renderHook(() => useHistoricoData(entrada()));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rotas).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalledWith('paradas');
  });

  it('período lembrado ainda não lido: não consulta e segue carregando', async () => {
    montar([rota('a')], []);
    const { result } = renderHook(() =>
      useHistoricoData(entrada({ carregado: false })),
    );
    await act(async () => {});
    expect(mockFrom).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(true);
  });

  it('erro nas rotas mostra o alerta', async () => {
    montar([], [], { rotas: { message: 'falhou' } });
    const { result } = renderHook(() => useHistoricoData(entrada()));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(logger.error).toHaveBeenCalled();
    expect(mockShowError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Não foi possível carregar o histórico',
      }),
    );
  });

  it('erro nas paradas também mostra o alerta, sem contadores zerados', async () => {
    montar([rota('r1')], [], { paradas: { message: 'falhou' } });
    const { result } = renderHook(() => useHistoricoData(entrada()));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockShowError).toHaveBeenCalled();
    expect(result.current.rotas).toEqual([]);
  });

  it('perfil ainda carregando: continua carregando, sem mostrar o vazio', async () => {
    mockUsuario.carregando = true;
    montar([], []);
    const { result } = renderHook(() => useHistoricoData(entrada()));
    await act(async () => {});
    expect(result.current.loading).toBe(true);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('sem usuário: vazio, sem consulta', async () => {
    mockUserData.id = '';
    montar([], []);
    const { result } = renderHook(() => useHistoricoData(entrada()));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rotas).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('refresh recarrega a primeira página e desliga o refreshing', async () => {
    montar([rota('r1')], []);
    const { result } = renderHook(() => useHistoricoData(entrada()));
    await waitFor(() => expect(result.current.loading).toBe(false));

    montar([rota('r1'), rota('r2')], []);
    act(() => result.current.onRefresh());
    await waitFor(() => expect(result.current.rotas).toHaveLength(2));
    expect(result.current.refreshing).toBe(false);
  });

  it('trocar de período rápido: a resposta velha não sobrescreve a nova', async () => {
    // A 1ª consulta (Este mês) fica pendente; a 2ª (outro período) responde antes.
    let soltarVelha: (v: unknown) => void = () => {};
    const velha = new Promise((resolve) => {
      soltarVelha = resolve;
    });
    const consultaVelha = {
      select: () => consultaVelha,
      eq: () => consultaVelha,
      gte: () => consultaVelha,
      lte: () => consultaVelha,
      order: () => consultaVelha,
      range: () => consultaVelha,
      returns: () => consultaVelha,
      then: (resolve: (r: unknown) => unknown) => velha.then(resolve),
    };
    montar(
      [
        rota('nova1', { data: '2026-10-05' }),
        rota('nova2', { data: '2026-10-04' }),
      ],
      [],
    );
    const normal = mockFrom.getMockImplementation();
    mockFrom.mockImplementationOnce(() => consultaVelha);
    mockFrom.mockImplementation(normal as never);

    const { result, rerender } = renderHook(
      (p: Props) => useHistoricoData(entrada(p)),
      { initialProps: {} as Props },
    );
    rerender({ de: '2026-10-01', ate: '2026-10-31' });
    await waitFor(() => expect(result.current.rotas).toHaveLength(2));

    await act(async () => {
      soltarVelha({ data: [rota('velha')], count: 1, error: null });
      await Promise.resolve();
    });

    expect(result.current.rotas.map((r) => r.id)).toEqual(['nova1', 'nova2']);
    expect(result.current.loading).toBe(false);
  });

  it('refresh que falha mantém a lista que estava na tela e só mostra o alerta', async () => {
    montar([rota('r1'), rota('r2')], []);
    const { result } = renderHook(() => useHistoricoData(entrada()));
    await waitFor(() => expect(result.current.rotas).toHaveLength(2));

    montar([], [], { rotas: { message: 'sem rede' } });
    act(() => result.current.onRefresh());
    await waitFor(() => expect(mockShowError).toHaveBeenCalled());
    await waitFor(() => expect(result.current.refreshing).toBe(false));

    expect(result.current.rotas.map((r) => r.id)).toEqual(['r1', 'r2']);
    expect(result.current.loading).toBe(false);
  });

  it('trocar de período limpa a lista anterior (e uma falha não a traz de volta)', async () => {
    montar([rota('r1')], []);
    const { result, rerender } = renderHook(
      (p: Props) => useHistoricoData(entrada(p)),
      { initialProps: {} as Props },
    );
    await waitFor(() => expect(result.current.rotas).toHaveLength(1));

    montar([], [], { rotas: { message: 'sem rede' } });
    rerender({ de: '2026-10-01', ate: '2026-10-31' });
    await waitFor(() => expect(mockShowError).toHaveBeenCalled());
    expect(result.current.rotas).toEqual([]);
  });

  it('Carregar mais que falha mantém a lista e avisa', async () => {
    const { rotas, paradas } = cenario(120);
    montar(rotas, paradas);
    const { result } = renderHook(() => useHistoricoData(entrada()));
    await waitFor(() => expect(result.current.rotas).toHaveLength(50));

    montar([], [], { rotas: { message: 'sem rede' } });
    act(() => result.current.carregarMais());
    await waitFor(() => expect(mockShowError).toHaveBeenCalled());
    expect(result.current.rotas).toHaveLength(50);
    expect(result.current.carregandoMais).toBe(false);
  });

  it('Carregar mais em voo durante a troca de período: a página antiga não entra', async () => {
    const { rotas, paradas } = cenario(120);
    montar(rotas, paradas);
    const { result, rerender } = renderHook(
      (p: Props) => useHistoricoData(entrada(p)),
      { initialProps: {} as Props },
    );
    await waitFor(() => expect(result.current.rotas).toHaveLength(50));

    // A próxima consulta de rotas (página 2) fica pendente.
    let soltar: (v: unknown) => void = () => {};
    const pendente = new Promise((resolve) => {
      soltar = resolve;
    });
    const consultaPendente = {
      select: () => consultaPendente,
      eq: () => consultaPendente,
      gte: () => consultaPendente,
      lte: () => consultaPendente,
      order: () => consultaPendente,
      range: () => consultaPendente,
      returns: () => consultaPendente,
      then: (resolve: (r: unknown) => unknown) => pendente.then(resolve),
    };
    const normal = mockFrom.getMockImplementation();
    mockFrom.mockImplementationOnce(() => consultaPendente);
    mockFrom.mockImplementation(normal as never);

    act(() => result.current.carregarMais());
    // Troca de período: nova lista (outubro, vazia nos dados do cenário).
    rerender({ de: '2026-10-01', ate: '2026-10-31' });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rotas).toEqual([]);

    await act(async () => {
      soltar({ data: [rota('antiga')], count: 120, error: null });
      await Promise.resolve();
    });
    expect(result.current.rotas).toEqual([]);
    expect(result.current.carregandoMais).toBe(false);
  });

  it('temMais não fica preso quando a página traz rota repetida', async () => {
    const { rotas, paradas } = cenario(100);
    montar(rotas, paradas);
    const { result } = renderHook(() => useHistoricoData(entrada()));
    await waitFor(() => expect(result.current.rotas).toHaveLength(50));

    // A 2ª página repete uma rota da 1ª (entrou rota nova no meio): 49 novas
    // + 1 repetida, página cheia (50). A 3ª vem vazia e encerra.
    // (A 1ª página fica antes, porque o fake aplica o range ao array.)
    const pagina2 = [
      ...rotas.slice(0, 50),
      ...rotas.slice(0, 1),
      ...rotas.slice(50, 99),
    ];
    mockFrom.mockImplementation((t: string) =>
      t === 'rotas'
        ? consulta(pagina2, undefined, true)
        : consulta(paradas, undefined, false),
    );
    act(() => result.current.carregarMais());
    await waitFor(() => expect(result.current.rotas).toHaveLength(99));
    expect(result.current.temMais).toBe(true);

    mockFrom.mockImplementation((t: string) =>
      t === 'rotas'
        ? consulta([], undefined, true)
        : consulta(paradas, undefined, false),
    );
    act(() => result.current.carregarMais());
    await waitFor(() => expect(result.current.temMais).toBe(false));
  });

  it('entrega o AlertDialog do useAlert', () => {
    montar([], []);
    const { result } = renderHook(() => useHistoricoData(entrada()));
    expect(result.current).toHaveProperty('AlertDialog');
  });
});
