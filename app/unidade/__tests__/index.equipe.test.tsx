/**
 * Minha Unidade: o selo de gestor principal e o número de membros seguem a
 * LOJA ABERTA, com a mesma fonte da tela Equipe.
 */
import { render, screen } from '@testing-library/react-native';
import React from 'react';

import UnidadeScreen from '../index';

let mockUnidadeAtiva = 'loja-a';
jest.mock('@/hooks/useUnidadeAtiva', () => ({
  useUnidadeAtiva: () => ({ unidadeAtiva: mockUnidadeAtiva, loading: false }),
}));
// Principal com o flag no slot da loja-a (`usuarios.unidade_id`).
jest.mock('@/hooks/useUser', () => ({
  useUser: () => ({
    userData: {
      id: 'g1',
      papel: 'gestor',
      unidade_id: 'loja-a',
      nome: 'Gestora',
      foto_url: null,
      is_gestor_principal: true,
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

const GESTORES = [
  {
    usuarios: {
      id: 'g1',
      nome: 'Gestora',
      email: 'g@x.com',
      papel: 'gestor',
      is_gestor_principal: true,
      unidade_id: 'loja-a',
      ativo: true,
      created_at: '2026-07-01T00:00:00Z',
      foto_url: null,
    },
  },
];
const MOTORISTAS = [
  {
    id: 'm1',
    nome: 'Ativo',
    email: 'm1@x.com',
    ativo: true,
    vinculo_ativo: true,
    created_at: '2026-08-01T00:00:00Z',
    foto_url: null,
  },
  {
    // Inativo só nesta loja: a Equipe o lista (para reativar).
    id: 'm2',
    nome: 'Inativo',
    email: 'm2@x.com',
    ativo: false,
    vinculo_ativo: false,
    created_at: '2026-08-02T00:00:00Z',
    foto_url: null,
  },
];

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (tabela: string) => {
      const consulta = {
        select: () => consulta,
        eq: () => consulta,
        single: () =>
          Promise.resolve({
            data: { id: 'loja', nome: 'Loja', cidade: 'C', uf: 'SP' },
            error: null,
          }),
        then: (resolve: (v: unknown) => void) =>
          resolve(
            tabela === 'usuario_unidades'
              ? { data: GESTORES, error: null }
              : { data: null, error: null },
          ),
      };
      return consulta;
    },
    rpc: (nome: string) =>
      Promise.resolve(
        nome === 'listar_motoristas_unidade'
          ? { data: MOTORISTAS, error: null }
          : { data: null, error: null },
      ),
  },
}));

beforeEach(() => {
  mockUnidadeAtiva = 'loja-a';
});

describe('Minha Unidade — principal e membros por loja', () => {
  it('principal desta loja vê o selo', async () => {
    render(<UnidadeScreen />);
    expect(await screen.findByText('⭐ Gestor Principal')).toBeTruthy();
  });

  it('com OUTRA loja aberta, o principal da loja-a não ganha o selo', async () => {
    mockUnidadeAtiva = 'loja-b';
    render(<UnidadeScreen />);
    expect(await screen.findByText('✏️ Editar Informações')).toBeTruthy();
    expect(screen.queryByText('⭐ Gestor Principal')).toBeNull();
  });

  it('conta como a Equipe: total, com ativos e inativos explicados', async () => {
    render(<UnidadeScreen />);
    expect(await screen.findByText('2 ativos · 1 inativo')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
  });
});
