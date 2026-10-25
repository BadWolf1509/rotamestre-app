/**
 * Minha Unidade ao trocar de loja.
 *
 * - A carga da loja anterior que chega DEPOIS da nova não pode sobrescrever
 *   o formulário (guarda de sequência).
 * - Salvar grava na loja ATIVA, não na que o formulário carregou antes.
 */
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import React from 'react';

import UnidadeScreen from '../index';

let mockUnidadeAtiva = 'loja-a';
const mockRecarregarLojas = jest.fn();
jest.mock('@/hooks/useUnidadeAtiva', () => ({
  useUnidadeAtiva: () => ({
    unidadeAtiva: mockUnidadeAtiva,
    loading: false,
    refresh: mockRecarregarLojas,
  }),
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

function unidade(id: string, nome: string) {
  return {
    id,
    nome,
    telefone: '',
    endereco: '',
    cidade: 'Cidade',
    uf: 'SP',
    cep: '',
    sede_endereco: null,
  };
}

// Respostas de `unidades` por id; a da loja A pode ficar pendurada.
const mockRespostas: Record<string, Promise<unknown>> = {};
const mockRpc = jest.fn().mockResolvedValue({ data: null, error: null });

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (tabela: string) => {
      let id = '';
      const consulta = {
        select: () => consulta,
        eq: (col: string, val: string) => {
          if (col === 'id') id = val;
          return consulta;
        },
        single: () => mockRespostas[id],
        then: (resolve: (v: unknown) => void) =>
          resolve({ count: 1, error: null, tabela }),
      };
      return consulta;
    },
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockUnidadeAtiva = 'loja-a';
});

describe('Minha Unidade — troca de loja', () => {
  it('a resposta atrasada da loja anterior não sobrescreve a loja nova', async () => {
    let soltarA: (v: unknown) => void = () => {};
    mockRespostas['loja-a'] = new Promise((r) => {
      soltarA = r;
    });
    mockRespostas['loja-b'] = Promise.resolve({
      data: unidade('loja-b', 'Loja B'),
      error: null,
    });

    const { rerender } = render(<UnidadeScreen />);
    mockUnidadeAtiva = 'loja-b';
    rerender(<UnidadeScreen />);

    fireEvent.press(await screen.findByText('✏️ Editar Informações'));
    await waitFor(() =>
      expect(screen.getByPlaceholderText('Nome da unidade').props.value).toBe(
        'Loja B',
      ),
    );

    await act(async () => {
      soltarA({ data: unidade('loja-a', 'Loja A'), error: null });
      await Promise.resolve();
    });

    expect(screen.getByPlaceholderText('Nome da unidade').props.value).toBe(
      'Loja B',
    );
  });

  it('salvar grava na loja ativa', async () => {
    mockRespostas['loja-b'] = Promise.resolve({
      data: unidade('loja-b', 'Loja B'),
      error: null,
    });
    mockUnidadeAtiva = 'loja-b';

    render(<UnidadeScreen />);
    fireEvent.press(await screen.findByText('✏️ Editar Informações'));
    await waitFor(() =>
      expect(screen.getByPlaceholderText('Nome da unidade').props.value).toBe(
        'Loja B',
      ),
    );
    fireEvent.press(screen.getByText('Salvar'));

    // Só a RPC de salvar: a tela também lista a equipe por RPC.
    const salvar = () =>
      mockRpc.mock.calls.filter(([nome]) => nome === 'atualizar_unidade');
    await waitFor(() => expect(salvar()).toHaveLength(1));
    expect(salvar()[0][1]).toMatchObject({ p_unidade_id: 'loja-b' });
  });

  // Revisão da tarefa 7 (C1, mesma classe): nome e sede da loja vivem nas
  // vinculações do UnidadeAtivaProvider da raiz, que não desmonta. Sem
  // recarregar, a Nova Rota seguia com a sede antiga até reabrir o app.
  it('salvar recarrega as lojas do provider (nome e sede novos em todas as telas)', async () => {
    mockRespostas['loja-b'] = Promise.resolve({
      data: unidade('loja-b', 'Loja B'),
      error: null,
    });
    mockUnidadeAtiva = 'loja-b';
    mockRecarregarLojas.mockClear();

    render(<UnidadeScreen />);
    fireEvent.press(await screen.findByText('✏️ Editar Informações'));
    await waitFor(() =>
      expect(screen.getByPlaceholderText('Nome da unidade').props.value).toBe(
        'Loja B',
      ),
    );
    fireEvent.press(screen.getByText('Salvar'));

    await waitFor(() => expect(mockRecarregarLojas).toHaveBeenCalledTimes(1));
  });
});
