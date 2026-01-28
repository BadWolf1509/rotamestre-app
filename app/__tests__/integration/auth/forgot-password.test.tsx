import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

import { authService } from '@/lib/auth';
import { passwordResetRateLimiter } from '@/lib/rateLimiter';

import ForgotPassword from '../../../auth/forgot-password';

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
    resetPassword: jest.fn(),
  },
}));

// Mock do rateLimiter
jest.mock('@/lib/rateLimiter', () => ({
  passwordResetRateLimiter: {
    checkLimit: jest.fn(),
    recordAttempt: jest.fn(),
  },
}));

describe('Forgot Password Screen - Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Por padrão, permite requisições (rate limit não atingido)
    (passwordResetRateLimiter.checkLimit as jest.Mock).mockResolvedValue({
      allowed: true,
      remainingAttempts: 3,
      retryAfterMs: null,
      message: null,
    });
    (passwordResetRateLimiter.recordAttempt as jest.Mock).mockResolvedValue(undefined);
  });

  // ============================================
  // GRUPO 1: Renderização e Elementos da UI
  // ============================================
  describe('Renderização e UI', () => {
    it('deve renderizar corretamente no mobile', () => {
      const { getByPlaceholderText, getByText } = render(<ForgotPassword />);

      expect(getByPlaceholderText('E-mail')).toBeTruthy();
      expect(getByText('Enviar Link')).toBeTruthy();
      expect(getByText('Voltar para login')).toBeTruthy();
      expect(getByText('Recuperar senha')).toBeTruthy();
    });

    it('deve exibir campo de email vazio inicialmente', () => {
      const { getByPlaceholderText } = render(<ForgotPassword />);

      const emailInput = getByPlaceholderText('E-mail');
      expect(emailInput.props.value).toBe('');
    });

    it('deve ter botão "Voltar para login" visível', () => {
      const { getByText } = render(<ForgotPassword />);

      const backButton = getByText('Voltar para login');
      expect(backButton).toBeTruthy();
    });
  });

  // ============================================
  // GRUPO 2: Validação de Entrada
  // ============================================
  describe('Validação de Entrada', () => {
    it('deve atualizar o campo de email ao digitar', () => {
      const { getByPlaceholderText } = render(<ForgotPassword />);

      const emailInput = getByPlaceholderText('E-mail');
      fireEvent.changeText(emailInput, 'teste@rotamestre.com');

      expect(emailInput.props.value).toBe('teste@rotamestre.com');
    });

    it('deve exibir erro quando email está vazio', async () => {
      const { getByText } = render(<ForgotPassword />);

      const submitButton = getByText('Enviar Link');
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(global.mockUseAlert.showWarning).toHaveBeenCalledWith('Erro', 'Digite seu e-mail');
      });
    });

    it('deve exibir erro quando email contém apenas espaços', async () => {
      const { getByPlaceholderText, getByText } = render(<ForgotPassword />);

      const emailInput = getByPlaceholderText('E-mail');
      fireEvent.changeText(emailInput, '   ');

      const submitButton = getByText('Enviar Link');
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(global.mockUseAlert.showWarning).toHaveBeenCalledWith('Erro', 'Digite seu e-mail');
      });
    });
  });

  // ============================================
  // GRUPO 3: Envio de Email Bem-Sucedido
  // ============================================
  describe('Envio de Email Bem-Sucedido', () => {
    it('deve enviar email de recuperação com sucesso', async () => {
      (authService.resetPassword as jest.Mock).mockResolvedValue(undefined);

      const { getByPlaceholderText, getByText } = render(<ForgotPassword />);

      const emailInput = getByPlaceholderText('E-mail');
      fireEvent.changeText(emailInput, 'Usuario@rotamestre.com');

      const submitButton = getByText('Enviar Link');
      fireEvent.press(submitButton);

      await waitFor(() => {
        // Email é convertido para lowercase
        expect(authService.resetPassword).toHaveBeenCalledWith(
          'usuario@rotamestre.com'
        );
        expect(global.mockUseAlert.showSuccess).toHaveBeenCalledWith(
          'Email enviado!',
          'Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.',
          expect.any(Function)
        );
      });
    });

    it('deve voltar para tela anterior após confirmar sucesso', async () => {
      (authService.resetPassword as jest.Mock).mockResolvedValue(undefined);

      const { getByPlaceholderText, getByText } = render(<ForgotPassword />);

      const emailInput = getByPlaceholderText('E-mail');
      fireEvent.changeText(emailInput, 'usuario@rotamestre.com');

      const submitButton = getByText('Enviar Link');
      fireEvent.press(submitButton);

      // showSuccess receives a callback as third parameter that calls router.back
      await waitFor(() => {
        expect(global.mockUseAlert.showSuccess).toHaveBeenCalled();
        // Get the callback and call it to simulate user pressing OK
        const callback = global.mockUseAlert.showSuccess.mock.calls[0][2];
        if (callback) callback();
      });

      expect(mockRouter.back).toHaveBeenCalled();
    });

    it('deve aceitar diferentes formatos de email', async () => {
      (authService.resetPassword as jest.Mock).mockResolvedValue(undefined);

      const { getByPlaceholderText, getByText } = render(<ForgotPassword />);

      const emailInput = getByPlaceholderText('E-mail');
      const submitButton = getByText('Enviar Link');

      // Teste com email com subdomínio
      fireEvent.changeText(emailInput, 'Usuario@empresa.com.br');
      fireEvent.press(submitButton);

      await waitFor(() => {
        // Email é convertido para lowercase
        expect(authService.resetPassword).toHaveBeenCalledWith(
          'usuario@empresa.com.br'
        );
      });
    });
  });

  // ============================================
  // GRUPO 4: Tratamento de Erros
  // ============================================
  describe('Tratamento de Erros', () => {
    it('não deve revelar se email existe - mostra sucesso por segurança', async () => {
      (authService.resetPassword as jest.Mock).mockRejectedValue(
        new Error('User not found')
      );

      const { getByPlaceholderText, getByText } = render(<ForgotPassword />);

      const emailInput = getByPlaceholderText('E-mail');
      fireEvent.changeText(emailInput, 'naoexiste@rotamestre.com');

      const submitButton = getByText('Enviar Link');
      fireEvent.press(submitButton);

      // Por segurança, não revelamos se o email existe
      await waitFor(() => {
        expect(global.mockUseAlert.showSuccess).toHaveBeenCalledWith(
          'Email enviado!',
          'Se o email estiver cadastrado, você receberá as instruções para redefinir sua senha.',
          expect.any(Function)
        );
      });
    });

    it('deve exibir erro genérico quando ocorre erro desconhecido', async () => {
      // Pass a non-Error object to trigger the fallback message
      (authService.resetPassword as jest.Mock).mockRejectedValue('unknown error');

      const { getByPlaceholderText, getByText } = render(<ForgotPassword />);

      const emailInput = getByPlaceholderText('E-mail');
      fireEvent.changeText(emailInput, 'teste@rotamestre.com');

      const submitButton = getByText('Enviar Link');
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(global.mockUseAlert.showError).toHaveBeenCalledWith({
          title: 'Erro',
          message: 'Não foi possível enviar o email. Tente novamente mais tarde.'
        });
      });
    });

    it('deve exibir mensagem amigável quando rate limit do Supabase é atingido', async () => {
      (authService.resetPassword as jest.Mock).mockRejectedValue(
        new Error('email rate limit exceeded')
      );

      const { getByPlaceholderText, getByText } = render(<ForgotPassword />);

      const emailInput = getByPlaceholderText('E-mail');
      fireEvent.changeText(emailInput, 'teste@rotamestre.com');

      const submitButton = getByText('Enviar Link');
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(global.mockUseAlert.showWarning).toHaveBeenCalledWith(
          'Limite de envios atingido',
          'Por segurança, aguarde alguns minutos antes de solicitar outro email de recuperação.'
        );
      });
    });

    it('deve bloquear quando rate limit local é atingido', async () => {
      // Simular rate limit local atingido
      (passwordResetRateLimiter.checkLimit as jest.Mock).mockResolvedValue({
        allowed: false,
        remainingAttempts: 0,
        retryAfterMs: 60000,
        message: 'Aguarde 1 minuto para tentar novamente.',
      });

      const { getByPlaceholderText, getByText } = render(<ForgotPassword />);

      const emailInput = getByPlaceholderText('E-mail');
      fireEvent.changeText(emailInput, 'teste@rotamestre.com');

      const submitButton = getByText('Enviar Link');
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(global.mockUseAlert.showWarning).toHaveBeenCalledWith(
          'Aguarde',
          'Aguarde 1 minuto para tentar novamente.'
        );
        // authService NÃO deve ser chamado quando rate limit local está ativo
        expect(authService.resetPassword).not.toHaveBeenCalled();
      });
    });
  });

  // ============================================
  // GRUPO 5: Estado de Loading
  // ============================================
  describe('Estado de Loading', () => {
    it('deve chamar serviço durante loading', async () => {
      (authService.resetPassword as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      const { getByPlaceholderText, getByText } = render(<ForgotPassword />);

      const emailInput = getByPlaceholderText('E-mail');
      fireEvent.changeText(emailInput, 'usuario@rotamestre.com');

      const submitButton = getByText('Enviar Link');
      fireEvent.press(submitButton);

      // Esperar o serviço ser chamado para confirmar que loading começou
      await waitFor(() => {
        expect(authService.resetPassword).toHaveBeenCalledWith(
          'usuario@rotamestre.com'
        );
      });
    });

    it('deve chamar authService ao enviar email', async () => {
      (authService.resetPassword as jest.Mock).mockResolvedValue(undefined);

      const { getByPlaceholderText, getByText } = render(<ForgotPassword />);

      const emailInput = getByPlaceholderText('E-mail');
      fireEvent.changeText(emailInput, 'usuario@rotamestre.com');

      const submitButton = getByText('Enviar Link');
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(authService.resetPassword).toHaveBeenCalledWith(
          'usuario@rotamestre.com'
        );
        expect(global.mockUseAlert.showSuccess).toHaveBeenCalled();
      });
    });

    it('deve exibir Alert após tratamento de erro', async () => {
      (authService.resetPassword as jest.Mock).mockRejectedValue(
        new Error('Erro de conexão')
      );

      const { getByPlaceholderText, getByText } = render(<ForgotPassword />);

      const emailInput = getByPlaceholderText('E-mail');
      fireEvent.changeText(emailInput, 'teste@rotamestre.com');

      const submitButton = getByText('Enviar Link');
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(authService.resetPassword).toHaveBeenCalled();
        expect(global.mockUseAlert.showError).toHaveBeenCalledWith({
          title: 'Erro',
          message: 'Não foi possível enviar o email. Tente novamente mais tarde.'
        });
      });
    });
  });

  // ============================================
  // GRUPO 6: Navegação
  // ============================================
  describe('Navegação', () => {
    it('deve voltar para tela anterior ao clicar em "Voltar para login"', () => {
      const { getByText } = render(<ForgotPassword />);

      const backButton = getByText('Voltar para login');
      fireEvent.press(backButton);

      expect(mockRouter.push).toHaveBeenCalledWith('/auth/login');
    });

    it('deve exibir Alert de sucesso com callback de confirmação', async () => {
      (authService.resetPassword as jest.Mock).mockResolvedValue(undefined);

      const { getByPlaceholderText, getByText } = render(<ForgotPassword />);

      const emailInput = getByPlaceholderText('E-mail');
      fireEvent.changeText(emailInput, 'usuario@rotamestre.com');

      const submitButton = getByText('Enviar Link');
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(global.mockUseAlert.showSuccess).toHaveBeenCalledWith(
          'Email enviado!',
          'Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.',
          expect.any(Function)
        );
      });
    });

    it('não deve navegar quando envio falha', async () => {
      (authService.resetPassword as jest.Mock).mockRejectedValue(
        new Error('Erro de conexão')
      );

      const { getByPlaceholderText, getByText } = render(<ForgotPassword />);

      const emailInput = getByPlaceholderText('E-mail');
      fireEvent.changeText(emailInput, 'erro@rotamestre.com');

      const submitButton = getByText('Enviar Link');
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(global.mockUseAlert.showError).toHaveBeenCalledWith({
          title: 'Erro',
          message: 'Não foi possível enviar o email. Tente novamente mais tarde.'
        });
      });

      expect(mockRouter.back).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // GRUPO 7: Casos de Borda
  // ============================================
  describe('Casos de Borda', () => {
    it('deve permitir múltiplas tentativas de envio após erro', async () => {
      // Configurar mock para duas chamadas: primeira falha, segunda sucesso
      (authService.resetPassword as jest.Mock)
        .mockRejectedValueOnce(new Error('Erro de conexão'))
        .mockResolvedValueOnce(undefined);

      const { getByPlaceholderText, getByText } = render(<ForgotPassword />);

      const emailInput = getByPlaceholderText('E-mail');
      let submitButton = getByText('Enviar Link');

      // Primeira tentativa - erro
      fireEvent.changeText(emailInput, 'usuario@rotamestre.com');
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(global.mockUseAlert.showError).toHaveBeenCalledWith({
          title: 'Erro',
          message: 'Não foi possível enviar o email. Tente novamente mais tarde.'
        });
        expect(authService.resetPassword).toHaveBeenCalledTimes(1);
      });

      // Aguardar componente processar o erro e limpar loading
      await waitFor(() => {
        submitButton = getByText('Enviar Link');
        expect(submitButton).toBeTruthy();
      });

      // Segunda tentativa - sucesso
      fireEvent.press(submitButton);

      await waitFor(() => {
        // Verificar que o authService foi chamado duas vezes
        expect(authService.resetPassword).toHaveBeenCalledTimes(2);
      });
    });

    it('deve aceitar email com caracteres especiais válidos', async () => {
      (authService.resetPassword as jest.Mock).mockResolvedValue(undefined);

      const { getByPlaceholderText, getByText } = render(<ForgotPassword />);

      const emailInput = getByPlaceholderText('E-mail');
      const submitButton = getByText('Enviar Link');

      // Email com + e . no nome
      fireEvent.changeText(emailInput, 'usuario.teste+1@rotamestre.com');
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(authService.resetPassword).toHaveBeenCalledWith(
          'usuario.teste+1@rotamestre.com'
        );
      });
    });

    it('deve trimar espaços e converter para lowercase antes de enviar', async () => {
      (authService.resetPassword as jest.Mock).mockResolvedValue(undefined);

      const { getByPlaceholderText, getByText } = render(<ForgotPassword />);

      const emailInput = getByPlaceholderText('E-mail');
      const submitButton = getByText('Enviar Link');

      // Email com espaços e letras maiúsculas
      fireEvent.changeText(emailInput, '  Usuario@ROTAMESTRE.com  ');
      fireEvent.press(submitButton);

      await waitFor(() => {
        // O componente faz trim() e toLowerCase()
        expect(authService.resetPassword).toHaveBeenCalledWith(
          'usuario@rotamestre.com'
        );
      });
    });

    it('deve registrar tentativa bem-sucedida no rate limiter', async () => {
      (authService.resetPassword as jest.Mock).mockResolvedValue(undefined);

      const { getByPlaceholderText, getByText } = render(<ForgotPassword />);

      const emailInput = getByPlaceholderText('E-mail');
      fireEvent.changeText(emailInput, 'usuario@rotamestre.com');

      const submitButton = getByText('Enviar Link');
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(passwordResetRateLimiter.recordAttempt).toHaveBeenCalledWith(
          'usuario@rotamestre.com',
          true
        );
      });
    });

    it('deve registrar tentativa falha no rate limiter', async () => {
      (authService.resetPassword as jest.Mock).mockRejectedValue(
        new Error('Erro de conexão')
      );

      const { getByPlaceholderText, getByText } = render(<ForgotPassword />);

      const emailInput = getByPlaceholderText('E-mail');
      fireEvent.changeText(emailInput, 'usuario@rotamestre.com');

      const submitButton = getByText('Enviar Link');
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(passwordResetRateLimiter.recordAttempt).toHaveBeenCalledWith(
          'usuario@rotamestre.com',
          false
        );
      });
    });
  });
});
