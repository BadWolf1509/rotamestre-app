import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import PerfilScreen from '../perfil/index';
import { supabase } from '@/lib/supabase';

// Usar global.mockAlert ao invés de importar Alert
const Alert = { alert: (global as any).mockAlert };

// Mock dos módulos
jest.mock('@/lib/supabase');
jest.mock('@/hooks/useProfile');

describe('PerfilScreen', () => {
  const mockUser = {
    id: '123',
    email: 'teste@email.com',
  };

  const mockProfile = {
    id: '123',
    nome: 'João Silva',
    email: 'teste@email.com',
    telefone: '(11) 98765-4321',
    papel: 'gestor',
    ultimo_login: '2025-01-01T10:00:00',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).mockAlert.mockClear();

    // Mock do Supabase getUser
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: mockUser },
    });

    // Mock do useProfile hook
    const useProfile = require('@/hooks/useProfile').useProfile;
    useProfile.mockReturnValue({
      profile: mockProfile,
      loading: false,
      updateProfile: jest.fn(),
    });
  });

  it('deve renderizar informações do perfil corretamente', async () => {
    const { getByText, getAllByText } = render(<PerfilScreen />);

    await waitFor(() => {
      expect(getByText('Meu Perfil')).toBeTruthy();
      expect(getAllByText('João Silva').length).toBeGreaterThan(0);
      expect(getByText('teste@email.com')).toBeTruthy();
      expect(getByText('(11) 98765-4321')).toBeTruthy();
    });
  });

  it('deve mostrar loading enquanto carrega', () => {
    const useProfile = require('@/hooks/useProfile').useProfile;
    useProfile.mockReturnValue({
      profile: null,
      loading: true,
      updateProfile: jest.fn(),
    });

    const { getByText } = render(<PerfilScreen />);
    expect(getByText('Carregando perfil...')).toBeTruthy();
  });

  it('deve entrar em modo de edição ao clicar em "Editar Perfil"', async () => {
    const { getByText, queryByText } = render(<PerfilScreen />);

    await waitFor(() => {
      expect(getByText('✏️ Editar Perfil')).toBeTruthy();
    });

    fireEvent.press(getByText('✏️ Editar Perfil'));

    await waitFor(() => {
      expect(getByText('Salvar Alterações')).toBeTruthy();
      expect(getByText('Cancelar')).toBeTruthy();
      expect(queryByText('✏️ Editar Perfil')).toBeNull();
    });
  });

  it('deve cancelar edição e restaurar valores', async () => {
    const { getByText, getByDisplayValue, getAllByText } = render(<PerfilScreen />);

    await waitFor(() => {
      fireEvent.press(getByText('✏️ Editar Perfil'));
    });

    // Alterar o nome
    const nomeInput = getByDisplayValue('João Silva');
    fireEvent.changeText(nomeInput, 'Novo Nome');

    // Cancelar
    fireEvent.press(getByText('Cancelar'));

    await waitFor(() => {
      expect(getAllByText('João Silva').length).toBeGreaterThan(0);
      expect(getByText('✏️ Editar Perfil')).toBeTruthy();
    });
  });

  it('deve entrar e sair do modo de edição', async () => {
    const { getByText } = render(<PerfilScreen />);

    await waitFor(() => {
      fireEvent.press(getByText('✏️ Editar Perfil'));
    });

    await waitFor(() => {
      expect(getByText('Salvar Alterações')).toBeTruthy();
    });

    fireEvent.press(getByText('Cancelar'));

    await waitFor(() => {
      expect(getByText('✏️ Editar Perfil')).toBeTruthy();
    });
  });

  it('deve confirmar antes de fazer logout', async () => {
    const { getByText } = render(<PerfilScreen />);

    await waitFor(() => {
      fireEvent.press(getByText('🚪 Sair da Conta'));
    });

    // Verifica que o Alert foi chamado (título pode variar)
    expect(Alert.alert).toHaveBeenCalled();
    const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
    expect(alertCall[1]).toContain('certeza');
  });

  it('deve navegar para tela de trocar senha', async () => {
    const mockRouter = require('expo-router').router;
    const { getByText } = render(<PerfilScreen />);

    await waitFor(() => {
      fireEvent.press(getByText('🔒 Trocar Senha'));
      expect(mockRouter.push).toHaveBeenCalledWith('/perfil/trocar-senha');
    });
  });
});
