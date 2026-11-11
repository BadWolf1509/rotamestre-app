/**
 * useDashboardData com o período (filtros por período, Task 6): a lista
 * consulta o intervalo escolhido, "Todo o período" tem limite de linhas com
 * aviso, e os KPIs fixos do celular ("Esta Semana", "Rotas no Mês") vão da
 * segunda / do dia 1 até hoje. "Hoje" fixado em 2026-11-10 (terça).
 */
import { renderHook, waitFor } from '@testing-library/react-native';

import { resolverPeriodo } from '@/lib/periodo';

import { LIMITE_ROTAS_SEM_INICIO, useDashboardData } from '../useDashboardData';

jest.mock('@/lib/dateUtils', () => ({
  ...jest.requireActual('@/lib/dateUtils'),
  getTodayISO: () => '2026-11-10',
}));
jest.mock('@/hooks/useUser', () => ({
  useUser: () => ({ userData: { id: 'g1', nome: 'Gestor' } }),
}));
jest.mock('@/hooks/useRealtimeRoutes', () => ({
  useRealtimeRoutes: jest.fn(),
}));
jest.mock('@/hooks/useUnidadeAtiva', () => ({
  useUnidadeAtiva: () => ({ unidadeAtiva: 'loja-a', loading: false }),
}));
jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

interface Consulta {
  tabela: string;
  colunas: string;
  head: boolean;
  chamadas: [string, ...unknown[]][];
}

const mockConsultas: Consulta[] = [];
let mockLinhasDaLista: { id: string }[] = [];

function mockQuery(tabela: string) {
  const consulta: Consulta = { tabela, colunas: '', head: false, chamadas: [] };
  mockConsultas.push(consulta);
  const registrar =
    (metodo: string) =>
    (...args: unknown[]) => {
      consulta.chamadas.push([metodo, ...args]);
      return api;
    };
  const api = {
    select: (cols?: string, opts?: { head?: boolean }) => {
      consulta.colunas = (cols ?? '').replace(/\s+/g, ' ').trim();
      consulta.head = !!opts?.head;
      return api;
    },
    eq: registrar('eq'),
    gte: registrar('gte'),
    lte: registrar('lte'),
    order: registrar('order'),
    limit: registrar('limit'),
    then: (resolve: (v: unknown) => void) => {
      const ehLista = consulta.colunas.includes('paradas(');
      const limite = consulta.chamadas.find(([m]) => m === 'limit')?.[1];
      const linhas = ehLista
        ? mockLinhasDaLista.slice(
            0,
            typeof limite === 'number' ? limite : undefined,
          )
        : [];
      resolve(
        consulta.head
          ? { data: null, count: 0, error: null }
          : { data: linhas, error: null },
      );
    },
  };
  return api;
}

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (t: string) => mockQuery(t),
    rpc: () => Promise.resolve({ data: [], error: null }),
  },
  isSupabaseConfigured: true,
}));

const lista = () =>
  mockConsultas.find(
    (c) => c.tabela === 'rotas' && c.colunas.includes('paradas('),
  );
const chamadasDe = (c: Consulta | undefined, metodo: string) =>
  (c?.chamadas ?? []).filter(([m]) => m === metodo).map(([, ...a]) => a);
// As duas consultas de KPI pedem `iniciada_em`; a 1ª é a da semana.
const kpis = () =>
  mockConsultas.filter(
    (c) => c.tabela === 'rotas' && c.colunas.includes('iniciada_em'),
  );

function linhaDeRota(i: number) {
  return {
    id: `r${i}`,
    data: '2026-11-10',
    status: 'pendente',
    distancia_total: 0,
    motorista_id: null,
    usuarios: null,
    paradas: [],
  };
}

beforeEach(() => {
  mockConsultas.length = 0;
  mockLinhasDaLista = [];
});

describe('useDashboardData — período', () => {
  it('a lista de "Este mês" consulta de 01/11 a 30/11, por data e id decrescentes, sem limite', async () => {
    const { result } = renderHook(() =>
      useDashboardData({ periodo: resolverPeriodo({ tipo: 'este_mes' }) }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(chamadasDe(lista(), 'gte')).toEqual([['data', '2026-11-01']]);
    expect(chamadasDe(lista(), 'lte')).toEqual([['data', '2026-11-30']]);
    expect(chamadasDe(lista(), 'order')).toEqual([
      ['data', { ascending: false }],
      ['id', { ascending: false }],
    ]);
    expect(chamadasDe(lista(), 'limit')).toEqual([]);
    expect(result.current.listaCortada).toBe(false);
  });

  it('"Esta Semana" vai da segunda (09/11) até hoje, e "Rotas no Mês" do dia 1 até hoje', async () => {
    const { result } = renderHook(() =>
      useDashboardData({ periodo: resolverPeriodo({ tipo: 'este_mes' }) }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    const [semana, mes] = kpis();
    expect(chamadasDe(semana, 'gte')).toEqual([['data', '2026-11-09']]);
    expect(chamadasDe(semana, 'lte')).toEqual([['data', '2026-11-10']]);
    expect(chamadasDe(mes, 'gte')).toEqual([['data', '2026-11-01']]);
    expect(chamadasDe(mes, 'lte')).toEqual([['data', '2026-11-10']]);
  });

  it('"Todo o período": sem início, teto de 60 dias à frente e limite de 500 (pede 501 para saber se cortou)', async () => {
    const { result } = renderHook(() =>
      useDashboardData({ periodo: resolverPeriodo({ tipo: 'todo' }) }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(chamadasDe(lista(), 'gte')).toEqual([]);
    expect(chamadasDe(lista(), 'lte')).toEqual([['data', '2027-01-09']]);
    expect(chamadasDe(lista(), 'order')).toEqual([
      ['data', { ascending: false }],
      ['id', { ascending: false }],
    ]);
    expect(chamadasDe(lista(), 'limit')).toEqual([
      [LIMITE_ROTAS_SEM_INICIO + 1],
    ]);
    expect(LIMITE_ROTAS_SEM_INICIO).toBe(500);
  });

  it('"Todo o período" com mais de 500 rotas: mostra 500 e marca a lista como cortada', async () => {
    mockLinhasDaLista = Array.from({ length: 600 }, (_, i) => linhaDeRota(i));
    const { result } = renderHook(() =>
      useDashboardData({ periodo: resolverPeriodo({ tipo: 'todo' }) }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.rotas).toHaveLength(500);
    expect(result.current.listaCortada).toBe(true);
  });

  it('"Todo o período" com exatamente 500 rotas não é cortada', async () => {
    mockLinhasDaLista = Array.from({ length: 500 }, (_, i) => linhaDeRota(i));
    const { result } = renderHook(() =>
      useDashboardData({ periodo: resolverPeriodo({ tipo: 'todo' }) }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.rotas).toHaveLength(500);
    expect(result.current.listaCortada).toBe(false);
  });

  it('período ainda não carregado (null): não consulta e segue carregando', async () => {
    const { result } = renderHook(() => useDashboardData({ periodo: null }));
    await Promise.resolve();

    expect(mockConsultas).toHaveLength(0);
    expect(result.current.loading).toBe(true);
  });

  it('o período de um objeto novo com as mesmas datas não refaz a consulta', async () => {
    const { result, rerender } = renderHook(() =>
      useDashboardData({ periodo: { de: '2026-11-01', ate: '2026-11-30' } }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    const antes = mockConsultas.length;

    rerender({});
    await Promise.resolve();

    expect(mockConsultas).toHaveLength(antes);
  });
});
