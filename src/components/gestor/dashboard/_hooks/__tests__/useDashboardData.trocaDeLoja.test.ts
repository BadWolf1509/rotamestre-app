/**
 * Troca de loja no painel do gestor (GES-7).
 *
 * O seletor de loja troca `unidadeAtiva` sem remontar a tela. Antes, a lista,
 * os KPIs e as contagens da loja anterior ficavam na tela até a carga nova
 * chegar; e se ela falhasse, o aviso "dados de HH:MM" aparecia sobre os dados
 * da OUTRA loja.
 */
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { getTodayISO } from '@/lib/dateUtils';

import { useDashboardData } from '../useDashboardData';

let mockLoja: string | null = 'loja-a';
// Lojas cuja consulta de `rotas` fica pendente até o teste liberar.
const mockSeguradas: Record<
  string,
  { promessa: Promise<void>; liberar: () => void }
> = {};
const mockLojasComErro = new Set<string>();

jest.mock('@/hooks/useUser', () => ({
  useUser: () => ({ userData: { id: 'g1', nome: 'Gestor' } }),
}));
jest.mock('@/hooks/useRealtimeRoutes', () => ({
  useRealtimeRoutes: jest.fn(),
}));
jest.mock('@/hooks/useUnidadeAtiva', () => ({
  useUnidadeAtiva: () => ({ unidadeAtiva: mockLoja }),
}));
jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

function segurar(loja: string) {
  let liberar: () => void = () => {};
  const promessa = new Promise<void>((resolve) => {
    liberar = resolve;
  });
  mockSeguradas[loja] = { promessa, liberar };
}

function rota(id: string, loja: string) {
  return {
    id,
    data: getTodayISO(),
    status: 'pendente',
    unidade_id: loja,
    distancia_total: 10,
    motorista_id: null,
    usuarios: null,
    paradas: [],
  };
}

const mockRotas = [
  rota('a1', 'loja-a'),
  rota('a2', 'loja-a'),
  rota('b1', 'loja-b'),
];

function mockQuery(tabela: string) {
  let loja: string | null = null;
  let contar = false;
  const api = {
    select: (_cols?: string, opts?: { head?: boolean }) => {
      contar = !!opts?.head;
      return api;
    },
    eq: (coluna: string, valor: unknown) => {
      if (coluna === 'unidade_id') loja = valor as string;
      return api;
    },
    gte: () => api,
    lte: () => api,
    order: () => api,
    then: (resolve: (v: unknown) => void, reject: (e: unknown) => void) => {
      Promise.resolve(loja ? mockSeguradas[loja]?.promessa : null)
        .then(() => {
          if (loja && mockLojasComErro.has(loja) && tabela === 'rotas') {
            return { data: null, count: null, error: { message: 'rede' } };
          }
          const linhas =
            tabela === 'rotas'
              ? mockRotas.filter((r) => r.unidade_id === loja)
              : [];
          return contar
            ? { data: null, count: 0, error: null }
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

beforeEach(() => {
  mockLoja = 'loja-a';
  mockLojasComErro.clear();
  for (const k of Object.keys(mockSeguradas)) delete mockSeguradas[k];
});

describe('useDashboardData — troca de loja', () => {
  it('não mostra a lista da loja anterior enquanto a nova carrega', async () => {
    const { result, rerender } = renderHook(() => useDashboardData());
    await waitFor(() => expect(result.current.rotas).toHaveLength(2));
    expect(result.current.loading).toBe(false);

    segurar('loja-b');
    mockLoja = 'loja-b';
    rerender({});

    expect(result.current.rotas).toEqual([]);
    expect(result.current.stats.total).toBe(0);
    expect(result.current.todayStats.totalHoje).toBe(0);
    expect(result.current.kpis.totalParadas).toBe(0);
    // Tela cheia de carregamento (não a "recarga" discreta): é outra loja.
    expect(result.current.loading).toBe(true);

    await act(async () => {
      mockSeguradas['loja-b'].liberar();
    });
    await waitFor(() =>
      expect(result.current.rotas.map((r) => r.id)).toEqual(['b1']),
    );
    expect(result.current.loading).toBe(false);
  });

  it('carga da loja nova falhando não oferece os dados da anterior como "dados de HH:MM"', async () => {
    const { result, rerender } = renderHook(() => useDashboardData());
    await waitFor(() => expect(result.current.rotas).toHaveLength(2));

    mockLojasComErro.add('loja-b');
    mockLoja = 'loja-b';
    rerender({});

    await waitFor(() => expect(result.current.erroCarga).not.toBeNull());
    expect(result.current.rotas).toEqual([]);
    expect(result.current.dadosDe).toBeNull();
    expect(result.current.stats.total).toBe(0);
  });

  it('resposta da loja anterior chegando depois da troca não entra no estado', async () => {
    segurar('loja-a');
    const { result, rerender } = renderHook(() => useDashboardData());

    mockLoja = 'loja-b';
    rerender({});
    await waitFor(() =>
      expect(result.current.rotas.map((r) => r.id)).toEqual(['b1']),
    );

    await act(async () => {
      mockSeguradas['loja-a'].liberar();
    });
    expect(result.current.rotas.map((r) => r.id)).toEqual(['b1']);
  });

  it('loja A → sem loja → loja B falhando: nada de A sobrevive (KPIs, "dados de HH:MM")', async () => {
    const { result, rerender } = renderHook(() => useDashboardData());
    await waitFor(() => expect(result.current.rotas).toHaveLength(2));
    await waitFor(() => expect(result.current.kpis.rotasMes).toBe(2));

    mockLoja = null;
    rerender({});

    await waitFor(() => expect(result.current.rotas).toEqual([]));
    expect(result.current.kpis.rotasMes).toBe(0);
    expect(result.current.kpis.rotasSemana).toBe(0);
    expect(result.current.erroCarga).toBeNull();
    expect(result.current.dadosDe).toBeNull();

    mockLojasComErro.add('loja-b');
    mockLoja = 'loja-b';
    rerender({});

    await waitFor(() => expect(result.current.erroCarga).not.toBeNull());
    // A última carga boa foi da loja A: não pode virar "dados de HH:MM" da B.
    expect(result.current.dadosDe).toBeNull();
    expect(result.current.kpis.rotasMes).toBe(0);
    expect(result.current.rotas).toEqual([]);
  });
});
