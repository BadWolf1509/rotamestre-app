import { render, fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';

import { DrawerMenu } from '../DrawerMenu';

// Mock expo-router
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockPathname = '/gestor/dashboard';

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
  usePathname: () => mockPathname,
}));

// Mock useUser hook - this is what DrawerMenu uses after decomposition
const mockUserData = {
  id: '123',
  nome: 'João Silva',
  email: 'joao@example.com',
  papel: 'usuario',
  is_gestor_principal: false,
};

const mockUnidade = { nome: 'Unidade Centro' };

jest.mock('@/hooks/useUser', () => ({
  useUser: jest.fn(() => ({
    userData: mockUserData,
    unidade: mockUnidade,
    loading: false,
    isGestor: false,
    isMotorista: false,
  })),
}));

// Mock supabase - still needed for logout
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signOut: jest.fn(),
    },
  },
  isSupabaseConfigured: true,
}));

describe('DrawerMenu Component', () => {
  const mockOnClose = jest.fn();
  const { supabase } = require('@/lib/supabase');
  const { useUser } = require('@/hooks/useUser');

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mock for useUser
    useUser.mockReturnValue({
      userData: {
        id: '123',
        nome: 'João Silva',
        email: 'joao@example.com',
        papel: 'usuario',
        is_gestor_principal: false,
      },
      unidade: { nome: 'Unidade Centro' },
      loading: false,
      isGestor: false,
      isMotorista: false,
    });

    supabase.auth.signOut.mockResolvedValue({ error: null });
  });

  describe('Renderização Básica', () => {
    it('deve renderizar quando visible=true', async () => {
      const { getByText } = render(
        <DrawerMenu visible={true} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(getByText('João Silva')).toBeTruthy();
      });
    });

    it('deve exibir email do usuário', async () => {
      const { getByText } = render(
        <DrawerMenu visible={true} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(getByText('joao@example.com')).toBeTruthy();
      });
    });

    it('deve exibir inicial do nome no avatar', async () => {
      const { getByText } = render(
        <DrawerMenu visible={true} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(getByText('J')).toBeTruthy();
      });
    });

    it('deve exibir nome da unidade', async () => {
      const { getByText } = render(
        <DrawerMenu visible={true} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(getByText('Unidade Centro')).toBeTruthy();
      });
    });
  });

  describe('Menu Items Básicos', () => {
    it('deve renderizar item Início', async () => {
      const { getByText } = render(
        <DrawerMenu visible={true} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(getByText('Início')).toBeTruthy();
        expect(getByText('🏠')).toBeTruthy();
      });
    });

    it('deve renderizar item Nova Rota', async () => {
      const { getByText } = render(
        <DrawerMenu visible={true} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(getByText('Nova Rota')).toBeTruthy();
        expect(getByText('📦')).toBeTruthy();
      });
    });

    it('deve renderizar item Gestão de Rotas', async () => {
      const { getByText } = render(
        <DrawerMenu visible={true} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(getByText('Gestão de Rotas')).toBeTruthy();
        expect(getByText('📋')).toBeTruthy();
      });
    });

    it('deve renderizar item Motoristas', async () => {
      const { getByText } = render(
        <DrawerMenu visible={true} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(getByText('Motoristas')).toBeTruthy();
        expect(getByText('🧑‍✈️')).toBeTruthy();
      });
    });

    it('deve renderizar item Meu Perfil', async () => {
      const { getByText } = render(
        <DrawerMenu visible={true} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(getByText('Meu Perfil')).toBeTruthy();
        expect(getByText('👤')).toBeTruthy();
      });
    });
  });

  describe('Menu Items para Gestor', () => {
    beforeEach(() => {
      useUser.mockReturnValue({
        userData: {
          id: '123',
          nome: 'Maria Gestora',
          email: 'maria@example.com',
          papel: 'gestor',
          is_gestor_principal: false,
        },
        unidade: { nome: 'Unidade Centro' },
        loading: false,
        isGestor: true,
        isMotorista: false,
      });
    });

    it('deve renderizar Minha Unidade para gestor', async () => {
      const { getByText } = render(
        <DrawerMenu visible={true} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(getByText('Minha Unidade')).toBeTruthy();
        expect(getByText('🏢')).toBeTruthy();
      });
    });

    it('deve renderizar Equipe para gestor', async () => {
      const { getByText } = render(
        <DrawerMenu visible={true} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(getByText('Equipe')).toBeTruthy();
      });
    });
  });

  describe('Badge Gestor Principal', () => {
    it('deve exibir badge quando is_gestor_principal=true', async () => {
      useUser.mockReturnValue({
        userData: {
          id: '123',
          nome: 'Carlos Principal',
          email: 'carlos@example.com',
          papel: 'gestor',
          is_gestor_principal: true,
        },
        unidade: { nome: 'Unidade Centro' },
        loading: false,
        isGestor: true,
        isMotorista: false,
      });

      const { getByText } = render(
        <DrawerMenu visible={true} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(getByText('⭐ Gestor Principal')).toBeTruthy();
      });
    });

    it('não deve exibir badge quando is_gestor_principal=false', async () => {
      const { queryByText } = render(
        <DrawerMenu visible={true} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(queryByText('⭐ Gestor Principal')).toBeNull();
      });
    });
  });

  describe('Navegação', () => {
    it('deve navegar ao clicar em Início', async () => {
      const { getByText } = render(
        <DrawerMenu visible={true} onClose={mockOnClose} />
      );

      await waitFor(() => {
        fireEvent.press(getByText('Início'));
      });

      expect(mockOnClose).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith('/gestor/inicio');
    });

    it('deve navegar ao clicar em Nova Rota', async () => {
      const { getByText } = render(
        <DrawerMenu visible={true} onClose={mockOnClose} />
      );

      await waitFor(() => {
        fireEvent.press(getByText('Nova Rota'));
      });

      expect(mockOnClose).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith('/gestor/nova-entrega');
    });

    it('deve navegar ao clicar em Meu Perfil', async () => {
      const { getByText } = render(
        <DrawerMenu visible={true} onClose={mockOnClose} />
      );

      await waitFor(() => {
        fireEvent.press(getByText('Meu Perfil'));
      });

      expect(mockOnClose).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith('/perfil');
    });
  });

  describe('Logout', () => {
    it('deve renderizar botão de logout', async () => {
      const { getByText } = render(
        <DrawerMenu visible={true} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(getByText('Sair')).toBeTruthy();
        expect(getByText('🚪')).toBeTruthy();
      });
    });

    it('deve fazer logout ao clicar no botão', async () => {
      const { supabase } = require('@/lib/supabase');

      const { getByText, getAllByText } = render(
        <DrawerMenu visible={true} onClose={mockOnClose} />
      );

      await waitFor(() => {
        fireEvent.press(getByText('Sair'));
      });

      // Clicar no botão de confirmação do dialog (o segundo "Sair")
      await waitFor(() => {
        const sairButtons = getAllByText('Sair');
        fireEvent.press(sairButtons[sairButtons.length - 1]);
      });

      await waitFor(() => {
        expect(supabase.auth.signOut).toHaveBeenCalled();
        expect(mockOnClose).toHaveBeenCalled();
        expect(mockReplace).toHaveBeenCalledWith('/auth/login');
      });
    });

    it('deve exibir dialog de erro quando logout falhar', async () => {
      const { supabase } = require('@/lib/supabase');
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      // Simular erro no signOut
      supabase.auth.signOut.mockRejectedValueOnce(new Error('Erro de rede'));

      const { getByText, getAllByText } = render(
        <DrawerMenu visible={true} onClose={mockOnClose} />
      );

      await waitFor(() => {
        fireEvent.press(getByText('Sair'));
      });

      // Clicar no botão de confirmação
      await waitFor(() => {
        const sairButtons = getAllByText('Sair');
        fireEvent.press(sairButtons[sairButtons.length - 1]);
      });

      // Aguardar erro ser processado
      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Erro ao fazer logout:',
          expect.any(Error)
        );
      });

      // Verificar que o dialog de erro apareceu
      await waitFor(() => {
        expect(getByText('Erro ao sair')).toBeTruthy();
        expect(getByText('Não foi possível encerrar sua sessão. Tente novamente.')).toBeTruthy();
      });

      // Fechar dialog de erro clicando em "Entendi"
      await waitFor(() => {
        fireEvent.press(getByText('Entendi'));
      });

      consoleErrorSpy.mockRestore();
    });

    it('deve fechar dialog de erro ao clicar em Fechar', async () => {
      const { supabase } = require('@/lib/supabase');
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      supabase.auth.signOut.mockRejectedValueOnce(new Error('Erro de rede'));

      const { getByText, getAllByText, queryByText: _queryByText } = render(
        <DrawerMenu visible={true} onClose={mockOnClose} />
      );

      await waitFor(() => {
        fireEvent.press(getByText('Sair'));
      });

      await waitFor(() => {
        const sairButtons = getAllByText('Sair');
        fireEvent.press(sairButtons[sairButtons.length - 1]);
      });

      await waitFor(() => {
        expect(getByText('Erro ao sair')).toBeTruthy();
      });

      // Fechar dialog clicando em "Fechar"
      await waitFor(() => {
        fireEvent.press(getByText('Fechar'));
      });

      consoleErrorSpy.mockRestore();
    });

    it('deve cancelar dialog de logout', async () => {
      const { supabase } = require('@/lib/supabase');

      const { getByText } = render(
        <DrawerMenu visible={true} onClose={mockOnClose} />
      );

      // Abrir dialog de logout
      await waitFor(() => {
        fireEvent.press(getByText('Sair'));
      });

      // Verificar que dialog apareceu
      await waitFor(() => {
        expect(getByText('Sair da conta')).toBeTruthy();
      });

      // Clicar em Cancelar
      await waitFor(() => {
        fireEvent.press(getByText('Cancelar'));
      });

      // Verificar que signOut NÃO foi chamado
      expect(supabase.auth.signOut).not.toHaveBeenCalled();
    });
  });

  describe('Visibilidade', () => {
    it('deve carregar perfil quando drawer fica visível', async () => {
      const { rerender, getByText } = render(
        <DrawerMenu visible={false} onClose={mockOnClose} />
      );

      rerender(<DrawerMenu visible={true} onClose={mockOnClose} />);

      // Verifica que o perfil foi carregado (nome aparece)
      await waitFor(() => {
        expect(getByText('João Silva')).toBeTruthy();
      });
    });
  });

  describe('Tratamento de Erro', () => {
    it('deve exibir ? quando não há nome', async () => {
      useUser.mockReturnValue({
        userData: {
          id: '123',
          email: 'teste@example.com',
          papel: 'usuario',
          is_gestor_principal: false,
          // nome is undefined
        },
        unidade: null,
        loading: false,
        isGestor: false,
        isMotorista: false,
      });

      const { getByText } = render(
        <DrawerMenu visible={true} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(getByText('?')).toBeTruthy();
      });
    });
  });

  describe('Fechamento do Drawer', () => {
    it('deve renderizar Modal com prop onRequestClose', async () => {
      const { root } = render(
        <DrawerMenu visible={true} onClose={mockOnClose} />
      );

      await waitFor(() => {
        const modal = root.findByType('Modal');
        expect(modal.props.onRequestClose).toBe(mockOnClose);
        expect(modal.props.visible).toBe(true);
      });
    });

    it('deve impedir propagação ao clicar dentro do drawer', async () => {
      const { UNSAFE_getAllByType, getByText } = render(
        <DrawerMenu visible={true} onClose={mockOnClose} />
      );

      await waitFor(() => {
        // Aguardar profile carregar
        expect(getByText('João Silva')).toBeTruthy();
      });

      const TouchableOpacity = require('react-native').TouchableOpacity;
      const touchables = UNSAFE_getAllByType(TouchableOpacity);

      // O drawer interno tem activeOpacity=1 e onPress com stopPropagation
      // É o segundo TouchableOpacity (primeiro é overlay)
      const drawerTouchable = touchables.find(
        (t, index) =>
          index > 0 &&
          t.props.activeOpacity === 1 &&
          typeof t.props.onPress === 'function'
      );

      expect(drawerTouchable).toBeTruthy();

      const mockEvent = {
        stopPropagation: jest.fn(),
      };
      drawerTouchable.props.onPress(mockEvent);

      expect(mockEvent.stopPropagation).toHaveBeenCalled();

      // Verificar que onClose NÃO foi chamado (stopPropagation funcionou)
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('deve fechar ao clicar no overlay (fora do drawer)', async () => {
      const { UNSAFE_getAllByType, getByText } = render(
        <DrawerMenu visible={true} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(getByText('João Silva')).toBeTruthy();
      });

      const TouchableOpacity = require('react-native').TouchableOpacity;
      const touchables = UNSAFE_getAllByType(TouchableOpacity);

      // O primeiro TouchableOpacity é o overlay
      const overlayTouchable = touchables[0];

      expect(overlayTouchable).toBeTruthy();
      expect(overlayTouchable.props.onPress).toBe(mockOnClose);

      // Clicar no overlay
      fireEvent.press(overlayTouchable);

      expect(mockOnClose).toHaveBeenCalled();
    });
  });
});
