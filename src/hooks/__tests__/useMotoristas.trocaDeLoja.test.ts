/**
 * Troca de loja em useMotoristas (GES-7).
 *
 * Antes, `fetchingRef` descartava a carga da loja nova enquanto a da anterior
 * estava em voo — o seletor de motorista ficava com a lista da outra loja — e
 * uma resposta atrasada da loja A podia sobrescrever a lista da B.
 */
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useMotoristas } from '../useMotoristas';

let mockLoja = 'loja-a';
// Respostas por loja; a que ainda não foi liberada fica pendente.
const mockRespostas: Record<
  string,
  { resolver: (r: { data: unknown; error: unknown }) => void }
> = {};

jest.mock('@/lib/cache', () => ({
  getCache: jest.fn().mockResolvedValue(null),
  setCache: jest.fn().mockResolvedValue(undefined),
  CACHE_TTL: { MOTORISTAS: 300000 },
  CACHE_KEYS: {
    MOTORISTAS: (unidadeId: string) => `motoristas:${unidadeId}`,
  },
}));
jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));
jest.mock('../useUnidadeAtiva', () => ({
  useUnidadeAtiva: () => ({ unidadeAtiva: mockLoja }),
}));
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: (_c: string, loja: string) => ({
          eq: () => ({
            eq: () =>
              new Promise((resolve) => {
                mockRespostas[loja] = { resolver: resolve };
              }),
          }),
        }),
      }),
    }),
  },
}));

function vinculo(id: string, nome: string) {
  return {
    usuario_id: id,
    usuarios: { id, nome, email: `${id}@t.com`, telefone: '1', ativo: true },
  };
}

beforeEach(() => {
  mockLoja = 'loja-a';
  for (const k of Object.keys(mockRespostas)) delete mockRespostas[k];
});

describe('useMotoristas — troca de loja', () => {
  it('não mostra os motoristas da loja anterior enquanto a nova carrega', async () => {
    const { result, rerender } = renderHook(() => useMotoristas());
    await waitFor(() => expect(mockRespostas['loja-a']).toBeDefined());
    await act(async () => {
      mockRespostas['loja-a'].resolver({
        data: [vinculo('ana', 'Ana')],
        error: null,
      });
    });
    await waitFor(() => expect(result.current.motoristas).toHaveLength(1));

    mockLoja = 'loja-b';
    rerender({});

    expect(result.current.motoristas).toEqual([]);
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(mockRespostas['loja-b']).toBeDefined());
  });

  it('a carga da loja nova roda mesmo com a da anterior ainda em voo', async () => {
    const { result, rerender } = renderHook(() => useMotoristas());
    await waitFor(() => expect(mockRespostas['loja-a']).toBeDefined());

    mockLoja = 'loja-b';
    rerender({});
    await waitFor(() => expect(mockRespostas['loja-b']).toBeDefined());
    await act(async () => {
      mockRespostas['loja-b'].resolver({
        data: [vinculo('bia', 'Bia')],
        error: null,
      });
    });

    await waitFor(() =>
      expect(result.current.motoristas.map((m) => m.nome)).toEqual(['Bia']),
    );
    expect(result.current.loading).toBe(false);
  });

  it('resposta da loja A chegando DEPOIS da troca para B não entra no estado', async () => {
    const { result, rerender } = renderHook(() => useMotoristas());
    await waitFor(() => expect(mockRespostas['loja-a']).toBeDefined());

    mockLoja = 'loja-b';
    rerender({});
    await waitFor(() => expect(mockRespostas['loja-b']).toBeDefined());
    await act(async () => {
      mockRespostas['loja-b'].resolver({
        data: [vinculo('bia', 'Bia')],
        error: null,
      });
    });
    await waitFor(() => expect(result.current.motoristas).toHaveLength(1));

    await act(async () => {
      mockRespostas['loja-a'].resolver({
        data: [vinculo('ana', 'Ana')],
        error: null,
      });
    });

    expect(result.current.motoristas.map((m) => m.nome)).toEqual(['Bia']);
  });

  it('carga da loja nova falhando deixa a lista vazia, sem os da anterior', async () => {
    const { result, rerender } = renderHook(() => useMotoristas());
    await waitFor(() => expect(mockRespostas['loja-a']).toBeDefined());
    await act(async () => {
      mockRespostas['loja-a'].resolver({
        data: [vinculo('ana', 'Ana')],
        error: null,
      });
    });
    await waitFor(() => expect(result.current.motoristas).toHaveLength(1));

    mockLoja = 'loja-b';
    rerender({});
    await waitFor(() => expect(mockRespostas['loja-b']).toBeDefined());
    await act(async () => {
      mockRespostas['loja-b'].resolver({
        data: null,
        error: { message: 'rede' },
      });
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.motoristas).toEqual([]);
  });
});
