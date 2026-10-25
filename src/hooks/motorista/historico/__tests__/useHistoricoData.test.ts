/**
 * Tests for useHistoricoData hook
 *
 * O PostgREST do Supabase corta qualquer resposta em 1.000 linhas (max-rows),
 * sem erro. O hook buscava as paradas de TODAS as rotas num `.in` só: com o
 * motorista real (393 rotas, 2.235 paradas) os cards e o cabeçalho mostravam
 * contagens erradas ou zero. O fake abaixo aplica o mesmo corte.
 *
 * Mocks: useUser, supabase, useAlert (global), logger
 */
import { act, renderHook, waitFor } from '@testing-library/react-native';

const mockFrom = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

const mockUserData = { id: 'user-1', papel: 'motorista' };
jest.mock('@/hooks/useUser', () => ({
  useUser: () => ({ userData: mockUserData }),
}));

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

import { logger } from '@/lib/logger';

import { useHistoricoData } from '../useHistoricoData';

const mockShowError = (global as any).mockUseAlert.showError;

const MAX_ROWS = 1000;
type Linha = Record<string, unknown>;

function consulta(todas: Linha[], erro: unknown) {
  const filtros: ((l: Linha) => boolean)[] = [];
  let faixa: [number, number] | null = null;
  const api = {
    select: () => api,
    eq: (c: string, v: unknown) => {
      filtros.push((l) => l[c] === v);
      return api;
    },
    in: (c: string, vs: unknown[]) => {
      filtros.push((l) => vs.includes(l[c]));
      return api;
    },
    order: () => api,
    range: (a: number, b: number) => {
      faixa = [a, b];
      return api;
    },
    returns: () => api,
    then: (resolve: (r: unknown) => unknown) => {
      if (erro) return Promise.resolve({ data: null, error: erro }).then(resolve);
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

function montar(
  rotas: Linha[],
  paradas: Linha[],
  erros: { rotas?: unknown; paradas?: unknown } = {},
) {
  mockFrom.mockImplementation((t: string) =>
    t === 'rotas'
      ? consulta(rotas, erros.rotas)
      : consulta(paradas, erros.paradas),
  );
}

function rota(id: string, over: Linha = {}): Linha {
  return {
    id,
    motorista_id: 'user-1',
    data: '2026-01-15',
    status: 'concluida',
    distancia_total: 10,
    iniciada_em: null,
    concluida_em: null,
    unidades: { nome: 'Unidade A' },
    ...over,
  };
}

/** n rotas, cada uma com partida + 3 concluídas + 1 pendente + chegada. */
function cenario(n: number) {
  const rotas: Linha[] = [];
  const paradas: Linha[] = [];
  for (let i = 0; i < n; i++) {
    const id = `r${String(i).padStart(4, '0')}`;
    rotas.push(rota(id));
    paradas.push({ id: `${id}-0`, rota_id: id, status: 'concluida', is_checkpoint: false });
    paradas.push({ id: `${id}-1`, rota_id: id, status: 'concluida', is_checkpoint: null });
    paradas.push({ id: `${id}-2`, rota_id: id, status: 'concluida', is_checkpoint: true });
    paradas.push({ id: `${id}-3`, rota_id: id, status: 'concluida', is_checkpoint: null });
    paradas.push({ id: `${id}-4`, rota_id: id, status: 'pendente', is_checkpoint: true });
    paradas.push({ id: `${id}-5`, rota_id: id, status: 'pendente', is_checkpoint: false });
  }
  return { rotas, paradas };
}

describe('useHistoricoData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserData.id = 'user-1';
  });

  it('começa carregando', () => {
    montar([], []);
    const { result } = renderHook(() => useHistoricoData());
    expect(result.current.loading).toBe(true);
  });

  it('motorista com 393 rotas e 2.358 paradas: toda rota com a contagem certa', async () => {
    const { rotas, paradas } = cenario(393);
    montar(rotas, paradas);

    const { result } = renderHook(() => useHistoricoData());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.rotas).toHaveLength(393);
    // Partida e chegada (is_checkpoint = false) não contam.
    expect(result.current.rotas.every((r) => r.paradas_count === 4)).toBe(true);
    expect(
      result.current.rotas.every((r) => r.paradas_concluidas === 3),
    ).toBe(true);
    expect(mockShowError).not.toHaveBeenCalled();
  });

  it('pagina as rotas além de 1.000', async () => {
    const { rotas } = cenario(1050);
    montar(rotas, []);

    const { result } = renderHook(() => useHistoricoData());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.rotas).toHaveLength(1050);
    // A ordem do banco é mantida entre as páginas.
    expect(result.current.rotas[1049].id).toBe('r1049');
  });

  it('só as rotas do motorista logado', async () => {
    montar([rota('minha'), rota('alheia', { motorista_id: 'outro' })], []);
    const { result } = renderHook(() => useHistoricoData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rotas.map((r) => r.id)).toEqual(['minha']);
  });

  it('sem rotas: lista vazia, sem buscar paradas', async () => {
    montar([], []);
    const { result } = renderHook(() => useHistoricoData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rotas).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalledWith('paradas');
  });

  it('erro nas rotas mostra o alerta', async () => {
    montar([], [], { rotas: { message: 'falhou' } });
    const { result } = renderHook(() => useHistoricoData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(logger.error).toHaveBeenCalled();
    expect(mockShowError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Não foi possível carregar o histórico',
      }),
    );
  });

  // Antes o erro das paradas era só logado e os cards saíam com "0 paradas":
  // contador zerado em silêncio é mentira. Agora a tela avisa.
  it('erro nas paradas também mostra o alerta, sem contadores zerados', async () => {
    montar([rota('r1')], [], { paradas: { message: 'falhou' } });
    const { result } = renderHook(() => useHistoricoData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockShowError).toHaveBeenCalled();
    expect(result.current.rotas).toEqual([]);
  });

  it('sem usuário: vazio, sem consulta', async () => {
    mockUserData.id = '';
    montar([], []);
    const { result } = renderHook(() => useHistoricoData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rotas).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('refresh recarrega e desliga o refreshing', async () => {
    montar([rota('r1')], []);
    const { result } = renderHook(() => useHistoricoData());
    await waitFor(() => expect(result.current.loading).toBe(false));

    montar([rota('r1'), rota('r2')], []);
    act(() => result.current.onRefresh());
    await waitFor(() => expect(result.current.rotas).toHaveLength(2));
    expect(result.current.refreshing).toBe(false);
  });

  it('entrega o AlertDialog do useAlert', () => {
    montar([], []);
    const { result } = renderHook(() => useHistoricoData());
    expect(result.current).toHaveProperty('AlertDialog');
  });
});
