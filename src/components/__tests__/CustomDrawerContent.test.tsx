import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { View, Text } from 'react-native';

import { CustomDrawerContent } from '../CustomDrawerContent';

// Mock @react-navigation/drawer BEFORE importing component
jest.mock('@react-navigation/drawer', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    DrawerContentScrollView: ({ children, ...props }: any) =>
      React.createElement(View, { ...props, testID: 'drawer-scroll-view' }, children),
    DrawerItemList: () => React.createElement(View, { testID: 'drawer-item-list' }, null),
    DrawerItem: ({ label, onPress }: any) => {
      const { TouchableOpacity, Text } = require('react-native');
      return React.createElement(
        TouchableOpacity,
        { onPress, testID: `drawer-item-${label}` },
        React.createElement(Text, null, label)
      );
    },
  };
});

// Mock expo-router
const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: mockPush,
  }),
}));

// Mock authService
const mockSignOut = jest.fn();
const mockGetSession = jest.fn();
const mockGetUsuario = jest.fn();
jest.mock('@/lib/auth', () => ({
  authService: {
    signOut: mockSignOut,
    getSession: mockGetSession,
    getUsuario: mockGetUsuario,
  },
}));

// Mock ConfirmDialog
jest.mock('@/components/ConfirmDialog', () => ({
  ConfirmDialog: ({ visible, title, onConfirm, onCancel }: any) => {
    const { View, Text, TouchableOpacity } = require('react-native');
    if (!visible) return null;
    return (
      <View>
        <Text>{title}</Text>
        <TouchableOpacity onPress={onConfirm}>
          <Text>Confirmar</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onCancel}>
          <Text>Cancelar</Text>
        </TouchableOpacity>
      </View>
    );
  },
}));

// Mock @react-navigation/drawer
const mockCloseDrawer = jest.fn();
const mockDrawerProps = {
  navigation: {
    closeDrawer: mockCloseDrawer,
  },
  state: {
    routes: [],
    index: 0,
  },
  descriptors: {},
};

describe('CustomDrawerContent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSession.mockResolvedValue({
      user: { id: 'user-123', email: 'motorista@test.com' },
    });
    mockGetUsuario.mockResolvedValue({
      id: 'user-123',
      nome: 'João Silva',
      email: 'motorista@test.com',
      papel: 'motorista',
    });
  });

  describe('Renderização Básica', () => {
    it('deve renderizar DrawerContentScrollView', async () => {
      const { getByTestId } = render(
        <CustomDrawerContent {...mockDrawerProps} />
      );

      await waitFor(() => {
        expect(getByTestId('drawer-scroll-view')).toBeTruthy();
      });
    });

    it('deve renderizar avatar com inicial do usuário', async () => {
      const { getByText } = render(
        <CustomDrawerContent {...mockDrawerProps} />
      );

      await waitFor(() => {
        expect(getByText('J')).toBeTruthy();
      });
    });

    it('deve renderizar nome do usuário', async () => {
      const { getByText } = render(
        <CustomDrawerContent {...mockDrawerProps} />
      );

      await waitFor(() => {
        expect(getByText('João Silva')).toBeTruthy();
      });
    });

    it('deve renderizar email do usuário', async () => {
      const { getByText } = render(
        <CustomDrawerContent {...mockDrawerProps} />
      );

      await waitFor(() => {
        expect(getByText('motorista@test.com')).toBeTruthy();
      });
    });

    it('deve renderizar badge "Motorista"', async () => {
      const { getByText } = render(
        <CustomDrawerContent {...mockDrawerProps} />
      );

      await waitFor(() => {
        expect(getByText('Motorista')).toBeTruthy();
      });
    });

    it('deve renderizar botão "Sair da Conta"', async () => {
      const { getByText } = render(
        <CustomDrawerContent {...mockDrawerProps} />
      );

      await waitFor(() => {
        expect(getByText('Sair da Conta')).toBeTruthy();
      });
    });
  });

  describe('Loading State', () => {
    it('deve mostrar "Carregando..." enquanto não tem usuário', () => {
      mockGetSession.mockResolvedValue(null);

      const { getByText } = render(
        <CustomDrawerContent {...mockDrawerProps} />
      );

      expect(getByText('Carregando...')).toBeTruthy();
    });

    it('deve mostrar "?" no avatar quando não tem nome', () => {
      mockGetUsuario.mockResolvedValue({
        id: 'user-123',
        nome: null,
        email: 'test@test.com',
      });

      const { getByText } = render(
        <CustomDrawerContent {...mockDrawerProps} />
      );

      // Inicialmente mostra ?
      expect(getByText('?')).toBeTruthy();
    });

    it('deve chamar loadUsuario ao montar componente', async () => {
      render(<CustomDrawerContent {...mockDrawerProps} />);

      await waitFor(() => {
        expect(mockGetSession).toHaveBeenCalledTimes(1);
      });
    });

    it('deve chamar getUsuario com user.id da sessão', async () => {
      render(<CustomDrawerContent {...mockDrawerProps} />);

      await waitFor(() => {
        expect(mockGetUsuario).toHaveBeenCalledWith('user-123');
      });
    });
  });

  describe('Logout Flow', () => {
    it('deve mostrar ConfirmDialog ao clicar em "Sair da Conta"', async () => {
      const { getByText } = render(
        <CustomDrawerContent {...mockDrawerProps} />
      );

      await waitFor(() => {
        expect(getByText('Sair da Conta')).toBeTruthy();
      });

      fireEvent.press(getByText('Sair da Conta'));

      await waitFor(() => {
        expect(mockCloseDrawer).toHaveBeenCalledTimes(1);
      });

      // Wait for setTimeout(200ms)
      await waitFor(() => {
        expect(getByText('Sair da conta')).toBeTruthy();
      }, { timeout: 300 });
    });

    it('deve chamar signOut ao confirmar logout', async () => {
      mockSignOut.mockResolvedValue(undefined);

      const { getByText } = render(
        <CustomDrawerContent {...mockDrawerProps} />
      );

      await waitFor(() => {
        fireEvent.press(getByText('Sair da Conta'));
      });

      await waitFor(() => {
        expect(getByText('Sair da conta')).toBeTruthy();
      }, { timeout: 300 });

      fireEvent.press(getByText('Confirmar'));

      await waitFor(() => {
        expect(mockSignOut).toHaveBeenCalledTimes(1);
      });
    });

    it('deve redirecionar para /auth/login após logout bem-sucedido', async () => {
      mockSignOut.mockResolvedValue(undefined);

      const { getByText } = render(
        <CustomDrawerContent {...mockDrawerProps} />
      );

      await waitFor(() => {
        fireEvent.press(getByText('Sair da Conta'));
      });

      await waitFor(() => {
        fireEvent.press(getByText('Confirmar'));
      }, { timeout: 300 });

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/auth/login');
      });
    });

    it('deve fechar dialog ao cancelar logout', async () => {
      const { getByText, queryByText } = render(
        <CustomDrawerContent {...mockDrawerProps} />
      );

      await waitFor(() => {
        fireEvent.press(getByText('Sair da Conta'));
      });

      await waitFor(() => {
        expect(getByText('Sair da conta')).toBeTruthy();
      }, { timeout: 300 });

      fireEvent.press(getByText('Cancelar'));

      await waitFor(() => {
        expect(queryByText('Sair da conta')).toBeNull();
      });
    });

    it('deve mostrar dialog de erro se signOut falhar', async () => {
      mockSignOut.mockRejectedValue(new Error('Network error'));

      const { getByText } = render(
        <CustomDrawerContent {...mockDrawerProps} />
      );

      await waitFor(() => {
        fireEvent.press(getByText('Sair da Conta'));
      });

      await waitFor(() => {
        fireEvent.press(getByText('Confirmar'));
      }, { timeout: 300 });

      await waitFor(() => {
        expect(getByText('Erro ao sair')).toBeTruthy();
      });
    });
  });

  describe('Menu Items', () => {
    it('deve renderizar item "Meu Perfil"', async () => {
      const { getByText } = render(
        <CustomDrawerContent {...mockDrawerProps} />
      );

      await waitFor(() => {
        expect(getByText('Meu Perfil')).toBeTruthy();
      });
    });

    it('deve navegar para /motorista/perfil ao clicar em "Meu Perfil"', async () => {
      const { getByText } = render(
        <CustomDrawerContent {...mockDrawerProps} />
      );

      await waitFor(() => {
        fireEvent.press(getByText('Meu Perfil'));
      });

      expect(mockCloseDrawer).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith('/motorista/perfil');
    });

    it('deve renderizar item "Configurações"', async () => {
      const { getByText } = render(
        <CustomDrawerContent {...mockDrawerProps} />
      );

      await waitFor(() => {
        expect(getByText('Configurações')).toBeTruthy();
      });
    });

    it('deve renderizar item "Ajuda"', async () => {
      const { getByText } = render(
        <CustomDrawerContent {...mockDrawerProps} />
      );

      await waitFor(() => {
        expect(getByText('Ajuda')).toBeTruthy();
      });
    });
  });

  describe('Error Handling', () => {
    it('deve tratar erro ao carregar usuário', async () => {
      mockGetSession.mockRejectedValue(new Error('Auth error'));
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const { getByText } = render(
        <CustomDrawerContent {...mockDrawerProps} />
      );

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Erro ao carregar usuário no drawer:',
          expect.any(Error)
        );
      });

      // Deve mostrar estado de loading/erro
      expect(getByText('Carregando...')).toBeTruthy();

      consoleErrorSpy.mockRestore();
    });

    it('deve tratar erro ao fazer logout', async () => {
      mockSignOut.mockRejectedValue(new Error('Logout failed'));
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const { getByText } = render(
        <CustomDrawerContent {...mockDrawerProps} />
      );

      await waitFor(() => {
        fireEvent.press(getByText('Sair da Conta'));
      });

      await waitFor(() => {
        fireEvent.press(getByText('Confirmar'));
      }, { timeout: 300 });

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Erro ao fazer logout:',
          expect.any(Error)
        );
        expect(getByText('Erro ao sair')).toBeTruthy();
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('ScrollView Props', () => {
    it('deve desabilitar scroll quando dialog aberto', async () => {
      const { getByText, getByTestId } = render(
        <CustomDrawerContent {...mockDrawerProps} />
      );

      await waitFor(() => {
        fireEvent.press(getByText('Sair da Conta'));
      });

      await waitFor(() => {
        expect(getByText('Sair da conta')).toBeTruthy();
      }, { timeout: 300 });

      const scrollView = getByTestId('drawer-scroll-view');

      expect(scrollView.props.scrollEnabled).toBe(false);
      expect(scrollView.props.pointerEvents).toBe('none');
    });

    it('deve habilitar scroll quando dialog fechado', async () => {
      const { getByTestId } = render(
        <CustomDrawerContent {...mockDrawerProps} />
      );

      await waitFor(() => {
        const scrollView = getByTestId('drawer-scroll-view');
        expect(scrollView.props.scrollEnabled).toBe(true);
        expect(scrollView.props.pointerEvents).toBe('auto');
      });
    });
  });

  describe('Avatar com Diferentes Nomes', () => {
    it('deve mostrar inicial maiúscula do nome', async () => {
      mockGetUsuario.mockResolvedValue({
        nome: 'maria santos',
        email: 'maria@test.com',
      });

      const { getByText } = render(
        <CustomDrawerContent {...mockDrawerProps} />
      );

      await waitFor(() => {
        expect(getByText('M')).toBeTruthy();
      });
    });

    it('deve mostrar ? quando nome é vazio', async () => {
      mockGetUsuario.mockResolvedValue({
        nome: '',
        email: 'test@test.com',
      });

      const { getByText } = render(
        <CustomDrawerContent {...mockDrawerProps} />
      );

      await waitFor(() => {
        expect(getByText('?')).toBeTruthy();
      });
    });

    it('deve mostrar ? quando nome é null', async () => {
      mockGetUsuario.mockResolvedValue({
        nome: null,
        email: 'test@test.com',
      });

      const { getByText } = render(
        <CustomDrawerContent {...mockDrawerProps} />
      );

      await waitFor(() => {
        expect(getByText('?')).toBeTruthy();
      });
    });
  });

  describe('Props Passthrough', () => {
    it('deve passar props para DrawerContentScrollView', async () => {
      const { getByTestId } = render(
        <CustomDrawerContent {...mockDrawerProps} />
      );

      await waitFor(() => {
        const scrollView = getByTestId('drawer-scroll-view');
        expect(scrollView.props.bounces).toBe(false);
        expect(scrollView.props.overScrollMode).toBe('never');
        expect(scrollView.props.alwaysBounceVertical).toBe(false);
      });
    });
  });
});
