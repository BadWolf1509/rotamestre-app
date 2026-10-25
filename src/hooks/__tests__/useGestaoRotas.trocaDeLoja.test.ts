/**
 * Troca de loja na Gestão de Rotas (M2 da revisão final).
 *
 * O seletor de loja troca `unidadeAtiva` sem remontar a tela. Antes, a lista,
 * o total e as contagens da loja anterior ficavam na tela até a carga nova
 * chegar, sem carregamento; e se ela falhasse, o aviso "dados de HH:MM"
 * aparecia sobre os dados da OUTRA loja.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import {
  criarPostgrestFalso,
  type LinhaFalsa,
} from '@/__tests__/helpers/postgrestFalso';

import { useGestaoRotas } from '../useGestaoRotas';

let mockCliente: ReturnType<typeof criarPostgrestFalso>['cliente'];
let mockLoja = 'loja-a';

jest.mock('@/lib/supabase', () => ({
  supabase: { from: (t: string) => mockCliente.from(t) },
  isSupabaseConfigured: true,
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../useUnidadeAtiva', () => ({
  useUnidadeAtiva: () => ({ unidadeAtiva: mockLoja }),
}));
jest.mock('../useUser', () => ({
  useUser: () => ({ userData: { id: 'g1', nome: 'Gestor' } }),
}));
jest.mock('../useRealtimeRoutes', () => ({ useRealtimeRoutes: jest.fn() }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

function rota(id: string, loja: string): LinhaFalsa {
  return {
    id,
    unidade_id: loja,
    data: '2026-10-22',
    status: 'pendente',
    distancia_total: 1,
    iniciada_em: null,
    concluida_em: null,
    motorista_id: null,
    usuarios: null,
  };
}

const opcoes = {
  statusColorMap: {} as never,
  defaultStatusColor: 'x',
  showToast: jest.fn(),
  withToast: jest.fn() as never,
};

function montar() {
  const falso = criarPostgrestFalso({
    rotas: [rota('a1', 'loja-a'), rota('a2', 'loja-a'), rota('b1', 'loja-b')],
    paradas: [],
  });
  mockCliente = falso.cliente;
  return falso;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLoja = 'loja-a';
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
});

describe('useGestaoRotas — troca de loja', () => {
  it('não mostra a lista da loja anterior enquanto a nova carrega', async () => {
    montar();
    const { result, rerender } = renderHook(() => useGestaoRotas(opcoes));
    await waitFor(() => expect(result.current.rotas).toHaveLength(2));

    mockLoja = 'loja-b';
    rerender({});

    // Antes de a resposta da loja B chegar.
    expect(result.current.rotas.map((r) => r.id)).not.toContain('a1');
    expect(result.current.total).not.toBe(2);
    expect(result.current.loading).toBe(true);

    await waitFor(() =>
      expect(result.current.rotas.map((r) => r.id)).toEqual(['b1']),
    );
    expect(result.current.total).toBe(1);
    expect(result.current.loading).toBe(false);
  });

  it('falha na carga da loja nova não oferece os dados da anterior como "dados de HH:MM"', async () => {
    const falso = montar();
    const { result, rerender } = renderHook(() => useGestaoRotas(opcoes));
    await waitFor(() => expect(result.current.rotas).toHaveLength(2));

    falso.falhas.rotas = { message: 'falhou', code: '500' };
    mockLoja = 'loja-b';
    rerender({});

    await waitFor(() => expect(result.current.erroCarga).not.toBeNull());
    expect(result.current.rotas).toEqual([]);
    expect(result.current.dadosDe).toBeNull();
  });

  it('a loja nova usa o próprio cache, não fica na lista da anterior', async () => {
    montar();
    const { result, rerender } = renderHook(() => useGestaoRotas(opcoes));
    await waitFor(() => expect(result.current.rotas).toHaveLength(2));

    const cacheB = {
      data: [{ id: 'b-cache', data: '2026-10-21', status: 'pendente' }],
      timestamp: Date.now(),
    };
    (AsyncStorage.getItem as jest.Mock).mockImplementation(
      async (chave: string) =>
        chave.includes('loja-b') ? JSON.stringify(cacheB) : null,
    );
    await act(async () => {
      mockLoja = 'loja-b';
      rerender({});
    });

    expect(result.current.rotas.map((r) => r.id)).not.toContain('a1');
    await waitFor(() =>
      expect(result.current.rotas.map((r) => r.id)).toEqual(['b1']),
    );
  });
});
