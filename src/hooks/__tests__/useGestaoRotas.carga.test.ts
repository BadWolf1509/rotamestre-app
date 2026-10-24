/**
 * Carga da Gestão de Rotas: contadores de paradas e erro de carga.
 *
 * 1. Contadores: a busca de paradas pegava TODAS as paradas da unidade, sem
 *    filtrar pelas rotas carregadas. O PostgREST corta a resposta em 1.000
 *    linhas (max-rows do Supabase), e as lojas com 2.859 e 2.061 paradas
 *    viam rotas com "0 paradas". O fake abaixo aplica o mesmo corte.
 * 2. Erro: falha de paradas era ignorada (contadores zerados em silêncio), e
 *    o erro de carga ia para um `Alert.alert` — no-op no react-native-web.
 *    Agora vira estado (`erroCarga`) e, servindo cache, o horário dele.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import {
  criarPostgrestFalso,
  type LinhaFalsa,
} from '@/__tests__/helpers/postgrestFalso';

import { useGestaoRotas } from '../useGestaoRotas';

// PostgREST falso atrás do cliente real: aplica os filtros da URL e corta
// em 1.000 linhas, como o max-rows do Supabase.
let mockCliente: ReturnType<typeof criarPostgrestFalso>['cliente'];

jest.mock('@/lib/supabase', () => ({
  supabase: { from: (t: string) => mockCliente.from(t) },
  isSupabaseConfigured: true,
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../useUnidadeAtiva', () => ({
  useUnidadeAtiva: () => ({ unidadeAtiva: 'unidade-1' }),
}));
jest.mock('../useUser', () => ({
  useUser: () => ({ userData: { id: 'g1', nome: 'Gestor' } }),
}));
jest.mock('../useRealtimeRoutes', () => ({ useRealtimeRoutes: jest.fn() }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

const ROTA_1: LinhaFalsa = {
  id: 'rota-1',
  unidade_id: 'unidade-1',
  data: '2026-10-22',
  status: 'pendente',
  distancia_total: 1,
  iniciada_em: null,
  concluida_em: null,
  motorista_id: 'm1',
  usuarios: { id: 'm1', nome: 'Ana' },
};

function paradasDaUnidade(): LinhaFalsa[] {
  // 1.500 paradas de rotas antigas que NÃO estão na lista (vêm primeiro),
  // depois as 5 da rota-1 (2 concluídas).
  const antigas = Array.from({ length: 1500 }, (_, i) => ({
    id: `a${i}`,
    rota_id: `antiga-${i % 50}`,
    status: 'concluida',
    is_checkpoint: true,
  }));
  const daRota1 = Array.from({ length: 5 }, (_, i) => ({
    id: `p${i}`,
    rota_id: 'rota-1',
    status: i < 2 ? 'concluida' : 'pendente',
    is_checkpoint: true,
  }));
  return [...antigas, ...daRota1];
}

const opcoes = {
  statusColorMap: {} as never,
  defaultStatusColor: 'x',
  showToast: jest.fn(),
  withToast: jest.fn() as never,
};

const ERRO = { message: 'falhou', code: '500' };

function configurar({
  erroRotas = false,
  erroParadas = false,
  cache = null as null | { data: unknown[]; timestamp: number },
} = {}) {
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
    cache ? JSON.stringify(cache) : null,
  );
  const falso = criarPostgrestFalso({
    rotas: [ROTA_1],
    paradas: paradasDaUnidade(),
  });
  if (erroRotas) falso.falhas.rotas = ERRO;
  if (erroParadas) falso.falhas.paradas = ERRO;
  mockCliente = falso.cliente;
}

beforeEach(() => jest.clearAllMocks());

describe('useGestaoRotas — contadores de paradas', () => {
  it('conta as paradas da rota mesmo com mais de 1.000 paradas na unidade', async () => {
    configurar();
    const { result } = renderHook(() => useGestaoRotas(opcoes));

    await waitFor(() => expect(result.current.rotas).toHaveLength(1));
    expect(result.current.rotas[0]).toMatchObject({
      paradas_count: 5,
      paradas_concluidas: 2,
    });
  });

  it('falha ao buscar paradas não vira "0 paradas": vira erro de carga', async () => {
    configurar({ erroParadas: true });
    const { result } = renderHook(() => useGestaoRotas(opcoes));

    await waitFor(() => expect(result.current.erroCarga).toBeTruthy());
    expect(result.current.rotas).toHaveLength(0);
  });
});

describe('useGestaoRotas — erro de carga', () => {
  it('sem cache: expõe erroCarga, e "tentar novamente" recarrega e limpa o erro', async () => {
    configurar({ erroRotas: true });
    const { result } = renderHook(() => useGestaoRotas(opcoes));

    await waitFor(() => expect(result.current.erroCarga).toBeTruthy());
    expect(result.current.dadosDe).toBeNull();

    configurar();
    await act(async () => {
      await result.current.loadRotas();
    });

    expect(result.current.erroCarga).toBeNull();
    expect(result.current.rotas).toHaveLength(1);
  });

  it('com cache: mantém as rotas do cache e diz de quando são', async () => {
    const horarioDoCache = new Date(2026, 9, 22, 9, 41).getTime();
    configurar({
      erroRotas: true,
      cache: {
        data: [
          {
            id: 'rota-cache',
            data: '2026-10-21',
            status: 'concluida',
            paradas_count: 3,
            paradas_concluidas: 3,
          },
        ],
        timestamp: horarioDoCache,
      },
    });
    const { result } = renderHook(() => useGestaoRotas(opcoes));

    await waitFor(() => expect(result.current.erroCarga).toBeTruthy());
    expect(result.current.rotas.map((r) => r.id)).toEqual(['rota-cache']);
    expect(result.current.dadosDe).toBe(horarioDoCache);
  });
});
