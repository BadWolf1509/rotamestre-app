/**
 * Equipe e contagem da Minha Unidade na troca de loja: a resposta da loja
 * anterior que chega DEPOIS da atual não pode sobrescrevê-la, e a lista da
 * loja anterior não fica na tela sob o nome da nova.
 */
import { act, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import EquipeScreen from '../equipe';
import UnidadeScreen from '../index';

let mockUnidadeAtiva = 'loja-a';
jest.mock('@/hooks/useUnidadeAtiva', () => ({
  useUnidadeAtiva: () => ({ unidadeAtiva: mockUnidadeAtiva, loading: false }),
}));
jest.mock('@/hooks/useUser', () => ({
  useUser: () => ({
    userData: {
      id: 'g1',
      papel: 'gestor',
      unidade_id: 'loja-a',
      nome: 'Gestora',
      foto_url: null,
      is_gestor_principal: false,
    },
    loading: false,
  }),
}));
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({ isDesktop: false, isMobile: true, isTablet: false }),
}));
jest.mock('@/components/AddressAutocomplete', () => ({
  AddressAutocomplete: () => null,
}));
jest.mock('@/lib/googlePlaces', () => ({
  googlePlacesService: { getPlaceDetails: jest.fn() },
}));

// Cada carga fica pendurada até o teste resolvê-la, na ordem que quiser.
const mockPendentes: Record<string, ((v: unknown) => void)[]> = {};
jest.mock('@/lib/gestor/equipeDaLoja', () => ({
  ...jest.requireActual('@/lib/gestor/equipeDaLoja'),
  carregarEquipeDaLoja: (unidadeId: string) =>
    new Promise((resolve) => {
      (mockPendentes[unidadeId] ??= []).push(resolve);
    }),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => {
      const consulta = {
        select: () => consulta,
        eq: () => consulta,
        single: () =>
          Promise.resolve({
            data: { id: mockUnidadeAtiva, nome: 'Loja', cidade: 'C', uf: 'SP' },
            error: null,
          }),
        then: (resolve: (v: unknown) => void) =>
          resolve({ data: null, error: null }),
      };
      return consulta;
    },
    rpc: () => Promise.resolve({ data: null, error: null }),
  },
}));

function membro(id: string, nome: string, ativo = true) {
  return {
    id,
    nome,
    email: `${id}@x.com`,
    papel: 'motorista' as const,
    is_gestor_principal: false,
    ativo,
    created_at: '2026-08-01T00:00:00Z',
    foto_url: null,
  };
}

async function resolver(unidadeId: string, valor: unknown) {
  await waitFor(() =>
    expect(mockPendentes[unidadeId]?.length).toBeGreaterThan(0),
  );
  const resolve = mockPendentes[unidadeId].shift();
  await act(async () => {
    resolve?.(valor);
  });
}

beforeEach(() => {
  mockUnidadeAtiva = 'loja-a';
  for (const k of Object.keys(mockPendentes)) delete mockPendentes[k];
});

describe('Equipe na troca de loja', () => {
  it('descarta a resposta da loja anterior que chega depois da atual', async () => {
    const { rerender } = render(<EquipeScreen />);
    await resolver('loja-a', [membro('a1', 'Membro da A')]);
    expect(await screen.findByText('Membro da A')).toBeTruthy();

    // Recarga da A em voo (ex.: depois de um toggle) e troca para a B.
    mockUnidadeAtiva = 'loja-b';
    rerender(<EquipeScreen />);

    // A lista da A não fica na tela sob a loja B.
    await waitFor(() => expect(screen.queryByText('Membro da A')).toBeNull());

    await resolver('loja-b', [membro('b1', 'Membro da B')]);
    expect(await screen.findByText('Membro da B')).toBeTruthy();
  });

  it('a carga lenta da loja A não sobrescreve a da B', async () => {
    const { rerender } = render(<EquipeScreen />);
    // A carga da A ainda em voo quando o gestor troca para a B.
    mockUnidadeAtiva = 'loja-b';
    rerender(<EquipeScreen />);

    await resolver('loja-b', [membro('b1', 'Membro da B')]);
    expect(await screen.findByText('Membro da B')).toBeTruthy();

    await resolver('loja-a', [membro('a1', 'Membro da A')]);
    expect(screen.getByText('Membro da B')).toBeTruthy();
    expect(screen.queryByText('Membro da A')).toBeNull();
  });
});

describe('Minha Unidade: contagem da equipe na troca de loja', () => {
  it('a contagem lenta da loja A não sobrescreve a da B', async () => {
    const { rerender } = render(<UnidadeScreen />);
    mockUnidadeAtiva = 'loja-b';
    rerender(<UnidadeScreen />);

    await resolver('loja-b', [membro('b1', 'B1'), membro('b2', 'B2', false)]);
    expect(await screen.findByText('1 ativo · 1 inativo')).toBeTruthy();

    await resolver('loja-a', [
      membro('a1', 'A1'),
      membro('a2', 'A2'),
      membro('a3', 'A3'),
    ]);
    expect(screen.getByText('1 ativo · 1 inativo')).toBeTruthy();
    expect(screen.queryByText('3 ativos · 0 inativos')).toBeNull();
  });
});
