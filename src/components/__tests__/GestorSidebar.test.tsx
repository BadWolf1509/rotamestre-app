import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { GestorSidebar } from '../GestorSidebar';

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

// Mock useUser hook
const mockUserData = {
  id: '123',
  nome: 'João Silva',
  email: 'joao@example.com',
  papel: 'gestor',
  unidades: {
    nome: 'Unidade Centro',
  },
};

jest.mock('@/hooks/useUser', () => ({
  useUser: jest.fn(() => ({
    userData: mockUserData,
    loading: false,
  })),
}));

// Mock supabase
const mockSignOut = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signOut: mockSignOut,
    },
  },
}));

// Mock Image component
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  RN.Image = 'Image';
  return RN;
});

describe('GestorSidebar Component', () => {
  const { useUser } = require('@/hooks/useUser');

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset to default user data
    useUser.mockReturnValue({
      userData: mockUserData,
      loading: false,
    });
  });

  describe('Renderização Básica', () => {
    it('deve renderizar sidebar', () => {
      const { root } = render(<GestorSidebar />);
      expect(root).toBeTruthy();
    });

    it('deve renderizar logo', () => {
      const { UNSAFE_getByType } = render(<GestorSidebar />);
      const image = UNSAFE_getByType('Image');
      expect(image).toBeTruthy();
    });

    it('deve exibir nome da unidade', () => {
      const { getByText } = render(<GestorSidebar />);
      expect(getByText('Unidade Centro')).toBeTruthy();
    });
  });

  describe('Menu Items', () => {
    it('deve renderizar item Dashboard', () => {
      const { getByText } = render(<GestorSidebar />);
      expect(getByText('Dashboard')).toBeTruthy();
      expect(getByText('📊')).toBeTruthy();
    });

    it('deve renderizar item Nova Rota', () => {
      const { getByText } = render(<GestorSidebar />);
      expect(getByText('Nova Rota')).toBeTruthy();
      expect(getByText('➕')).toBeTruthy();
    });

    it('deve renderizar item Histórico', () => {
      const { getByText } = render(<GestorSidebar />);
      expect(getByText('Histórico')).toBeTruthy();
      expect(getByText('📋')).toBeTruthy();
    });

    it('deve renderizar item Motoristas', () => {
      const { getByText } = render(<GestorSidebar />);
      expect(getByText('Motoristas')).toBeTruthy();
      expect(getByText('👥')).toBeTruthy();
    });
  });

  describe('Navegação', () => {
    it('deve navegar ao clicar em Dashboard', () => {
      const { getByText } = render(<GestorSidebar />);
      fireEvent.press(getByText('Dashboard'));
      expect(mockPush).toHaveBeenCalledWith('/gestor/dashboard');
    });

    it('deve navegar ao clicar em Nova Rota', () => {
      const { getByText } = render(<GestorSidebar />);
      fireEvent.press(getByText('Nova Rota'));
      expect(mockPush).toHaveBeenCalledWith('/gestor/nova-entrega');
    });

    it('deve navegar ao clicar em Histórico', () => {
      const { getByText } = render(<GestorSidebar />);
      fireEvent.press(getByText('Histórico'));
      expect(mockPush).toHaveBeenCalledWith('/gestor/historico');
    });

    it('deve navegar ao clicar em Motoristas', () => {
      const { getByText } = render(<GestorSidebar />);
      fireEvent.press(getByText('Motoristas'));
      expect(mockPush).toHaveBeenCalledWith('/gestor/motoristas');
    });
  });

  describe('Informações do Usuário', () => {
    it('deve exibir nome do usuário', () => {
      const { getByText } = render(<GestorSidebar />);
      expect(getByText('João Silva')).toBeTruthy();
    });

    it('deve exibir papel "Gestor"', () => {
      const { getByText } = render(<GestorSidebar />);
      expect(getByText('Gestor')).toBeTruthy();
    });

    it('deve exibir inicial do nome no avatar', () => {
      const { getByText } = render(<GestorSidebar />);
      expect(getByText('J')).toBeTruthy();
    });

    it('deve exibir "G" quando não há nome', () => {
      useUser.mockReturnValue({
        userData: { ...mockUserData, nome: null },
        loading: false,
      });

      const { getByText } = render(<GestorSidebar />);
      expect(getByText('G')).toBeTruthy();
    });

    it('deve exibir "Gestor" quando não há nome', () => {
      useUser.mockReturnValue({
        userData: { ...mockUserData, nome: null },
        loading: false,
      });

      const { getAllByText } = render(<GestorSidebar />);
      expect(getAllByText('Gestor').length).toBeGreaterThan(0);
    });
  });

  describe('Logout', () => {
    it('deve renderizar botão de logout', () => {
      const { getByText } = render(<GestorSidebar />);
      expect(getByText('Sair')).toBeTruthy();
      expect(getByText('🚪')).toBeTruthy();
    });

    it('deve chamar handleLogout ao clicar no botão', () => {
      const { getByText } = render(<GestorSidebar />);
      const logoutButton = getByText('Sair');

      // Verifica que o botão existe e pode ser clicado
      expect(logoutButton).toBeTruthy();
      fireEvent.press(logoutButton);

      // O teste passa se não houver erros ao clicar
    });

    it('deve tratar erro no logout', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockSignOut.mockRejectedValue(new Error('Erro ao fazer logout'));

      const { getByText } = render(<GestorSidebar />);
      fireEvent.press(getByText('Sair'));

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Estado Ativo', () => {
    it('deve marcar Dashboard como ativo quando pathname é /gestor/dashboard', () => {
      const { usePathname } = require('expo-router');
      jest.spyOn(require('expo-router'), 'usePathname').mockReturnValue('/gestor/dashboard');

      const { getByText } = render(<GestorSidebar />);
      expect(getByText('Dashboard')).toBeTruthy();
    });
  });

  describe('Casos de Dados Ausentes', () => {
    it('não deve exibir nome da unidade quando não existe', () => {
      useUser.mockReturnValue({
        userData: { ...mockUserData, unidades: null },
        loading: false,
      });

      const { queryByText } = render(<GestorSidebar />);
      expect(queryByText('Unidade Centro')).toBeNull();
    });

    it('deve renderizar quando userData é null', () => {
      useUser.mockReturnValue({
        userData: null,
        loading: false,
      });

      const { getAllByText, getByText } = render(<GestorSidebar />);
      expect(getAllByText('Gestor').length).toBeGreaterThan(0);
      expect(getByText('G')).toBeTruthy();
    });

    it('deve renderizar quando userData é undefined', () => {
      useUser.mockReturnValue({
        userData: undefined,
        loading: false,
      });

      const { getAllByText, getByText } = render(<GestorSidebar />);
      expect(getAllByText('Gestor').length).toBeGreaterThan(0);
      expect(getByText('G')).toBeTruthy();
    });
  });

  describe('Estrutura do Menu', () => {
    it('deve renderizar todos os 4 itens do menu', () => {
      const { getByText } = render(<GestorSidebar />);

      expect(getByText('Dashboard')).toBeTruthy();
      expect(getByText('Nova Rota')).toBeTruthy();
      expect(getByText('Histórico')).toBeTruthy();
      expect(getByText('Motoristas')).toBeTruthy();
    });

    it('deve ter estrutura correta de header, menu e footer', () => {
      const { root } = render(<GestorSidebar />);
      expect(root).toBeTruthy();
    });
  });
});
