import { act, renderHook, waitFor } from '@testing-library/react-native';

import { supabase } from '@/lib/supabase';

import { useLoadActiveRoute } from '../useLoadActiveRoute';

jest.mock('@/lib/supabase');
jest.mock('@/lib/logger');

// ---------------------------------------------------------------------------
// Supabase falso: cada `from(tabela)` consome a próxima resposta da fila
// daquela tabela. A resposta pode ser um valor, uma Promise (para controlar a
// ordem de chegada) ou um Error (rejeição, como uma queda de rede).
// ---------------------------------------------------------------------------

type Resposta = { data: unknown; error: unknown };
type Item = Resposta | Promise<Resposta> | Error;

let filas: Record<string, Item[]> = {};

function enfileirar(tabela: string, ...itens: Item[]) {
  filas[tabela] = [...(filas[tabela] ?? []), ...itens];
}

function resolver(item: Item | undefined): Promise<Resposta> {
  if (item === undefined) {
    return Promise.reject(new Error('fila vazia no teste'));
  }
  if (item instanceof Error) return Promise.reject(item);
  return Promise.resolve(item);
}

function cadeia(tabela: string) {
  const item = filas[tabela]?.shift();
  const promessa = resolver(item);
  const c: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'in', 'order', 'limit', 'gte']) {
    c[m] = () => c;
  }
  c.maybeSingle = () => promessa;
  c.then = (ok: (v: Resposta) => unknown, falha?: (e: unknown) => unknown) =>
    promessa.then(ok, falha);
  return c;
}

function deferido() {
  let resolve!: (v: Resposta) => void;
  const promise = new Promise<Resposta>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const rota = (id: string, status = 'em_andamento') => ({
  id,
  unidade_id: 'u1',
  status,
  distancia_total: null,
  tempo_total: null,
  polyline: null,
  iniciada_em: null,
  concluida_em: null,
  created_at: '2026-10-22T10:00:00Z',
  data: '2026-10-22',
  unidades: { nome: 'Loja' },
});

const parada = (id: string, updated_at = 't1', status = 'pendente') => ({
  id,
  endereco: `Rua ${id}`,
  ordem: 1,
  status,
  tipo: 'entrega',
  latitude: 0,
  longitude: 0,
  updated_at,
});

beforeEach(() => {
  filas = {};
  (supabase.from as jest.Mock) = jest.fn((tabela: string) => cadeia(tabela));
});

function montar() {
  return renderHook(() =>
    useLoadActiveRoute({ userLoading: false, motoristaId: 'm1' }),
  );
}

async function montarCarregado(
  rotaInicial = rota('r1'),
  paradasIniciais = [parada('p1'), parada('p2')],
) {
  enfileirar('rotas', { data: [rotaInicial], error: null });
  enfileirar('paradas', { data: paradasIniciais, error: null });
  const hook = montar();
  await act(async () => {
    await hook.result.current.loadActiveRoute();
  });
  return hook;
}

describe('useLoadActiveRoute', () => {
  it('carga inicial: liga loading, aplica rota e paradas e marca atualizadoEm', async () => {
    enfileirar('rotas', { data: [rota('r1')], error: null });
    enfileirar('paradas', { data: [parada('p1')], error: null });
    const { result } = montar();

    expect(result.current.loading).toBe(true);
    await act(async () => {
      await result.current.loadActiveRoute();
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.route?.id).toBe('r1');
    expect(result.current.paradas.map((p) => p.id)).toEqual(['p1']);
    expect(result.current.error).toBeNull();
    expect(result.current.atualizadoEm).toEqual(expect.any(Number));
  });

  it('erro na consulta de rotas NÃO apaga a rota: preserva e expõe o erro', async () => {
    const { result } = await montarCarregado();
    const atualizadoAntes = result.current.atualizadoEm;

    enfileirar('rotas', { data: null, error: { message: 'offline' } });
    await act(async () => {
      await result.current.loadActiveRoute();
    });

    expect(result.current.route?.id).toBe('r1');
    expect(result.current.paradas).toHaveLength(2);
    expect(result.current.error).not.toBeNull();
    expect(result.current.atualizadoEm).toBe(atualizadoAntes);
  });

  it('queda de rede (rejeição) NÃO apaga a rota', async () => {
    const { result } = await montarCarregado();

    enfileirar('rotas', new Error('Network request failed'));
    await act(async () => {
      await result.current.loadActiveRoute();
    });

    expect(result.current.route?.id).toBe('r1');
    expect(result.current.paradas).toHaveLength(2);
    expect(result.current.error).not.toBeNull();
  });

  it('erro na consulta de paradas não vira lista vazia (rota "pronta para finalizar")', async () => {
    const { result } = await montarCarregado();

    enfileirar('rotas', { data: [rota('r1')], error: null });
    enfileirar('paradas', { data: null, error: { message: 'timeout' } });
    await act(async () => {
      await result.current.loadActiveRoute();
    });

    expect(result.current.paradas).toHaveLength(2);
    expect(result.current.error).not.toBeNull();
  });

  it('erro nas paradas na carga inicial não publica a rota sem paradas', async () => {
    enfileirar('rotas', { data: [rota('r1')], error: null });
    enfileirar('paradas', { data: null, error: { message: 'timeout' } });
    const { result } = montar();
    await act(async () => {
      await result.current.loadActiveRoute();
    });

    expect(result.current.route).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).not.toBeNull();
  });

  it('zero linhas (resposta, não erro) limpa a rota', async () => {
    const { result } = await montarCarregado();

    enfileirar('rotas', { data: [], error: null });
    enfileirar('rotas', { data: null, error: null });
    await act(async () => {
      await result.current.loadActiveRoute();
    });

    expect(result.current.route).toBeNull();
    expect(result.current.paradas).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('aplica rota e paradas JUNTAS: sem janela de rota nova com paradas velhas', async () => {
    const { result } = await montarCarregado();

    const paradasNovas = deferido();
    enfileirar('rotas', { data: [rota('r2')], error: null });
    enfileirar('paradas', paradasNovas.promise);

    let recarga!: Promise<void>;
    act(() => {
      recarga = result.current.loadActiveRoute();
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.route?.id).toBe('r1');

    await act(async () => {
      paradasNovas.resolve({ data: [parada('p9')], error: null });
      await recarga;
    });
    expect(result.current.route?.id).toBe('r2');
    expect(result.current.paradas.map((p) => p.id)).toEqual(['p9']);
  });

  it('resposta fora de ordem não sobrescreve a mais nova', async () => {
    const { result } = await montarCarregado();

    const lenta = deferido();
    enfileirar('rotas', lenta.promise); // chamada A (antiga)
    enfileirar('rotas', { data: [rota('r3')], error: null }); // chamada B (nova)
    enfileirar('paradas', { data: [parada('pB')], error: null });

    let a!: Promise<void>;
    let b!: Promise<void>;
    await act(async () => {
      a = result.current.loadActiveRoute();
      b = result.current.loadActiveRoute();
      await b;
    });
    expect(result.current.route?.id).toBe('r3');

    enfileirar('paradas', { data: [parada('pA')], error: null });
    await act(async () => {
      lenta.resolve({ data: [rota('rVelha')], error: null });
      await a;
    });

    expect(result.current.route?.id).toBe('r3');
    expect(result.current.paradas.map((p) => p.id)).toEqual(['pB']);
  });

  it('recarga é silenciosa: loading não volta a ligar depois da carga inicial', async () => {
    const { result } = await montarCarregado();

    const lenta = deferido();
    enfileirar('rotas', lenta.promise);
    let recarga!: Promise<void>;
    act(() => {
      recarga = result.current.loadActiveRoute();
    });
    expect(result.current.loading).toBe(false);

    await act(async () => {
      lenta.resolve({ data: [rota('r1')], error: null });
      enfileirar('paradas', {
        data: [parada('p1'), parada('p2')],
        error: null,
      });
      await recarga;
    });
    expect(result.current.loading).toBe(false);
  });

  it('preserva a identidade das paradas que não mudaram (id + updated_at)', async () => {
    const { result } = await montarCarregado();
    const antes = result.current.paradas;

    enfileirar('rotas', { data: [rota('r1')], error: null });
    enfileirar('paradas', {
      data: [parada('p1'), parada('p2', 't2', 'concluida')],
      error: null,
    });
    await act(async () => {
      await result.current.loadActiveRoute();
    });

    expect(result.current.paradas[0]).toBe(antes[0]);
    expect(result.current.paradas[1]).not.toBe(antes[1]);
    expect(result.current.paradas[1].status).toBe('concluida');
  });

  it('recarga idêntica mantém o MESMO array (não dispara efeitos)', async () => {
    const { result } = await montarCarregado();
    const antes = result.current.paradas;

    enfileirar('rotas', { data: [rota('r1')], error: null });
    enfileirar('paradas', { data: [parada('p1'), parada('p2')], error: null });
    await act(async () => {
      await result.current.loadActiveRoute();
    });

    expect(result.current.paradas).toBe(antes);
  });

  it('sucesso depois de erro limpa o erro', async () => {
    const { result } = await montarCarregado();
    enfileirar('rotas', new Error('offline'));
    await act(async () => {
      await result.current.loadActiveRoute();
    });
    expect(result.current.error).not.toBeNull();

    enfileirar('rotas', { data: [rota('r1')], error: null });
    enfileirar('paradas', { data: [parada('p1'), parada('p2')], error: null });
    await act(async () => {
      await result.current.loadActiveRoute();
    });
    await waitFor(() => expect(result.current.error).toBeNull());
  });
});
