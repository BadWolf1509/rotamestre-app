/**
 * Loja do perfil (fallback sem vinculação) com identidade estável.
 *
 * Sem vinculação, `unidadeAtivaData` vem de `userData.unidades`. Cada busca
 * fresca do perfil (profileEvents, foco do app) traz um objeto NOVO com o
 * mesmo conteúdo, e `nova-entrega/useEnderecoUnidade.ts` tem
 * `unidadeAtivaData` na dependência do efeito que começa com
 * `setEnderecoUnidade(null)`: o endereço da sede sumia da Nova Rota a cada
 * recarga do perfil (herdado da revisão da tarefa 7).
 */
import { renderHook, waitFor } from '@testing-library/react-native';

import { UnidadeAtivaProvider, useUnidadeAtiva } from '../useUnidadeAtiva';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
}));
jest.mock('@/lib/profileEvents', () => ({
  emitProfileUpdate: jest.fn(),
  onProfileUpdate: () => () => {},
}));
jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

function loja(updatedAt: string, sedeLatitude = -7.1) {
  return {
    id: 'loja-a',
    nome: 'Loja A',
    updated_at: updatedAt,
    sede_latitude: sedeLatitude,
    sede_longitude: -34.8,
    sede_endereco: 'Rua A, 1',
  };
}

// Um objeto NOVO a cada leitura, como uma busca fresca do perfil.
let mockUnidadeDoPerfil: () => ReturnType<typeof loja> = () =>
  loja('2026-10-24T10:00:00Z');
jest.mock('../useUser', () => ({
  useUser: () => ({
    userData: {
      id: 'g1',
      unidade_id: 'loja-a',
      papel: 'gestor',
      unidades: mockUnidadeDoPerfil(),
    },
    refresh: jest.fn(),
  }),
}));

// Nenhuma vinculação: o provider cai no perfil.
jest.mock('@/lib/supabase', () => {
  const consulta: Record<string, unknown> = {};
  consulta.select = () => consulta;
  consulta.eq = () => consulta;
  consulta.order = () => consulta;
  consulta.returns = async () => ({ data: [], error: null });
  return {
    isSupabaseConfigured: true,
    supabase: { from: () => consulta },
  };
});

describe('useUnidadeAtiva — loja do perfil sem vinculação', () => {
  beforeEach(() => {
    mockUnidadeDoPerfil = () => loja('2026-10-24T10:00:00Z');
  });

  it('mesma loja numa busca nova do perfil mantém a identidade', async () => {
    const { result, rerender } = renderHook(() => useUnidadeAtiva(), {
      wrapper: UnidadeAtivaProvider,
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    const antes = result.current.unidadeAtivaData;
    expect(antes?.id).toBe('loja-a');

    rerender({});

    expect(result.current.unidadeAtivaData).toBe(antes);
  });

  it('loja alterada (sede nova) chega como objeto novo', async () => {
    const { result, rerender } = renderHook(() => useUnidadeAtiva(), {
      wrapper: UnidadeAtivaProvider,
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    const antes = result.current.unidadeAtivaData;

    mockUnidadeDoPerfil = () => loja('2026-10-24T11:00:00Z', -7.2);
    rerender({});

    expect(result.current.unidadeAtivaData).not.toBe(antes);
    expect(result.current.unidadeAtivaData?.sede_latitude).toBe(-7.2);
  });
});
