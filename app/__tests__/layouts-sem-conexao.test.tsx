/**
 * Portões protegidos (layouts com `useRequireAuth`) com a busca do perfil
 * falhando e nenhum perfil conhecido no aparelho: antes, `null` (o redirect
 * para o login já tinha saído). Agora a tela diz "Sem conexão" e oferece
 * "Tentar novamente" — sem login, sem onboarding, sessão intacta.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import GestorLayout from '../gestor/_layout';
import MotoristaLayout from '../motorista/_layout';
import PerfilLayout from '../perfil/_layout';
import UnidadeLayout from '../unidade/_layout';

const mockTentarNovamente = jest.fn();
let mockMotivo: 'conexao' | 'erro' = 'conexao';
jest.mock('@/hooks/useRequireAuth', () => ({
  useRequireAuth: () => ({
    isReady: true,
    isAuthorized: false,
    userData: null,
    perfilIndisponivel: mockMotivo,
    tentando: false,
    tentarNovamente: mockTentarNovamente,
  }),
}));
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({ isDesktop: false }),
}));
jest.mock('@/components/NotificationBell', () => ({
  NotificationBell: () => null,
}));
jest.mock('@/components/gestor/dashboard/_components/desktop/Sidebar', () => ({
  Sidebar: () => null,
}));
jest.mock('@/context/RouteStatusContext', () => ({
  RouteStatusProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}));
jest.mock('@/context/DrawerMenuContext', () => ({
  DrawerMenuProvider: ({ children }: { children: React.ReactNode }) => children,
  useDrawerMenu: () => ({ openDrawer: jest.fn() }),
}));
jest.mock('expo-router', () => {
  const Stack = () => null;
  Stack.Screen = () => null;
  return {
    Stack,
    Slot: () => null,
    useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
  };
});

describe.each([
  ['motorista', MotoristaLayout],
  ['gestor', GestorLayout],
  ['perfil', PerfilLayout],
  ['unidade', UnidadeLayout],
])('layout %s sem conexão e sem perfil conhecido', (_nome, Layout) => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMotivo = 'conexao';
  });

  it('mostra "Sem conexão" com "Tentar novamente"', () => {
    render(<Layout />);

    expect(screen.getByText('Sem conexão')).toBeTruthy();
    fireEvent.press(screen.getByText('Tentar novamente'));
    expect(mockTentarNovamente).toHaveBeenCalled();
  });

  it('erro de verdade (não é rede) diz que o perfil não carregou', () => {
    mockMotivo = 'erro';
    render(<Layout />);

    expect(
      screen.getByText('Não foi possível carregar seu perfil'),
    ).toBeTruthy();
    expect(screen.queryByText('Sem conexão')).toBeNull();
  });
});
