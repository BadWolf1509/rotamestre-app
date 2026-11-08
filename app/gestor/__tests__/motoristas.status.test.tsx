/**
 * Tela Motoristas: o selo Ativo/Inativo usa o tom de texto do status (>= 4,5:1
 * sobre o fundo do selo), não a cor do status sobre ela mesma.
 */
import {
  fireEvent,
  render,
  renderHook,
  screen,
} from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

import { larguraMinimaDaTabela } from '@/components/data-table/larguras';
import type {
  DataTableAction,
  DataTableColumn,
} from '@/components/data-table/types';
import { useUnistyles } from '@/utils/styles';

import MotoristasGestor from '../motoristas';

// Captura colunas e ações que a tela entrega ao DataTable (render real).
let mockColunas: DataTableColumn<object>[] = [];
let mockAcoes: DataTableAction<object>[] = [];
jest.mock('@/design-system', () => {
  const real = jest.requireActual('@/design-system');
  const ReactLocal = jest.requireActual('react');
  return {
    ...real,
    DataTable: (props: {
      columns: DataTableColumn<object>[];
      actions?: DataTableAction<object>[];
    }) => {
      mockColunas = props.columns;
      mockAcoes = props.actions ?? [];
      return ReactLocal.createElement(real.DataTable, props);
    },
  };
});

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
}));
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({ isDesktop: true, isMobile: false, isTablet: false }),
}));
jest.mock('@/hooks/useUser', () => ({
  useUser: () => ({ userData: { id: 'gestor-1', nome: 'Gestor' } }),
}));
jest.mock('@/hooks/useUnidadeAtiva', () => ({
  useUnidadeAtiva: () => ({ unidadeAtiva: 'loja-ativa' }),
}));
jest.mock('@/hooks/useDesktopHeaderMenu', () => ({
  useDesktopHeaderMenu: () => ({
    userMenuTrigger: null,
    userMenuItems: [],
    logoutModal: null,
  }),
}));
jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(() =>
      Promise.resolve({
        data: [
          {
            id: 'm1',
            nome: 'Ana',
            email: 'ana@exemplo.com',
            telefone: null,
            ativo: true,
            created_at: '2026-10-01T12:00:00Z',
            vinculo_ativo: true,
          },
          {
            id: 'm2',
            nome: 'Bia',
            email: 'bia@exemplo.com',
            telefone: null,
            ativo: false,
            created_at: '2026-10-01T12:00:00Z',
            vinculo_ativo: true,
          },
        ],
        error: null,
      }),
    ),
    auth: { getSession: jest.fn() },
    from: jest.fn(),
  },
}));

it('Ativo em successDark e Inativo em gray600', async () => {
  const { result } = renderHook(() => useUnistyles());
  const { colors } = result.current.theme;
  render(<MotoristasGestor />);

  const ativo = await screen.findByText('Ativo');
  expect(StyleSheet.flatten(ativo.props.style).color).toBe(colors.successDark);
  const inativo = screen.getByText('Inativo');
  expect(StyleSheet.flatten(inativo.props.style).color).toBe(colors.gray600);
});

it('a tabela cabe no cartão de 950 px (1280 de janela) sem rolar', async () => {
  render(<MotoristasGestor />);
  await screen.findByText('Ativo');

  expect(larguraMinimaDaTabela(mockColunas, mockAcoes)).toBeLessThanOrEqual(
    950,
  );
});

it('Ativar/Desativar vai para o menu "Mais ações" da linha', async () => {
  render(<MotoristasGestor />);
  await screen.findByText('Ativo');

  expect(screen.queryByText('Desativar')).toBeNull();
  fireEvent.press(screen.getAllByLabelText('Mais ações')[0]);
  expect(screen.getByRole('menuitem', { name: 'Desativar' })).toBeTruthy();
});

it('"Ver perfil" e "Adicionar motorista" com maiúscula só na primeira palavra', async () => {
  render(<MotoristasGestor />);
  await screen.findByText('Ativo');

  expect(screen.getAllByText('Ver perfil').length).toBeGreaterThan(0);
  expect(screen.getByText('Adicionar motorista')).toBeTruthy();
});

it('nome e e-mail ficam numa linha, com o texto inteiro no accessibilityLabel', async () => {
  render(<MotoristasGestor />);
  await screen.findByText('Ativo');

  // `noWrap` na coluna não fazia nada: quem trunca é o `Text` do render.
  for (const texto of ['Ana', 'ana@exemplo.com']) {
    const celula = screen.getByText(texto);
    expect(celula.props.numberOfLines).toBe(1);
    expect(celula.props.accessibilityLabel).toBe(texto);
  }
});
