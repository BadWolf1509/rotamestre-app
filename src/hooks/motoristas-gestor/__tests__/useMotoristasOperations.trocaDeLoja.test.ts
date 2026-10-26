/**
 * Troca de loja na tela Motoristas do gestor (GES-7).
 *
 * Antes, a lista da loja anterior ficava na tela até a nova chegar, e, se a
 * nova falhasse, só aparecia um toast sobre os motoristas da OUTRA loja.
 */
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { supabase } from '@/lib/supabase';

import { useMotoristasOperations } from '../useMotoristasOperations';

let mockLoja: string | null = 'loja-a';
let mockLojaCarregando = false;
const mockRespostas: Record<
  string,
  (r: { data: unknown; error: unknown }) => void
> = {};
const mockShowToast = jest.fn();

jest.mock('@/hooks/useUnidadeAtiva', () => ({
  useUnidadeAtiva: () => ({
    unidadeAtiva: mockLoja,
    loading: mockLojaCarregando,
  }),
}));
jest.mock('@/hooks/useUser', () => ({
  useUser: () => ({ userData: { id: 'g1', nome: 'Gestor' } }),
}));
jest.mock('@/hooks/useToast', () => {
  const retorno = {
    toast: { visible: false, message: '', type: 'success', duration: 3000 },
    showToast: (...args: unknown[]) => mockShowToast(...args),
    hideToast: jest.fn(),
    withToast: jest.fn(),
  };
  return { useToast: () => retorno };
});
jest.mock('@/lib/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));
jest.mock('@/lib/queries', () => ({
  updateUsuario: jest.fn(),
  logUserAction: jest.fn(),
}));
jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    from: jest.fn(),
    auth: { getSession: jest.fn() },
  },
}));

function motorista(id: string, nome: string) {
  return { id, nome, email: `${id}@t.com`, telefone: '1', ativo: true };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLoja = 'loja-a';
  mockLojaCarregando = false;
  for (const k of Object.keys(mockRespostas)) delete mockRespostas[k];
  (supabase.rpc as jest.Mock).mockImplementation(
    (_fn: string, args: { p_unidade_id: string }) =>
      new Promise((resolve) => {
        mockRespostas[args.p_unidade_id] = resolve;
      }),
  );
});

async function carregarLojaA(result: {
  current: ReturnType<typeof useMotoristasOperations>;
}) {
  await waitFor(() => expect(mockRespostas['loja-a']).toBeDefined());
  await act(async () => {
    mockRespostas['loja-a']({
      data: [motorista('ana', 'Ana')],
      error: null,
    });
  });
  await waitFor(() => expect(result.current.motoristas).toHaveLength(1));
}

describe('useMotoristasOperations — troca de loja', () => {
  it('não mostra os motoristas da loja anterior enquanto a nova carrega', async () => {
    const { result, rerender } = renderHook(() => useMotoristasOperations());
    await carregarLojaA(result);

    mockLoja = 'loja-b';
    rerender({});

    expect(result.current.motoristas).toEqual([]);
    expect(result.current.totalMotoristas).toBe(0);
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(mockRespostas['loja-b']).toBeDefined());
    await act(async () => {
      mockRespostas['loja-b']({ data: [motorista('bia', 'Bia')], error: null });
    });
    await waitFor(() =>
      expect(result.current.motoristas.map((m) => m.nome)).toEqual(['Bia']),
    );
    expect(result.current.loading).toBe(false);
  });

  it('carga da loja nova falhando deixa a lista vazia, sem os da anterior', async () => {
    const { result, rerender } = renderHook(() => useMotoristasOperations());
    await carregarLojaA(result);

    mockLoja = 'loja-b';
    rerender({});
    await waitFor(() => expect(mockRespostas['loja-b']).toBeDefined());
    await act(async () => {
      mockRespostas['loja-b']({ data: null, error: { message: 'rede' } });
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.motoristas).toEqual([]);
    expect(mockShowToast).toHaveBeenCalledWith(
      'Não foi possível carregar os motoristas',
      'error',
    );
  });

  it('resposta da loja A chegando depois da troca para B não entra no estado', async () => {
    const { result, rerender } = renderHook(() => useMotoristasOperations());
    await waitFor(() => expect(mockRespostas['loja-a']).toBeDefined());

    mockLoja = 'loja-b';
    rerender({});
    await waitFor(() => expect(mockRespostas['loja-b']).toBeDefined());
    await act(async () => {
      mockRespostas['loja-b']({ data: [motorista('bia', 'Bia')], error: null });
    });
    await waitFor(() => expect(result.current.motoristas).toHaveLength(1));

    await act(async () => {
      mockRespostas['loja-a']({
        data: [motorista('ana', 'Ana')],
        error: null,
      });
    });

    expect(result.current.motoristas.map((m) => m.nome)).toEqual(['Bia']);
  });

  it('loja A → sem loja → loja B: a lista de A some no "sem loja" e não volta', async () => {
    const { result, rerender } = renderHook(() => useMotoristasOperations());
    await carregarLojaA(result);

    mockLoja = null;
    rerender({});

    await waitFor(() => expect(result.current.motoristas).toEqual([]));
    expect(result.current.totalMotoristas).toBe(0);
    expect(result.current.loading).toBe(false);

    mockLoja = 'loja-b';
    rerender({});
    expect(result.current.motoristas).toEqual([]);
    await waitFor(() => expect(mockRespostas['loja-b']).toBeDefined());
    await act(async () => {
      mockRespostas['loja-b']({ data: [motorista('bia', 'Bia')], error: null });
    });
    await waitFor(() =>
      expect(result.current.motoristas.map((m) => m.nome)).toEqual(['Bia']),
    );
  });

  it('loja ainda resolvendo (unidadeAtiva null de passagem) segue carregando, sem "vazia definitiva"', async () => {
    mockLoja = null;
    mockLojaCarregando = true;
    const { result, rerender } = renderHook(() => useMotoristasOperations());

    // Dá tempo a efeitos; o hook não pode ter decidido "sem loja".
    await act(async () => {});
    expect(result.current.loading).toBe(true);
    expect(supabase.rpc).not.toHaveBeenCalled();

    mockLoja = 'loja-a';
    mockLojaCarregando = false;
    rerender({});
    expect(result.current.loading).toBe(true);
    await carregarLojaA(result);
    expect(result.current.loading).toBe(false);
  });
});
