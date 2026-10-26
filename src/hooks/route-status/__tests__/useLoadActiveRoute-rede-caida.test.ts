import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook } from '@testing-library/react-native';

import { buildRouteData } from '@/context/route-status/calculations';
import type { ParadaData, RotaQueryRow } from '@/context/route-status/types';
import { gravarRotaGuardada } from '@/lib/motorista/rotaGuardada';
import {
  _resetRedeObservada,
  redeCaidaObservada,
  registrarFalhaDeRede,
} from '@/lib/redeObservada';
import { supabase } from '@/lib/supabase';

import { useLoadActiveRoute } from '../useLoadActiveRoute';

jest.mock('@/lib/supabase');
jest.mock('@/lib/logger');

type Resposta = { data: unknown; error: unknown };

let filas: Record<string, Resposta[]> = {};

function cadeia(tabela: string) {
  const item = filas[tabela]?.shift();
  const promessa = item
    ? Promise.resolve(item)
    : Promise.reject(new Error('fila vazia no teste'));
  const c: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'in', 'order', 'limit', 'gte']) {
    c[m] = () => c;
  }
  c.maybeSingle = () => promessa;
  c.then = (ok: (v: Resposta) => unknown, falha?: (e: unknown) => unknown) =>
    promessa.then(ok, falha);
  return c;
}

const rota = (id: string) => ({
  id,
  unidade_id: 'u1',
  status: 'em_andamento',
  distancia_total: null,
  tempo_total: null,
  polyline: null,
  iniciada_em: null,
  concluida_em: null,
  created_at: '2026-10-22T10:00:00Z',
  data: '2026-10-22',
  unidades: { nome: 'Loja' },
});

const parada = (id: string) => ({
  id,
  endereco: `Rua ${id}`,
  ordem: 1,
  status: 'pendente',
  tipo: 'entrega',
  latitude: 0,
  longitude: 0,
  updated_at: 't1',
});

const memoria = new Map<string, string>();

beforeEach(() => {
  filas = {};
  memoria.clear();
  _resetRedeObservada();
  (supabase.from as jest.Mock) = jest.fn((tabela: string) => cadeia(tabela));
  (AsyncStorage.getItem as jest.Mock).mockImplementation(
    async (k: string) => memoria.get(k) ?? null,
  );
  (AsyncStorage.setItem as jest.Mock).mockImplementation(
    async (k: string, v: string) => {
      memoria.set(k, v);
    },
  );
});

afterEach(() => _resetRedeObservada());

afterAll(() => {
  (AsyncStorage.getItem as jest.Mock).mockImplementation(() =>
    Promise.resolve(null),
  );
  (AsyncStorage.setItem as jest.Mock).mockImplementation(() =>
    Promise.resolve(null),
  );
});

function montar() {
  return renderHook(() =>
    useLoadActiveRoute({ userLoading: false, motoristaId: 'm1' }),
  );
}

async function carregar(hook: ReturnType<typeof montar>) {
  await act(async () => {
    await hook.result.current.loadActiveRoute();
  });
}

/**
 * Queda observada (Wi-Fi sem internet): a carga inicial usa o atalho e mostra
 * o retrato na hora; a recarga com dado em memória vai à rede, para a
 * resposta limpar o sinal — senão "Tentar novamente" ficaria inerte por até
 * 20 s depois de a rede voltar.
 */
describe('useLoadActiveRoute com rede caída observada', () => {
  it('carga inicial: não consulta o banco e aplica o retrato guardado', async () => {
    await gravarRotaGuardada('m1', {
      route: buildRouteData(rota('r-guardada') as RotaQueryRow),
      paradas: [parada('p1')] as ParadaData[],
      pendingRoutesCount: 1,
      guardadoEm: 123,
    });
    registrarFalhaDeRede();

    const hook = montar();
    await carregar(hook);

    expect(supabase.from).not.toHaveBeenCalled();
    expect(hook.result.current.route?.id).toBe('r-guardada');
    expect(hook.result.current.atualizadoEm).toBe(123);
    expect(hook.result.current.error).not.toBeNull();
  });

  it('com dado em memória: a recarga consulta o banco mesmo com o sinal ligado', async () => {
    filas.rotas = [{ data: [rota('r1')], error: null }];
    filas.paradas = [{ data: [parada('p1')], error: null }];
    const hook = montar();
    await carregar(hook);
    expect(hook.result.current.route?.id).toBe('r1');

    registrarFalhaDeRede();
    expect(redeCaidaObservada()).toBe(true);
    (supabase.from as jest.Mock).mockClear();
    filas.rotas = [{ data: [rota('r2')], error: null }];
    filas.paradas = [{ data: [parada('p2')], error: null }];

    await carregar(hook);

    expect(supabase.from).toHaveBeenCalledWith('rotas');
    expect(hook.result.current.route?.id).toBe('r2');
    expect(hook.result.current.error).toBeNull();
  });
});
