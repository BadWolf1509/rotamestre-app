import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { buildRouteData } from '@/context/route-status/calculations';
import type { ParadaData, RotaQueryRow } from '@/context/route-status/types';
import {
  gravarRotaGuardada,
  lerRotaGuardada,
} from '@/lib/motorista/rotaGuardada';
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

/** Consulta que nunca responde (o banco não deveria nem ser chamado). */
function cadeiaPendurada() {
  const c: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'in', 'order', 'limit', 'gte']) {
    c[m] = () => c;
  }
  const nunca = new Promise<Resposta>(() => {});
  c.maybeSingle = () => nunca;
  c.then = (ok: (v: Resposta) => unknown) => nunca.then(ok);
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

// ---------------------------------------------------------------------------
// Rota guardada no aparelho (reabrir do zero sem rede, 1.14.5)
// ---------------------------------------------------------------------------

describe('useLoadActiveRoute: rota guardada para reabrir sem rede', () => {
  const memoria = new Map<string, string>();

  beforeEach(() => {
    memoria.clear();
    (AsyncStorage.getItem as jest.Mock).mockImplementation(
      async (k: string) => memoria.get(k) ?? null,
    );
    (AsyncStorage.setItem as jest.Mock).mockImplementation(
      async (k: string, v: string) => {
        memoria.set(k, v);
      },
    );
  });

  afterAll(() => {
    (AsyncStorage.getItem as jest.Mock).mockImplementation(() =>
      Promise.resolve(null),
    );
    (AsyncStorage.setItem as jest.Mock).mockImplementation(() =>
      Promise.resolve(null),
    );
  });

  function montarPara(motoristaId: string) {
    return renderHook(() =>
      useLoadActiveRoute({ userLoading: false, motoristaId }),
    );
  }

  async function carregar(hook: ReturnType<typeof montarPara>) {
    await act(async () => {
      await hook.result.current.loadActiveRoute();
    });
  }

  /** Grava como se uma sessão anterior (outro processo) tivesse carregado. */
  async function guardarDeSessaoAnterior(
    motoristaId: string,
    guardadoEm: number,
    rotaGuardada = rota('r1'),
    paradasGuardadas = [parada('p1'), parada('p2')],
  ) {
    await gravarRotaGuardada(motoristaId, {
      route: buildRouteData(rotaGuardada as RotaQueryRow),
      paradas: paradasGuardadas as ParadaData[],
      pendingRoutesCount: 1,
      guardadoEm,
    });
  }

  it('reaberto do zero com a busca falhando: mostra a rota guardada com a hora dela', async () => {
    await guardarDeSessaoAnterior('m1', 1_761_276_480_000);
    enfileirar('rotas', new Error('Network request failed'));

    const hook = montarPara('m1');
    await carregar(hook);

    expect(hook.result.current.route?.id).toBe('r1');
    expect(hook.result.current.paradas.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(hook.result.current.pendingRoutesCount).toBe(1);
    expect(hook.result.current.error).not.toBeNull();
    expect(hook.result.current.atualizadoEm).toBe(1_761_276_480_000);
    expect(hook.result.current.loading).toBe(false);
  });

  it('erro de consulta (não rejeição) também usa o guardado', async () => {
    await guardarDeSessaoAnterior('m1', 123);
    enfileirar('rotas', { data: null, error: { message: 'Failed to fetch' } });

    const hook = montarPara('m1');
    await carregar(hook);

    expect(hook.result.current.route?.id).toBe('r1');
    expect(hook.result.current.atualizadoEm).toBe(123);
  });

  it('sem retrato guardado: segue sem rota e sem hora (mensagem atual)', async () => {
    enfileirar('rotas', new Error('Network request failed'));

    const hook = montarPara('m1');
    await carregar(hook);

    expect(hook.result.current.route).toBeNull();
    expect(hook.result.current.error).not.toBeNull();
    expect(hook.result.current.atualizadoEm).toBeNull();
  });

  it('retrato de outra conta é ignorado', async () => {
    await guardarDeSessaoAnterior('outra-conta', 123);
    enfileirar('rotas', new Error('Network request failed'));

    const hook = montarPara('m1');
    await carregar(hook);

    expect(hook.result.current.route).toBeNull();
    expect(hook.result.current.paradas).toEqual([]);
    expect(hook.result.current.atualizadoEm).toBeNull();
  });

  it('busca fresca bem-sucedida grava o retrato da conta', async () => {
    enfileirar('rotas', { data: [rota('r1')], error: null });
    enfileirar('paradas', { data: [parada('p1')], error: null });

    const hook = montarPara('m1');
    await carregar(hook);

    const lido = await lerRotaGuardada('m1');
    expect(lido?.route?.id).toBe('r1');
    expect(lido?.paradas.map((p) => p.id)).toEqual(['p1']);
    expect(lido?.guardadoEm).toBe(hook.result.current.atualizadoEm);
  });

  it('com rede, o fresco vence o guardado e o substitui', async () => {
    await guardarDeSessaoAnterior('m1', 123, rota('r-velha'), [
      parada('p-velha'),
    ]);
    enfileirar('rotas', { data: [rota('r-nova')], error: null });
    enfileirar('paradas', { data: [parada('p-nova')], error: null });

    const hook = montarPara('m1');
    await carregar(hook);

    expect(hook.result.current.route?.id).toBe('r-nova');
    expect(hook.result.current.paradas.map((p) => p.id)).toEqual(['p-nova']);
    const lido = await lerRotaGuardada('m1');
    expect(lido?.route?.id).toBe('r-nova');
    expect(lido?.paradas.map((p) => p.id)).toEqual(['p-nova']);
  });

  it('rota finalizada no servidor ("sem rota" fresco) substitui o guardado', async () => {
    await guardarDeSessaoAnterior('m1', 123);
    enfileirar('rotas', { data: [], error: null });
    enfileirar('rotas', { data: null, error: null });
    const online = montarPara('m1');
    await carregar(online);
    expect(online.result.current.route).toBeNull();
    online.unmount();

    // Reabre do zero sem rede: não ressuscita a rota finalizada.
    enfileirar('rotas', new Error('Network request failed'));
    const offline = montarPara('m1');
    await carregar(offline);

    expect(offline.result.current.route).toBeNull();
    expect(offline.result.current.paradas).toEqual([]);
  });

  it('falha depois de uma carga fresca nesta sessão mantém o que está na memória', async () => {
    enfileirar('rotas', { data: [rota('r1')], error: null });
    enfileirar('paradas', { data: [parada('p1')], error: null });
    const hook = montarPara('m1');
    await carregar(hook);
    const atualizadoEm = hook.result.current.atualizadoEm;

    // O disco muda por fora; a memória desta sessão é mais confiável.
    await guardarDeSessaoAnterior('m1', 1, rota('r-disco'));
    enfileirar('rotas', new Error('Network request failed'));
    await carregar(hook);

    expect(hook.result.current.route?.id).toBe('r1');
    expect(hook.result.current.atualizadoEm).toBe(atualizadoEm);
  });

  it('troca de conta sem passar por "sem usuário": a rota de A não fica para B', async () => {
    enfileirar('rotas', { data: [rota('r-de-A')], error: null });
    enfileirar('paradas', { data: [parada('p-de-A')], error: null });
    const hook = renderHook(
      ({ id }: { id: string }) =>
        useLoadActiveRoute({ userLoading: false, motoristaId: id }),
      { initialProps: { id: 'conta-a' } },
    );
    await act(async () => {
      await hook.result.current.loadActiveRoute();
    });
    expect(hook.result.current.route?.id).toBe('r-de-A');

    hook.rerender({ id: 'conta-b' });
    enfileirar('rotas', new Error('Network request failed'));
    await act(async () => {
      await hook.result.current.loadActiveRoute();
    });

    expect(hook.result.current.route).toBeNull();
    expect(hook.result.current.paradas).toEqual([]);
    expect(hook.result.current.atualizadoEm).toBeNull();
  });

  it('sair da conta zera também a hora dos dados', async () => {
    enfileirar('rotas', { data: [rota('r1')], error: null });
    enfileirar('paradas', { data: [parada('p1')], error: null });
    const hook = renderHook(
      ({ id }: { id: string | undefined }) =>
        useLoadActiveRoute({ userLoading: false, motoristaId: id }),
      { initialProps: { id: 'm1' as string | undefined } },
    );
    await act(async () => {
      await hook.result.current.loadActiveRoute();
    });
    expect(hook.result.current.atualizadoEm).not.toBeNull();

    hook.rerender({ id: undefined });
    await act(async () => {
      await hook.result.current.loadActiveRoute();
    });

    expect(hook.result.current.route).toBeNull();
    expect(hook.result.current.atualizadoEm).toBeNull();
  });

  it('o guardado lido tarde não sobrescreve uma busca mais nova', async () => {
    await guardarDeSessaoAnterior('m1', 123, rota('r-velha'));
    const hook = montarPara('m1');

    // Chamada A falha; a leitura do disco fica pendurada até B aplicar.
    let soltarLeitura!: () => void;
    (AsyncStorage.getItem as jest.Mock).mockImplementationOnce(
      (k: string) =>
        new Promise((r) => {
          soltarLeitura = () => r(memoria.get(k) ?? null);
        }),
    );
    enfileirar('rotas', new Error('Network request failed')); // A
    enfileirar('rotas', { data: [rota('r-nova')], error: null }); // B
    enfileirar('paradas', { data: [parada('p-nova')], error: null });

    let a!: Promise<void>;
    await act(async () => {
      a = hook.result.current.loadActiveRoute();
      // Deixa A chegar à leitura do disco antes de B começar. Espera pela
      // leitura em si, não por um número fixo de microtarefas: com contagem
      // fixa, um await a mais no caminho (o NetInfo) fazia A nem chegar ao
      // disco e o teste passava sem testar nada.
      for (let i = 0; i < 50 && !soltarLeitura; i++) await Promise.resolve();
      expect(soltarLeitura).toBeDefined();
      await hook.result.current.loadActiveRoute();
    });
    expect(hook.result.current.route?.id).toBe('r-nova');

    await act(async () => {
      soltarLeitura();
      await a;
    });
    expect(hook.result.current.route?.id).toBe('r-nova');
    expect(hook.result.current.error).toBeNull();
  });
  // Reaberto do zero em modo avião (1.14.5, Tarefa 3): a busca ficava
  // pendurada até o timeout de 15 s do cliente (e o getSession do supabase-js,
  // preso no refresh, antes dela). Com o NetInfo afirmando "sem rede", o
  // retrato aparece na hora, pelo mesmo atalho do portão de autenticação.
  describe('NetInfo sem rede', () => {
    const fetchNetInfo = NetInfo.fetch as jest.Mock;

    afterEach(() => {
      fetchNetInfo.mockReset();
      fetchNetInfo.mockResolvedValue({ isConnected: true, type: 'wifi' });
      jest.useRealTimers();
    });

    it('desconectado: rota guardada na hora, sem consultar o banco', async () => {
      await guardarDeSessaoAnterior('m1', 123);
      fetchNetInfo.mockResolvedValue({ isConnected: false, type: 'none' });
      jest.useFakeTimers();
      const consultas = jest.fn(() => cadeiaPendurada());
      (supabase.from as jest.Mock) = consultas;

      const hook = montarPara('m1');
      // Nenhum avanço de relógio.
      await act(async () => {
        await hook.result.current.loadActiveRoute();
      });

      expect(consultas).not.toHaveBeenCalled();
      expect(hook.result.current.route?.id).toBe('r1');
      expect(hook.result.current.atualizadoEm).toBe(123);
      expect(hook.result.current.error).not.toBeNull();
      expect(hook.result.current.loading).toBe(false);
    });

    it('desconectado com a rota desta sessão na memória: mantém a memória', async () => {
      await guardarDeSessaoAnterior('m1', 123, rota('r-velha'));
      enfileirar('rotas', { data: [rota('r-nova')], error: null });
      enfileirar('paradas', { data: [parada('p1')], error: null });
      const hook = montarPara('m1');
      await carregar(hook);
      const atualizadoAntes = hook.result.current.atualizadoEm;

      fetchNetInfo.mockResolvedValue({ isConnected: false, type: 'none' });
      await carregar(hook);

      expect(hook.result.current.route?.id).toBe('r-nova');
      expect(hook.result.current.atualizadoEm).toBe(atualizadoAntes);
      expect(hook.result.current.error).not.toBeNull();
    });

    // Rede fraca: o NetInfo diz "conectado" e não prova nada. Segue a busca
    // (que desiste no timeout do cliente) e o guardado só entra na falha.
    it('conectado + busca pendurada: espera a busca, como antes', async () => {
      await guardarDeSessaoAnterior('m1', 123);
      const pendurada = deferido();
      enfileirar('rotas', pendurada.promise);

      const hook = montarPara('m1');
      let carga!: Promise<void>;
      await act(async () => {
        carga = hook.result.current.loadActiveRoute();
        for (let i = 0; i < 10; i++) await Promise.resolve();
      });

      expect(supabase.from).toHaveBeenCalledWith('rotas');
      expect(hook.result.current.loading).toBe(true);
      expect(hook.result.current.route).toBeNull();

      await act(async () => {
        pendurada.resolve({ data: null, error: { message: 'timeout' } });
        await carga;
      });
      expect(hook.result.current.route?.id).toBe('r1');
      expect(hook.result.current.atualizadoEm).toBe(123);
    });
  });
});
