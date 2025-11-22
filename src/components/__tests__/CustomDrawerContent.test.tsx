import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import React from 'react';

import { authService } from '@/lib/auth';

import { CustomDrawerContent } from '../CustomDrawerContent';


// Mock @/utils/styles para evitar problemas com Dimensions
const mockTheme = {
  colors: {
    primary: '#284093',
    primaryDark: '#1b2c63',
    white: '#ffffff',
    gray100: '#f3f4f6',
    gray200: '#e5e7eb',
    gray500: '#6b7280',
    gray700: '#374151',
    gray900: '#111827',
    error: '#ef4444',
    overlay: 'rgba(0, 0, 0, 0.5)',
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 },
  typography: { fontSans: 'System', fontSansSemiBold: 'System', fontSansBold: 'System', base: 16, sm: 14, lg: 18 },
  borderRadius: { sm: 8, md: 10, lg: 12, xl: 16, full: 9999 },
  shadows: { sm: {}, md: {}, lg: {} },
};

jest.mock('@/utils/styles', () => ({
  StyleSheet: {
    create: (styles: any) => {
      if (typeof styles === 'function') {
        return styles(mockTheme);
      }
      return styles;
    },
  },
  useUnistyles: () => ({ theme: mockTheme }),
  defaultTheme: mockTheme,
}));

// Mock @react-navigation/drawer BEFORE importing component
jest.mock('@react-navigation/drawer', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    DrawerContentScrollView: ({ children, ...props }: any) =>
      React.createElement(View, { ...props, testID: 'drawer-scroll-view' }, children),
    DrawerItemList: () => React.createElement(View, { testID: 'drawer-item-list' }, null),
    DrawerItem: ({ label, onPress, icon }: any) => {
      const { TouchableOpacity, Text, View } = require('react-native');
      return React.createElement(
        TouchableOpacity,
        { onPress, testID: `drawer-item-${label}` },
        [
          icon ? React.createElement(View, { key: 'icon' }, icon()) : null,
          React.createElement(Text, { key: 'label' }, label)
        ]
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

// Mock ConfirmDialog
jest.mock('../ConfirmDialog', () => ({
  ConfirmDialog: ({ visible, title, onConfirm, onCancel, confirmText, cancelText }: any) => {
    const React = require('react');
    const { View, Text, TouchableOpacity } = require('react-native');
    if (!visible) return null;
    return React.createElement(View, null, [
      React.createElement(Text, { key: 'title' }, title),
      React.createElement(TouchableOpacity, { key: 'confirm', onPress: onConfirm },
        React.createElement(Text, null, confirmText || 'Confirmar')
      ),
      React.createElement(TouchableOpacity, { key: 'cancel', onPress: onCancel },
        React.createElement(Text, null, cancelText || 'Cancelar')
      ),
    ]);
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
  let mockGetSession: jest.SpyInstance;
  let mockGetUsuario: jest.SpyInstance;
  let mockSignOut: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    mockGetSession = jest.spyOn(authService, 'getSession').mockResolvedValue({
      user: { id: 'user-123', email: 'motorista@test.com' },
    } as any);

    mockGetUsuario = jest.spyOn(authService, 'getUsuario').mockResolvedValue({
      id: 'user-123',
      nome: 'João Silva',
      email: 'motorista@test.com',
      papel: 'motorista',
    } as any);

    mockSignOut = jest.spyOn(authService, 'signOut').mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
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
      }, { timeout: 1000 });
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
      }, { timeout: 1000 });

      fireEvent.press(getByText('Sair'));

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

      await act(async () => {
        jest.runAllTimers();
      });

      await waitFor(() => {
        fireEvent.press(getByText('Sair'));
      }, { timeout: 1000 });

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
        expect(getByText('Sair')).toBeTruthy();
        expect(getByText('Cancelar')).toBeTruthy();
      }, { timeout: 1000 });

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

      await act(async () => {
        jest.runAllTimers();
      });

      await waitFor(() => {
        fireEvent.press(getByText('Sair'));
      }, { timeout: 1000 });

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

    it('deve fechar drawer e logar ao clicar em "Configurações"', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const { getByText } = render(
        <CustomDrawerContent {...mockDrawerProps} />
      );

      await waitFor(() => {
        fireEvent.press(getByText('Configurações'));
      });

      expect(mockCloseDrawer).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Configurações - Em desenvolvimento');
      consoleSpy.mockRestore();
    });

    it('deve fechar drawer e logar ao clicar em "Ajuda"', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const { getByText } = render(
        <CustomDrawerContent {...mockDrawerProps} />
      );

      await waitFor(() => {
        fireEvent.press(getByText('Ajuda'));
      });

      expect(mockCloseDrawer).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Ajuda - Em desenvolvimento');
      consoleSpy.mockRestore();
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });
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

      await act(async () => {
        jest.runAllTimers();
      });

      await waitFor(() => {
        fireEvent.press(getByText('Sair'));
      }, { timeout: 1000 });

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Erro ao fazer logout:',
          expect.any(Error)
        );
        expect(getByText('Erro ao sair')).toBeTruthy();
      });

      consoleErrorSpy.mockRestore();
    });

    it('deve fechar dialog de erro ao clicar em "Entendi"', async () => {
      mockSignOut.mockRejectedValue(new Error('Network error'));

      const { getByText, queryByText } = render(
        <CustomDrawerContent {...mockDrawerProps} />
      );

      await waitFor(() => {
        fireEvent.press(getByText('Sair da Conta'));
      });

      await waitFor(() => {
        fireEvent.press(getByText('Sair'));
      }, { timeout: 1000 });

      await waitFor(() => {
        expect(getByText('Erro ao sair')).toBeTruthy();
      });

      fireEvent.press(getByText('Entendi'));

      await waitFor(() => {
        expect(queryByText('Erro ao sair')).toBeNull();
      });
    });

    it('deve fechar dialog de erro ao clicar em "Fechar"', async () => {
      mockSignOut.mockRejectedValue(new Error('Network error'));

      const { getByText, queryByText } = render(
        <CustomDrawerContent {...mockDrawerProps} />
      );

      await waitFor(() => {
        fireEvent.press(getByText('Sair da Conta'));
      });

      await waitFor(() => {
        fireEvent.press(getByText('Sair'));
      }, { timeout: 1000 });

      await waitFor(() => {
        expect(getByText('Erro ao sair')).toBeTruthy();
      });

      fireEvent.press(getByText('Fechar'));

      await waitFor(() => {
        expect(queryByText('Erro ao sair')).toBeNull();
      });
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
      }, { timeout: 1000 });

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
