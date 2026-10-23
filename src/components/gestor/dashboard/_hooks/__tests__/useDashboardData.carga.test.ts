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

function mockValor(linha: Linha, coluna: string): unknown {
  return coluna
    .split('.')
    .reduce<unknown>((o, k) => (o as Linha | null)?.[k], linha);
}

function mockQuery(tabela: string) {
  const filtros: ((l: Linha) => boolean)[] = [];
  let contar = false;
  let statusFiltrado: string | null = null;
  const api = {
    select: (_cols?: string, opts?: { count?: string; head?: boolean }) => {
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

jest.mock('@/lib/supabase', () => ({
  supabase: { from: (t: string) => mockQuery(t) },
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
  mockFalharRotas = false;
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
  mockTabelas.incidentes = [
    // da rota da loja A: conta
    {
      id: 'i1',
      status: 'aberto',
      motorista_id: 'm1',
      rota_id: 'hoje-1',
      rotas: { unidade_id: 'loja-a' },
    },
    // da rota da loja B, mesma motorista: NÃO conta na loja A
    {
      id: 'i2',
      status: 'aberto',
      motorista_id: 'm1',
      rota_id: 'outra-loja',
      rotas: { unidade_id: 'loja-b' },
    },
    // sem rota, de motorista da loja A: conta pelo vínculo
    {
      id: 'i3',
      status: 'aberto',
      motorista_id: 'm2',
      rota_id: null,
      rotas: null,
    },
    // resolvido: não conta
    {
      id: 'i4',
      status: 'resolvido',
      motorista_id: 'm2',
      rota_id: 'hoje-1',
      rotas: { unidade_id: 'loja-a' },
    },
  ];
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
});

describe('useDashboardData — incidentes abertos', () => {
  it('conta pela loja da rota (e, sem rota, pelo vínculo do motorista)', async () => {
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

  it('erro ao ler os vínculos dos motoristas: indisponível, não só os da rota', async () => {
    mockTabelasComErro.add('usuario_unidades');
    const { result } = renderHook(() => useDashboardData());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.stats.incidentesAbertos).toBeNull();
  });
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
