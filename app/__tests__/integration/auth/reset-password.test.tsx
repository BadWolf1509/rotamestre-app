import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

import { authService } from '@/lib/auth';

import ResetPassword from '../../../auth/reset-password';

// TypeScript declaration for global mock
declare global {
  var mockUseAlert: {
    showAlert: jest.Mock;
    showSuccess: jest.Mock;
    showWarning: jest.Mock;
    showError: jest.Mock;
    showConfirm: jest.Mock;
    showDestructive: jest.Mock;
    hideAlert: jest.Mock;
    isVisible: boolean;
    AlertDialog: null;
  };
}

// Mock do expo-router já está configurado globalmente no jest.setup.js
const mockRouter = require('expo-router').useRouter();

// Mock do authService
jest.mock('@/lib/auth', () => ({
  authService: {
    updatePassword: jest.fn(),
    marcarPrimeiraSenhaConcluida: jest.fn(),
  },
}));

// Extend the global supabase mock (from jest.setup.js) with isRecoveryRedirect
// Don't re-mock — reuse the global mockSupabaseClient which has proper getSession etc.
const mockSupabaseModule = require('@/lib/supabase') as {
  isRecoveryRedirect: boolean;
  supabase: {
    auth: {
      getSession: jest.Mock;
      setSession: jest.Mock;
      onAuthStateChange: jest.Mock;
      exchangeCodeForSession?: jest.Mock;
      verifyOtp?: jest.Mock;
    };
  };
};
mockSupabaseModule.isRecoveryRedirect = false;

// Valid test password (meets all requirements: 8+ chars, uppercase, number, special)
const VALID_PASSWORD = 'NovaSenha@123';
const VALID_PASSWORD_ALT = 'OutraSenha@456';

describe('Reset Password Screen - Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabaseModule.isRecoveryRedirect = false;
    (authService.marcarPrimeiraSenhaConcluida as jest.Mock).mockResolvedValue(
      undefined,
    );

    // Ensure optional auth recovery mocks exist for tests that exercise retry logic.
    if (!mockSupabaseModule.supabase.auth.setSession) {
      (mockSupabaseModule.supabase.auth as Record<string, unknown>).setSession =
        jest.fn();
    }
    if (!mockSupabaseModule.supabase.auth.exchangeCodeForSession) {
      (
        mockSupabaseModule.supabase.auth as Record<string, unknown>
      ).exchangeCodeForSession = jest.fn();
    }
    if (!mockSupabaseModule.supabase.auth.verifyOtp) {
      (mockSupabaseModule.supabase.auth as Record<string, unknown>).verifyOtp =
        jest.fn();
    }

    mockSupabaseModule.supabase.auth.setSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    mockSupabaseModule.supabase.auth.exchangeCodeForSession.mockResolvedValue({
      data: { session: null, user: null },
      error: null,
    });
    mockSupabaseModule.supabase.auth.verifyOtp.mockResolvedValue({
      data: { session: null, user: null },
      error: null,
    });
  });

  // ============================================
  // GRUPO 1: Renderização e Elementos da UI
  // ============================================
  describe('Renderização e UI', () => {
    it('deve renderizar corretamente no mobile', () => {
      const { getByPlaceholderText, getByText } = render(<ResetPassword />);

      expect(getByPlaceholderText('Nova senha')).toBeTruthy();
      expect(getByPlaceholderText('Confirmar senha')).toBeTruthy();
      expect(getByText('Redefinir Senha')).toBeTruthy();
      expect(getByText('Voltar para login')).toBeTruthy();
      expect(getByText('Nova senha')).toBeTruthy();
    });

    it('deve exibir campos de senha vazios inicialmente', () => {
      const { getByPlaceholderText } = render(<ResetPassword />);

      const passwordInput = getByPlaceholderText('Nova senha');
      const confirmPasswordInput = getByPlaceholderText('Confirmar senha');

      expect(passwordInput.props.value).toBe('');
      expect(confirmPasswordInput.props.value).toBe('');
    });

    it('deve ter botão "Voltar para login" visível', () => {
      const { getByText } = render(<ResetPassword />);

      const backButton = getByText('Voltar para login');
      expect(backButton).toBeTruthy();
    });

    it('deve ter campos de senha com secureTextEntry', () => {
      const { getByPlaceholderText } = render(<ResetPassword />);

      const passwordInput = getByPlaceholderText('Nova senha');
      const confirmPasswordInput = getByPlaceholderText('Confirmar senha');

      expect(passwordInput.props.secureTextEntry).toBe(true);
      expect(confirmPasswordInput.props.secureTextEntry).toBe(true);
    });
  });

  // ============================================
  // GRUPO 2: Validação de Entrada
  // ============================================
  describe('Validação de Entrada', () => {
    it('deve atualizar o campo de senha ao digitar', () => {
      const { getByPlaceholderText } = render(<ResetPassword />);

      const passwordInput = getByPlaceholderText('Nova senha');
      fireEvent.changeText(passwordInput, VALID_PASSWORD);

      expect(passwordInput.props.value).toBe(VALID_PASSWORD);
    });

    it('deve atualizar o campo de confirmar senha ao digitar', () => {
      const { getByPlaceholderText } = render(<ResetPassword />);

      const confirmPasswordInput = getByPlaceholderText('Confirmar senha');
      fireEvent.changeText(confirmPasswordInput, VALID_PASSWORD);

      expect(confirmPasswordInput.props.value).toBe(VALID_PASSWORD);
    });

    it('deve exibir erro inline quando senha está vazia', async () => {
      const { getByText } = render(<ResetPassword />);

      fireEvent.press(getByText('Redefinir Senha'));

      await waitFor(() => {
        expect(getByText('Senha deve ter no mínimo 8 caracteres')).toBeTruthy();
      });
      expect(authService.updatePassword).not.toHaveBeenCalled();
    });

    it('deve exibir erro inline quando senha contém apenas espaços', async () => {
      const { getByPlaceholderText, getByText } = render(<ResetPassword />);

      fireEvent.changeText(getByPlaceholderText('Nova senha'), '   ');
      fireEvent.press(getByText('Redefinir Senha'));

      await waitFor(() => {
        expect(getByText('Senha deve ter no mínimo 8 caracteres')).toBeTruthy();
      });
      expect(authService.updatePassword).not.toHaveBeenCalled();
    });

    it('deve exibir erro inline quando senha tem menos de 8 caracteres', async () => {
      const { getByPlaceholderText, getByText } = render(<ResetPassword />);

      fireEvent.changeText(getByPlaceholderText('Nova senha'), 'Ab@1');
      fireEvent.press(getByText('Redefinir Senha'));

      await waitFor(() => {
        expect(getByText('Senha deve ter no mínimo 8 caracteres')).toBeTruthy();
      });
      expect(authService.updatePassword).not.toHaveBeenCalled();
    });

    it('deve exibir erro inline quando senha não tem letra maiúscula', async () => {
      const { getByPlaceholderText, getByText } = render(<ResetPassword />);

      fireEvent.changeText(getByPlaceholderText('Nova senha'), 'novasenha@123');
      fireEvent.press(getByText('Redefinir Senha'));

      await waitFor(() => {
        expect(
          getByText('Senha deve conter pelo menos uma letra maiúscula'),
        ).toBeTruthy();
      });
      expect(authService.updatePassword).not.toHaveBeenCalled();
    });

    it('deve exibir erro inline quando senha não tem número', async () => {
      const { getByPlaceholderText, getByText } = render(<ResetPassword />);

      fireEvent.changeText(getByPlaceholderText('Nova senha'), 'NovaSenha@abc');
      fireEvent.press(getByText('Redefinir Senha'));

      await waitFor(() => {
        expect(
          getByText('Senha deve conter pelo menos um número'),
        ).toBeTruthy();
      });
      expect(authService.updatePassword).not.toHaveBeenCalled();
    });

    it('deve exibir erro inline quando senha não tem caractere especial', async () => {
      const { getByPlaceholderText, getByText } = render(<ResetPassword />);

      fireEvent.changeText(getByPlaceholderText('Nova senha'), 'NovaSenha123');
      fireEvent.press(getByText('Redefinir Senha'));

      await waitFor(() => {
        expect(
          getByText(
            'Senha deve conter pelo menos um caractere especial (!@#$%...)',
          ),
        ).toBeTruthy();
      });
      expect(authService.updatePassword).not.toHaveBeenCalled();
    });

    it('deve exibir erro inline quando senhas não coincidem', async () => {
      const { getByPlaceholderText, getByText } = render(<ResetPassword />);

      fireEvent.changeText(getByPlaceholderText('Nova senha'), VALID_PASSWORD);
      fireEvent.changeText(
        getByPlaceholderText('Confirmar senha'),
        VALID_PASSWORD_ALT,
      );
      fireEvent.press(getByText('Redefinir Senha'));

      await waitFor(() => {
        expect(getByText('As senhas não coincidem')).toBeTruthy();
      });
      expect(authService.updatePassword).not.toHaveBeenCalled();
    });

    it('deve aceitar senha válida de exatamente 8 caracteres', async () => {
      (authService.updatePassword as jest.Mock).mockResolvedValue(undefined);

      const { getByPlaceholderText, getByText } = render(<ResetPassword />);

      const shortValid = 'Teste@1A';

      fireEvent.changeText(getByPlaceholderText('Nova senha'), shortValid);
      fireEvent.changeText(getByPlaceholderText('Confirmar senha'), shortValid);

      fireEvent.press(getByText('Redefinir Senha'));

      await waitFor(() => {
        expect(authService.updatePassword).toHaveBeenCalledWith(shortValid);
      });
    });
  });

  // ============================================
  // GRUPO 3: Atualização de Senha Bem-Sucedida
  // ============================================
  describe('Atualização de Senha Bem-Sucedida', () => {
    it('deve atualizar senha com sucesso', async () => {
      (authService.updatePassword as jest.Mock).mockResolvedValue(undefined);

      const { getByPlaceholderText, getByText } = render(<ResetPassword />);

      fireEvent.changeText(getByPlaceholderText('Nova senha'), VALID_PASSWORD);
      fireEvent.changeText(
        getByPlaceholderText('Confirmar senha'),
        VALID_PASSWORD,
      );

      fireEvent.press(getByText('Redefinir Senha'));

      await waitFor(() => {
        expect(authService.updatePassword).toHaveBeenCalledWith(VALID_PASSWORD);
        expect(global.mockUseAlert.showSuccess).toHaveBeenCalledWith(
          'Senha atualizada!',
          'Sua senha foi redefinida com sucesso.',
          expect.any(Function),
        );
      });
    });

    it('deve redirecionar para / (index) após confirmar sucesso', async () => {
      (authService.updatePassword as jest.Mock).mockResolvedValue(undefined);

      const { getByPlaceholderText, getByText } = render(<ResetPassword />);

      fireEvent.changeText(getByPlaceholderText('Nova senha'), VALID_PASSWORD);
      fireEvent.changeText(
        getByPlaceholderText('Confirmar senha'),
        VALID_PASSWORD,
      );

      fireEvent.press(getByText('Redefinir Senha'));

      await waitFor(() => {
        expect(global.mockUseAlert.showSuccess).toHaveBeenCalled();
      });

      // Simular callback de sucesso
      const successCall = global.mockUseAlert.showSuccess.mock.calls[0];
      const onDismissCallback = successCall[2];
      onDismissCallback();

      expect(mockRouter.replace).toHaveBeenCalledWith('/');
    });

    it('deve marcar primeira_senha como concluída após sucesso', async () => {
      (authService.updatePassword as jest.Mock).mockResolvedValue(undefined);

      const { getByPlaceholderText, getByText } = render(<ResetPassword />);

      fireEvent.changeText(getByPlaceholderText('Nova senha'), VALID_PASSWORD);
      fireEvent.changeText(
        getByPlaceholderText('Confirmar senha'),
        VALID_PASSWORD,
      );

      fireEvent.press(getByText('Redefinir Senha'));

      await waitFor(() => {
        expect(authService.marcarPrimeiraSenhaConcluida).toHaveBeenCalledTimes(
          1,
        );
        expect(global.mockUseAlert.showSuccess).toHaveBeenCalled();
      });
    });

    it('deve marcar primeira_senha como concluída no caminho de retry (sessão recuperada)', async () => {
      const originalLocation = window.location;
      Object.defineProperty(window, 'location', {
        value: {
          ...originalLocation,
          hash: '#access_token=valid-jwt&refresh_token=valid-refresh&type=recovery',
          search: '',
        },
        writable: true,
        configurable: true,
      });

      try {
        const sessionError = new Error('Auth session missing');
        (authService.updatePassword as jest.Mock)
          .mockRejectedValueOnce(sessionError)
          .mockResolvedValueOnce(undefined);

        mockSupabaseModule.supabase.auth.setSession.mockResolvedValue({
          data: { session: { access_token: 'valid-jwt' } },
          error: null,
        });

        const { getByPlaceholderText, getByText } = render(<ResetPassword />);
        fireEvent.changeText(
          getByPlaceholderText('Nova senha'),
          VALID_PASSWORD,
        );
        fireEvent.changeText(
          getByPlaceholderText('Confirmar senha'),
          VALID_PASSWORD,
        );
        fireEvent.press(getByText('Redefinir Senha'));

        await waitFor(() => {
          expect(authService.updatePassword).toHaveBeenCalledTimes(2);
          expect(
            authService.marcarPrimeiraSenhaConcluida,
          ).toHaveBeenCalledTimes(1);
          expect(global.mockUseAlert.showSuccess).toHaveBeenCalled();
        });
      } finally {
        Object.defineProperty(window, 'location', {
          value: originalLocation,
          writable: true,
          configurable: true,
        });
      }
    });

    it('não deve marcar primeira_senha quando a atualização falha', async () => {
      (authService.updatePassword as jest.Mock).mockRejectedValue(
        new Error('Erro inesperado'),
      );

      const { getByPlaceholderText, getByText } = render(<ResetPassword />);

      fireEvent.changeText(getByPlaceholderText('Nova senha'), VALID_PASSWORD);
      fireEvent.changeText(
        getByPlaceholderText('Confirmar senha'),
        VALID_PASSWORD,
      );

      fireEvent.press(getByText('Redefinir Senha'));

      await waitFor(() => {
        expect(global.mockUseAlert.showError).toHaveBeenCalled();
      });
      expect(authService.marcarPrimeiraSenhaConcluida).not.toHaveBeenCalled();
    });

    it('deve aceitar senhas longas (mais de 8 caracteres)', async () => {
      (authService.updatePassword as jest.Mock).mockResolvedValue(undefined);

      const { getByPlaceholderText, getByText } = render(<ResetPassword />);

      const longPassword = 'EstaeumaSenhaMuitoSegura123!@#';

      fireEvent.changeText(getByPlaceholderText('Nova senha'), longPassword);
      fireEvent.changeText(
        getByPlaceholderText('Confirmar senha'),
        longPassword,
      );

      fireEvent.press(getByText('Redefinir Senha'));

      await waitFor(() => {
        expect(authService.updatePassword).toHaveBeenCalledWith(longPassword);
      });
    });

    it('deve aceitar senhas com caracteres especiais', async () => {
      (authService.updatePassword as jest.Mock).mockResolvedValue(undefined);

      const { getByPlaceholderText, getByText } = render(<ResetPassword />);

      const specialPassword = 'Senha!@#123';

      fireEvent.changeText(getByPlaceholderText('Nova senha'), specialPassword);
      fireEvent.changeText(
        getByPlaceholderText('Confirmar senha'),
        specialPassword,
      );

      fireEvent.press(getByText('Redefinir Senha'));

      await waitFor(() => {
        expect(authService.updatePassword).toHaveBeenCalledWith(
          specialPassword,
        );
      });
    });
  });

  // ============================================
  // GRUPO 4: Tratamento de Erros
  // ============================================
  describe('Tratamento de Erros', () => {
    it('deve exibir erro quando atualização falha', async () => {
      const testError = new Error('Token de recuperação inválido ou expirado');
      (authService.updatePassword as jest.Mock).mockRejectedValue(testError);

      const { getByPlaceholderText, getByText } = render(<ResetPassword />);

      fireEvent.changeText(getByPlaceholderText('Nova senha'), VALID_PASSWORD);
      fireEvent.changeText(
        getByPlaceholderText('Confirmar senha'),
        VALID_PASSWORD,
      );

      fireEvent.press(getByText('Redefinir Senha'));

      await waitFor(() => {
        expect(global.mockUseAlert.showError).toHaveBeenCalledWith(testError);
      });
    });

    it('deve exibir erro genérico quando ocorre erro desconhecido', async () => {
      const testError = new Error();
      (authService.updatePassword as jest.Mock).mockRejectedValue(testError);

      const { getByPlaceholderText, getByText } = render(<ResetPassword />);

      fireEvent.changeText(getByPlaceholderText('Nova senha'), VALID_PASSWORD);
      fireEvent.changeText(
        getByPlaceholderText('Confirmar senha'),
        VALID_PASSWORD,
      );

      fireEvent.press(getByText('Redefinir Senha'));

      await waitFor(() => {
        expect(global.mockUseAlert.showError).toHaveBeenCalledWith(testError);
      });
    });

    it('não deve chamar authService quando validação falha', async () => {
      const { getByPlaceholderText, getByText } = render(<ResetPassword />);

      // Senhas válidas mas não coincidem
      fireEvent.changeText(getByPlaceholderText('Nova senha'), VALID_PASSWORD);
      fireEvent.changeText(
        getByPlaceholderText('Confirmar senha'),
        VALID_PASSWORD_ALT,
      );

      fireEvent.press(getByText('Redefinir Senha'));

      await waitFor(() => {
        expect(getByText('As senhas não coincidem')).toBeTruthy();
      });

      expect(authService.updatePassword).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // GRUPO 5: Estado de Loading
  // ============================================
  describe('Estado de Loading', () => {
    it('deve chamar serviço durante loading', async () => {
      (authService.updatePassword as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100)),
      );

      const { getByPlaceholderText, getByText } = render(<ResetPassword />);

      fireEvent.changeText(getByPlaceholderText('Nova senha'), VALID_PASSWORD);
      fireEvent.changeText(
        getByPlaceholderText('Confirmar senha'),
        VALID_PASSWORD,
      );

      fireEvent.press(getByText('Redefinir Senha'));

      await waitFor(() => {
        expect(authService.updatePassword).toHaveBeenCalledWith(VALID_PASSWORD);
      });
    });

    it('deve chamar authService ao atualizar senha', async () => {
      (authService.updatePassword as jest.Mock).mockResolvedValue(undefined);

      const { getByPlaceholderText, getByText } = render(<ResetPassword />);

      fireEvent.changeText(getByPlaceholderText('Nova senha'), VALID_PASSWORD);
      fireEvent.changeText(
        getByPlaceholderText('Confirmar senha'),
        VALID_PASSWORD,
      );

      fireEvent.press(getByText('Redefinir Senha'));

      await waitFor(() => {
        expect(authService.updatePassword).toHaveBeenCalledWith(VALID_PASSWORD);
        expect(global.mockUseAlert.showSuccess).toHaveBeenCalled();
      });
    });

    it('deve exibir Alert após tratamento de erro', async () => {
      const testError = new Error('Erro de teste');
      (authService.updatePassword as jest.Mock).mockRejectedValue(testError);

      const { getByPlaceholderText, getByText } = render(<ResetPassword />);

      fireEvent.changeText(getByPlaceholderText('Nova senha'), VALID_PASSWORD);
      fireEvent.changeText(
        getByPlaceholderText('Confirmar senha'),
        VALID_PASSWORD,
      );

      fireEvent.press(getByText('Redefinir Senha'));

      await waitFor(() => {
        expect(authService.updatePassword).toHaveBeenCalled();
        expect(global.mockUseAlert.showError).toHaveBeenCalledWith(testError);
      });
    });
  });

  // ============================================
  // GRUPO 6: Navegação
  // ============================================
  describe('Navegação', () => {
    it('deve navegar para login ao clicar em "Voltar para login"', () => {
      const { getByText } = render(<ResetPassword />);

      const backButton = getByText('Voltar para login');
      fireEvent.press(backButton);

      expect(mockRouter.replace).toHaveBeenCalledWith('/auth/login');
    });

    it('deve redirecionar para / após sucesso', async () => {
      (authService.updatePassword as jest.Mock).mockResolvedValue(undefined);

      const { getByPlaceholderText, getByText } = render(<ResetPassword />);

      fireEvent.changeText(getByPlaceholderText('Nova senha'), VALID_PASSWORD);
      fireEvent.changeText(
        getByPlaceholderText('Confirmar senha'),
        VALID_PASSWORD,
      );

      fireEvent.press(getByText('Redefinir Senha'));

      await waitFor(() => {
        expect(global.mockUseAlert.showSuccess).toHaveBeenCalledWith(
          'Senha atualizada!',
          'Sua senha foi redefinida com sucesso.',
          expect.any(Function),
        );
      });
    });

    it('não deve navegar quando atualização falha', async () => {
      const testError = new Error('Erro de teste');
      (authService.updatePassword as jest.Mock).mockRejectedValue(testError);

      const { getByPlaceholderText, getByText } = render(<ResetPassword />);

      fireEvent.changeText(getByPlaceholderText('Nova senha'), VALID_PASSWORD);
      fireEvent.changeText(
        getByPlaceholderText('Confirmar senha'),
        VALID_PASSWORD,
      );

      fireEvent.press(getByText('Redefinir Senha'));

      await waitFor(() => {
        expect(global.mockUseAlert.showError).toHaveBeenCalledWith(testError);
      });

      // Não deve ter chamado replace
      const replaceCalls = (mockRouter.replace as jest.Mock).mock.calls;
      expect(replaceCalls.length).toBe(0);
    });
  });

  // ============================================
  // GRUPO 7: Link Expirado / Sessão Ausente
  // ============================================
  describe('Link Expirado', () => {
    it('deve mostrar tela de link expirado quando AuthSessionMissingError ocorre', async () => {
      const sessionError = new Error('Auth session missing');
      (authService.updatePassword as jest.Mock).mockRejectedValue(sessionError);

      const { getByPlaceholderText, getByText, queryByText } = render(
        <ResetPassword />,
      );

      fireEvent.changeText(getByPlaceholderText('Nova senha'), VALID_PASSWORD);
      fireEvent.changeText(
        getByPlaceholderText('Confirmar senha'),
        VALID_PASSWORD,
      );

      fireEvent.press(getByText('Redefinir Senha'));

      await waitFor(() => {
        expect(getByText('Link expirado')).toBeTruthy();
        expect(getByText('Solicitar Novo Link')).toBeTruthy();
        expect(queryByText('Redefinir Senha')).toBeNull();
      });
    });

    it('deve mostrar tela de link expirado com AuthSessionMissingError (name-based)', async () => {
      const sessionError = new Error('Something went wrong');
      sessionError.name = 'AuthSessionMissingError';
      (authService.updatePassword as jest.Mock).mockRejectedValue(sessionError);

      const { getByPlaceholderText, getByText } = render(<ResetPassword />);

      fireEvent.changeText(getByPlaceholderText('Nova senha'), VALID_PASSWORD);
      fireEvent.changeText(
        getByPlaceholderText('Confirmar senha'),
        VALID_PASSWORD,
      );
      fireEvent.press(getByText('Redefinir Senha'));

      await waitFor(() => {
        expect(getByText('Link expirado')).toBeTruthy();
      });
    });

    it('deve navegar para forgot-password ao clicar em "Solicitar Novo Link"', async () => {
      const sessionError = new Error('Auth session missing');
      (authService.updatePassword as jest.Mock).mockRejectedValue(sessionError);

      const { getByPlaceholderText, getByText } = render(<ResetPassword />);

      fireEvent.changeText(getByPlaceholderText('Nova senha'), VALID_PASSWORD);
      fireEvent.changeText(
        getByPlaceholderText('Confirmar senha'),
        VALID_PASSWORD,
      );
      fireEvent.press(getByText('Redefinir Senha'));

      await waitFor(() => {
        expect(getByText('Solicitar Novo Link')).toBeTruthy();
      });

      fireEvent.press(getByText('Solicitar Novo Link'));
      expect(mockRouter.replace).toHaveBeenCalledWith('/auth/forgot-password');
    });

    it('não deve chamar showError para AuthSessionMissingError', async () => {
      const sessionError = new Error('Auth session missing');
      (authService.updatePassword as jest.Mock).mockRejectedValue(sessionError);

      const { getByPlaceholderText, getByText } = render(<ResetPassword />);

      fireEvent.changeText(getByPlaceholderText('Nova senha'), VALID_PASSWORD);
      fireEvent.changeText(
        getByPlaceholderText('Confirmar senha'),
        VALID_PASSWORD,
      );
      fireEvent.press(getByText('Redefinir Senha'));

      await waitFor(() => {
        expect(getByText('Link expirado')).toBeTruthy();
      });

      expect(global.mockUseAlert.showError).not.toHaveBeenCalled();
    });

    it('deve tentar recuperar sessão do hash e repetir atualização antes de expirar', async () => {
      const originalLocation = window.location;
      Object.defineProperty(window, 'location', {
        value: {
          ...originalLocation,
          hash: '#access_token=valid-jwt&refresh_token=valid-refresh&type=recovery',
          search: '',
        },
        writable: true,
        configurable: true,
      });

      try {
        const sessionError = new Error('Auth session missing');
        (authService.updatePassword as jest.Mock)
          .mockRejectedValueOnce(sessionError)
          .mockResolvedValueOnce(undefined);

        mockSupabaseModule.supabase.auth.setSession.mockResolvedValue({
          data: { session: { access_token: 'valid-jwt' } },
          error: null,
        });

        const { getByPlaceholderText, getByText } = render(<ResetPassword />);
        fireEvent.changeText(
          getByPlaceholderText('Nova senha'),
          VALID_PASSWORD,
        );
        fireEvent.changeText(
          getByPlaceholderText('Confirmar senha'),
          VALID_PASSWORD,
        );
        fireEvent.press(getByText('Redefinir Senha'));

        await waitFor(() => {
          expect(
            mockSupabaseModule.supabase.auth.setSession,
          ).toHaveBeenCalledWith({
            access_token: 'valid-jwt',
            refresh_token: 'valid-refresh',
          });
          expect(authService.updatePassword).toHaveBeenCalledTimes(2);
          expect(global.mockUseAlert.showSuccess).toHaveBeenCalled();
        });
      } finally {
        Object.defineProperty(window, 'location', {
          value: originalLocation,
          writable: true,
          configurable: true,
        });
      }
    });

    it('deve tentar recuperar sessão por PKCE code e repetir atualização', async () => {
      const originalLocation = window.location;
      Object.defineProperty(window, 'location', {
        value: {
          ...originalLocation,
          hash: '',
          search: '?code=pkce-code&type=recovery',
        },
        writable: true,
        configurable: true,
      });

      try {
        const sessionError = new Error('Auth session missing');
        (authService.updatePassword as jest.Mock)
          .mockRejectedValueOnce(sessionError)
          .mockResolvedValueOnce(undefined);

        mockSupabaseModule.supabase.auth.exchangeCodeForSession.mockResolvedValue(
          {
            data: {
              session: { access_token: 'from-pkce' },
              user: { id: 'user-1' },
            },
            error: null,
          },
        );

        const { getByPlaceholderText, getByText } = render(<ResetPassword />);
        fireEvent.changeText(
          getByPlaceholderText('Nova senha'),
          VALID_PASSWORD,
        );
        fireEvent.changeText(
          getByPlaceholderText('Confirmar senha'),
          VALID_PASSWORD,
        );
        fireEvent.press(getByText('Redefinir Senha'));

        await waitFor(() => {
          expect(
            mockSupabaseModule.supabase.auth.exchangeCodeForSession,
          ).toHaveBeenCalledWith('pkce-code');
          expect(authService.updatePassword).toHaveBeenCalledTimes(2);
          expect(global.mockUseAlert.showSuccess).toHaveBeenCalled();
        });
      } finally {
        Object.defineProperty(window, 'location', {
          value: originalLocation,
          writable: true,
          configurable: true,
        });
      }
    });
  });

  // ============================================
  // GRUPO 8: Casos de Borda
  // ============================================
  describe('Casos de Borda', () => {
    it('deve permitir múltiplas tentativas de atualização após erro', async () => {
      const firstError = new Error('Erro temporário');
      (authService.updatePassword as jest.Mock)
        .mockRejectedValueOnce(firstError)
        .mockResolvedValueOnce(undefined);

      const { getByPlaceholderText, getByText } = render(<ResetPassword />);

      fireEvent.changeText(getByPlaceholderText('Nova senha'), VALID_PASSWORD);
      fireEvent.changeText(
        getByPlaceholderText('Confirmar senha'),
        VALID_PASSWORD,
      );
      let submitButton = getByText('Redefinir Senha');

      // Primeira tentativa - erro
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(global.mockUseAlert.showError).toHaveBeenCalledWith(firstError);
        expect(authService.updatePassword).toHaveBeenCalledTimes(1);
      });

      // Aguardar componente processar o erro e limpar loading
      await waitFor(() => {
        submitButton = getByText('Redefinir Senha');
        expect(submitButton).toBeTruthy();
      });

      // Segunda tentativa - sucesso
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(authService.updatePassword).toHaveBeenCalledTimes(2);
      });
    });

    it('deve validar em ordem: vazio -> complexidade -> confirmação', async () => {
      const { getByPlaceholderText, getByText } = render(<ResetPassword />);

      const passwordInput = getByPlaceholderText('Nova senha');
      const confirmPasswordInput = getByPlaceholderText('Confirmar senha');
      const submitButton = getByText('Redefinir Senha');

      // Fase 1: Campo vazio → erro de tamanho mínimo
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(getByText('Senha deve ter no mínimo 8 caracteres')).toBeTruthy();
      });

      // Fase 2: Senha sem maiúscula → reValida onChange
      fireEvent.changeText(passwordInput, 'senhafraca');
      fireEvent.changeText(confirmPasswordInput, 'senhafraca');

      await waitFor(() => {
        expect(
          getByText('Senha deve conter pelo menos uma letra maiúscula'),
        ).toBeTruthy();
      });

      // Fase 3: Senhas válidas mas não coincidem
      fireEvent.changeText(passwordInput, VALID_PASSWORD);
      fireEvent.changeText(confirmPasswordInput, VALID_PASSWORD_ALT);

      await waitFor(() => {
        expect(getByText('As senhas não coincidem')).toBeTruthy();
      });

      expect(authService.updatePassword).not.toHaveBeenCalled();
    });

    it('deve considerar case-sensitive na confirmação de senha', async () => {
      const { getByPlaceholderText, getByText } = render(<ResetPassword />);

      // Senhas diferem apenas no case (ambas válidas individualmente)
      fireEvent.changeText(getByPlaceholderText('Nova senha'), 'NovaSenha@123');
      fireEvent.changeText(
        getByPlaceholderText('Confirmar senha'),
        'Novasenha@123',
      );

      fireEvent.press(getByText('Redefinir Senha'));

      await waitFor(() => {
        expect(getByText('As senhas não coincidem')).toBeTruthy();
      });
    });
  });

  // ============================================
  // GRUPO 9: Novos Elementos de UI (Strength, Mismatch, Requirements)
  // ============================================
  describe('Novos Elementos de UI', () => {
    it('deve mostrar PasswordStrengthIndicator ao digitar senha', () => {
      const { getByPlaceholderText, getByText, queryByText } = render(
        <ResetPassword />,
      );

      // Initially no indicator (empty password → returns null)
      expect(queryByText(/Força:/)).toBeNull();

      // Type a password → indicator appears
      fireEvent.changeText(getByPlaceholderText('Nova senha'), 'abc');
      expect(getByText(/Força:/)).toBeTruthy();
    });

    it('deve mostrar "As senhas não coincidem" no submit quando confirmação diverge', async () => {
      const { getByPlaceholderText, getByText } = render(<ResetPassword />);

      fireEvent.changeText(getByPlaceholderText('Nova senha'), VALID_PASSWORD);
      fireEvent.changeText(getByPlaceholderText('Confirmar senha'), 'outra');
      fireEvent.press(getByText('Redefinir Senha'));

      await waitFor(() => {
        expect(getByText('As senhas não coincidem')).toBeTruthy();
      });
    });

    it('deve esconder mismatch ao corrigir a confirmação (reValida onChange)', async () => {
      const { getByPlaceholderText, getByText, queryByText } = render(
        <ResetPassword />,
      );

      fireEvent.changeText(getByPlaceholderText('Nova senha'), VALID_PASSWORD);
      fireEvent.changeText(getByPlaceholderText('Confirmar senha'), 'outra');
      fireEvent.press(getByText('Redefinir Senha'));

      await waitFor(() => {
        expect(queryByText('As senhas não coincidem')).toBeTruthy();
      });

      // Corrige a confirmação → reValidateMode onChange limpa o erro.
      // Timeout generoso: a revalidação async do zodResolver pode passar de 3s
      // sob a carga da suíte completa (workers paralelos disputando CPU).
      fireEvent.changeText(
        getByPlaceholderText('Confirmar senha'),
        VALID_PASSWORD,
      );

      await waitFor(
        () => {
          expect(queryByText('As senhas não coincidem')).toBeNull();
        },
        { timeout: 6000 },
      );
    });

    it('deve mostrar box de requisitos de segurança', () => {
      const { getByText } = render(<ResetPassword />);

      expect(getByText('Requisitos de segurança:')).toBeTruthy();
      expect(getByText(/Mínimo de 8 caracteres/)).toBeTruthy();
      expect(getByText(/letra maiúscula/)).toBeTruthy();
      expect(getByText(/1 número/)).toBeTruthy();
      expect(getByText(/caractere especial/)).toBeTruthy();
    });
  });

  // ============================================
  // GRUPO 10: Verificação Proativa de Sessão (onAuthStateChange)
  // ============================================
  describe('Verificação Proativa de Sessão', () => {
    const originalPlatformOS = jest.requireActual('react-native').Platform.OS;
    const originalLocation = window.location;

    beforeEach(() => {
      // Enable recovery redirect for these tests
      mockSupabaseModule.isRecoveryRedirect = true;

      // Ensure setSession is available (clearAllMocks may clear it)
      if (!mockSupabaseModule.supabase.auth.setSession) {
        (
          mockSupabaseModule.supabase.auth as Record<string, unknown>
        ).setSession = jest.fn();
      }

      // Ensure Platform.OS is 'web' and window.location.hash is available
      jest.replaceProperty(require('react-native').Platform, 'OS', 'web');
      Object.defineProperty(window, 'location', {
        value: { ...originalLocation, hash: '' },
        writable: true,
        configurable: true,
      });
    });

    afterEach(() => {
      mockSupabaseModule.isRecoveryRedirect = false;
      jest.replaceProperty(
        require('react-native').Platform,
        'OS',
        originalPlatformOS,
      );
      Object.defineProperty(window, 'location', {
        value: originalLocation,
        writable: true,
        configurable: true,
      });
    });

    it('deve mostrar loading enquanto verifica sessão', () => {
      // onAuthStateChange never calls the callback during this test
      mockSupabaseModule.supabase.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      });

      const { getByText } = render(<ResetPassword />);

      expect(getByText('Verificando link de recuperação...')).toBeTruthy();
    });

    it('deve mostrar formulário quando PASSWORD_RECOVERY é emitido', async () => {
      mockSupabaseModule.supabase.auth.onAuthStateChange.mockImplementation(
        (callback: (event: string, session: unknown) => void) => {
          // Simulate SDK firing PASSWORD_RECOVERY after processing URL hash
          setTimeout(
            () =>
              callback('PASSWORD_RECOVERY', { access_token: 'valid-token' }),
            0,
          );
          return { data: { subscription: { unsubscribe: jest.fn() } } };
        },
      );

      const { getByText, queryByText } = render(<ResetPassword />);

      await waitFor(() => {
        expect(getByText('Redefinir Senha')).toBeTruthy();
        expect(queryByText('Link expirado')).toBeNull();
        expect(queryByText('Verificando link de recuperação...')).toBeNull();
      });
    });

    it('deve mostrar formulário quando INITIAL_SESSION tem sessão', async () => {
      mockSupabaseModule.supabase.auth.onAuthStateChange.mockImplementation(
        (callback: (event: string, session: unknown) => void) => {
          setTimeout(
            () => callback('INITIAL_SESSION', { access_token: 'valid-token' }),
            0,
          );
          return { data: { subscription: { unsubscribe: jest.fn() } } };
        },
      );

      const { getByText, queryByText } = render(<ResetPassword />);

      await waitFor(() => {
        expect(getByText('Redefinir Senha')).toBeTruthy();
        expect(queryByText('Link expirado')).toBeNull();
      });
    });

    it('deve mostrar "Link expirado" quando INITIAL_SESSION sem sessão e hash vazio', async () => {
      // Hash is empty (no tokens to recover manually)
      mockSupabaseModule.supabase.auth.onAuthStateChange.mockImplementation(
        (callback: (event: string, session: unknown) => void) => {
          setTimeout(() => callback('INITIAL_SESSION', null), 0);
          return { data: { subscription: { unsubscribe: jest.fn() } } };
        },
      );

      const { getByText, queryByText } = render(<ResetPassword />);

      await waitFor(() => {
        expect(getByText('Link expirado')).toBeTruthy();
        expect(queryByText('Redefinir Senha')).toBeNull();
      });
    });

    it('deve recuperar sessão manualmente quando SDK falha mas hash tem tokens', async () => {
      // Simulate: hash has tokens but SDK returned null session
      Object.defineProperty(window, 'location', {
        value: {
          ...originalLocation,
          hash: '#access_token=valid-jwt&refresh_token=valid-refresh&type=recovery',
        },
        writable: true,
        configurable: true,
      });

      mockSupabaseModule.supabase.auth.onAuthStateChange.mockImplementation(
        (callback: (event: string, session: unknown) => void) => {
          setTimeout(() => callback('INITIAL_SESSION', null), 0);
          return { data: { subscription: { unsubscribe: jest.fn() } } };
        },
      );

      // Manual setSession succeeds
      mockSupabaseModule.supabase.auth.setSession.mockResolvedValue({
        data: { session: { access_token: 'valid-jwt' } },
        error: null,
      });

      const { getByText, queryByText } = render(<ResetPassword />);

      await waitFor(() => {
        expect(
          mockSupabaseModule.supabase.auth.setSession,
        ).toHaveBeenCalledWith({
          access_token: 'valid-jwt',
          refresh_token: 'valid-refresh',
        });
        expect(getByText('Redefinir Senha')).toBeTruthy();
        expect(queryByText('Link expirado')).toBeNull();
      });
    });
  });
});
