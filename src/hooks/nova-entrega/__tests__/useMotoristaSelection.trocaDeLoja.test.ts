/**
 * Troca de loja com carga lenta (B-GES-8): a resposta da loja anterior chega
 * depois da nova e não pode sobrescrever a lista.
 */
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { criarCadeia } from '@/__tests__/helpers/cadeiaSupabase';
import type { MotoristaDaLoja } from '@/lib/gestor/motoristasDaLoja';

import { useMotoristaSelection } from '../useMotoristaSelection';

let mockLoja: string | null = 'loja-a';
jest.mock('@/hooks/useUnidadeAtiva', () => ({
  useUnidadeAtiva: () => ({ unidadeAtiva: mockLoja }),
}));
jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

const mockFrom = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: { from: (...a: unknown[]) => mockFrom(...a) },
}));

const mockBuscar = jest.fn();
jest.mock('@/lib/gestor/motoristasDaLoja', () => ({
  buscarMotoristasAtivosDaLoja: (...a: unknown[]) => mockBuscar(...a),
}));

const motorista = (id: string, nome: string): MotoristaDaLoja => ({
  id,
  nome,
  email: `${id}@x.com`,
  ativo: true,
  ultimo_login: '2026-11-01T00:00:00Z',
});

function adiavel() {
  let resolver: (v: MotoristaDaLoja[]) => void = () => {};
  const promessa = new Promise<MotoristaDaLoja[]>((r) => {
    resolver = r;
  });
  return { promessa, resolver };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLoja = 'loja-a';
  // Resumo de carga: nenhuma rota ativa.
  mockFrom.mockReturnValue(criarCadeia({ data: [], error: null }));
});

describe('useMotoristaSelection — troca de loja', () => {
  it('a resposta lenta da loja anterior não sobrescreve a da loja nova', async () => {
    const lentaA = adiavel();
    mockBuscar.mockImplementation((loja: string) =>
      loja === 'loja-a'
        ? lentaA.promessa
        : Promise.resolve([motorista('b1', 'Bruno')]),
    );

    const { result, rerender } = renderHook(() => useMotoristaSelection());

    mockLoja = 'loja-b';
    rerender({});
    await waitFor(() =>
      expect(result.current.motoristas.map((m) => m.id)).toEqual(['b1']),
    );

    // A loja A responde por último: descartada.
    await act(async () => {
      lentaA.resolver([motorista('a1', 'Ana')]);
    });

    expect(result.current.motoristas.map((m) => m.id)).toEqual(['b1']);
    expect(result.current.isLoading).toBe(false);
  });

  it('o carregamento da loja anterior não encerra o da nova', async () => {
    const lentaA = adiavel();
    const lentaB = adiavel();
    mockBuscar.mockImplementation((loja: string) =>
      loja === 'loja-a' ? lentaA.promessa : lentaB.promessa,
    );

    const { result, rerender } = renderHook(() => useMotoristaSelection());
    mockLoja = 'loja-b';
    rerender({});

    await act(async () => {
      lentaA.resolver([motorista('a1', 'Ana')]);
    });

    // A nova ainda carrega: nada de lista da outra loja nem "carregado".
    expect(result.current.isLoading).toBe(true);
    expect(result.current.motoristas).toEqual([]);

    await act(async () => {
      lentaB.resolver([motorista('b1', 'Bruno')]);
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.motoristas.map((m) => m.id)).toEqual(['b1']);
  });
});
