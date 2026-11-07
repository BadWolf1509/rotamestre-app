/**
 * Tela Motoristas: o selo Ativo/Inativo usa o tom de texto do status (>= 4,5:1
 * sobre o fundo do selo), não a cor do status sobre ela mesma.
 */
import { renderHook, render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

import { useUnistyles } from '@/utils/styles';

import MotoristasGestor from '../motoristas';

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
