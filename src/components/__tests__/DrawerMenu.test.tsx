import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
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

// Mock supabase
const mockGetUser = jest.fn();
const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockSingle = jest.fn();
const mockSignOut = jest.fn();
const mockFrom = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
      signOut: jest.fn(),
    },
    from: jest.fn(),
  },
}));

describe('DrawerMenu Component', () => {
  const mockOnClose = jest.fn();
  const { supabase } = require('@/lib/supabase');

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mocks
    const mockUserData = {
      data: { user: { id: '123' } },
      error: null,
    };

    const mockProfileData = {
      data: {
        id: '123',
        nome: 'João Silva',
        email: 'joao@example.com',
        papel: 'usuario',
        is_gestor_principal: false,
        unidades: { nome: 'Unidade Centro' },
      },
      error: null,
    };

    mockSingle.mockResolvedValue(mockProfileData);
    mockEq.mockReturnValue({ single: mockSingle });
    mockSelect.mockReturnValue({ eq: mockEq });

    supabase.auth.getUser.mockResolvedValue(mockUserData);
    supabase.from.mockReturnValue({ select: mockSelect });
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
    it('deve renderizar item Dashboard', async () => {
      const { getByText } = render(
        <DrawerMenu visible={true} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(getByText('Dashboard')).toBeTruthy();
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

    it('deve renderizar item Histórico', async () => {
      const { getByText } = render(
        <DrawerMenu visible={true} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(getByText('Histórico')).toBeTruthy();
        expect(getByText('📋')).toBeTruthy();
      });
    });

    it('deve renderizar item Motoristas', async () => {
      const { getByText } = render(
        <DrawerMenu visible={true} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(getByText('Motoristas')).toBeTruthy();
        expect(getByText('👥')).toBeTruthy();
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
      const { supabase } = require('@/lib/supabase');

      mockSingle.mockResolvedValue({
        data: {
          id: '123',
          nome: 'Maria Gestora',
          email: 'maria@example.com',
          papel: 'gestor',
          is_gestor_principal: false,
          unidades: { nome: 'Unidade Centro' },
        },
        error: null,
      });

      mockEq.mockReturnValue({ single: mockSingle });
      mockSelect.mockReturnValue({ eq: mockEq });
      supabase.from.mockReturnValue({ select: mockSelect });
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
      const { supabase } = require('@/lib/supabase');

      mockSingle.mockResolvedValue({
        data: {
          id: '123',
          nome: 'Carlos Principal',
          email: 'carlos@example.com',
          papel: 'gestor',
          is_gestor_principal: true,
          unidades: { nome: 'Unidade Centro' },
        },
        error: null,
      });

      mockEq.mockReturnValue({ single: mockSingle });
      mockSelect.mockReturnValue({ eq: mockEq });
      supabase.from.mockReturnValue({ select: mockSelect });

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
    it('deve navegar ao clicar em Dashboard', async () => {
      const { getByText } = render(
        <DrawerMenu visible={true} onClose={mockOnClose} />
      );

      await waitFor(() => {
        fireEvent.press(getByText('Dashboard'));
      });

      expect(mockOnClose).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith('/gestor/dashboard');
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
        expect(getByText('Sair da Conta')).toBeTruthy();
        expect(getByText('🚪')).toBeTruthy();
      });
    });

    it('deve fazer logout ao clicar no botão', async () => {
      const { supabase } = require('@/lib/supabase');

      const { getByText } = render(
        <DrawerMenu visible={true} onClose={mockOnClose} />
      );

      await waitFor(() => {
        fireEvent.press(getByText('Sair da Conta'));
      });

      await waitFor(() => {
        expect(supabase.auth.signOut).toHaveBeenCalled();
        expect(mockOnClose).toHaveBeenCalled();
        expect(mockReplace).toHaveBeenCalledWith('/auth/login');
      });
    });
  });

  describe('Visibilidade', () => {
    it('deve carregar perfil quando drawer fica visível', async () => {
      const { supabase } = require('@/lib/supabase');

      const { rerender } = render(
        <DrawerMenu visible={false} onClose={mockOnClose} />
      );

      // Limpa chamadas anteriores
      supabase.auth.getUser.mockClear();

      rerender(<DrawerMenu visible={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(supabase.auth.getUser).toHaveBeenCalled();
      });
    });
  });

  describe('Tratamento de Erro', () => {
    it('deve exibir ? quando não há nome', async () => {
      const { supabase } = require('@/lib/supabase');

      mockSingle.mockResolvedValue({
        data: {
          id: '123',
          email: 'teste@example.com',
          papel: 'usuario',
          is_gestor_principal: false,
        },
        error: null,
      });

      mockEq.mockReturnValue({ single: mockSingle });
      mockSelect.mockReturnValue({ eq: mockEq });
      supabase.from.mockReturnValue({ select: mockSelect });

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
  });
});
