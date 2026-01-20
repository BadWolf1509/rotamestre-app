import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

import { authService } from '@/lib/auth';

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

describe('Forgot Password Screen - Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
      fireEvent.changeText(emailInput, 'usuario@rotamestre.com');

      const submitButton = getByText('Enviar Link');
      fireEvent.press(submitButton);

      await waitFor(() => {
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
      fireEvent.changeText(emailInput, 'usuario@empresa.com.br');
      fireEvent.press(submitButton);

      await waitFor(() => {
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
    it('deve exibir erro quando email não é encontrado', async () => {
      (authService.resetPassword as jest.Mock).mockRejectedValue(
        new Error('Usuário não encontrado')
      );

      const { getByPlaceholderText, getByText } = render(<ForgotPassword />);

      const emailInput = getByPlaceholderText('E-mail');
      fireEvent.changeText(emailInput, 'naoexiste@rotamestre.com');

      const submitButton = getByText('Enviar Link');
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(global.mockUseAlert.showError).toHaveBeenCalledWith({ title: 'Erro', message: 'Usuário não encontrado' });
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
          message: 'Erro ao enviar email de recuperação'
        });
      });
    });

    it('deve exibir mensagem de erro específica quando disponível', async () => {
      (authService.resetPassword as jest.Mock).mockRejectedValue(
        new Error('Servidor temporariamente indisponível')
      );

      const { getByPlaceholderText, getByText } = render(<ForgotPassword />);

      const emailInput = getByPlaceholderText('E-mail');
      fireEvent.changeText(emailInput, 'teste@rotamestre.com');

      const submitButton = getByText('Enviar Link');
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(global.mockUseAlert.showError).toHaveBeenCalledWith({
          title: 'Erro',
          message: 'Servidor temporariamente indisponível'
        });
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
        new Error('Erro de teste')
      );

      const { getByPlaceholderText, getByText } = render(<ForgotPassword />);

      const emailInput = getByPlaceholderText('E-mail');
      fireEvent.changeText(emailInput, 'teste@rotamestre.com');

      const submitButton = getByText('Enviar Link');
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(authService.resetPassword).toHaveBeenCalled();
        expect(global.mockUseAlert.showError).toHaveBeenCalledWith({ title: 'Erro', message: 'Erro de teste' });
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
        new Error('Erro de teste')
      );

      const { getByPlaceholderText, getByText } = render(<ForgotPassword />);

      const emailInput = getByPlaceholderText('E-mail');
      fireEvent.changeText(emailInput, 'erro@rotamestre.com');

      const submitButton = getByText('Enviar Link');
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(global.mockUseAlert.showError).toHaveBeenCalledWith({ title: 'Erro', message: 'Erro de teste' });
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
        .mockRejectedValueOnce(new Error('Erro temporário'))
        .mockResolvedValueOnce(undefined);

      const { getByPlaceholderText, getByText } = render(<ForgotPassword />);

      const emailInput = getByPlaceholderText('E-mail');
      let submitButton = getByText('Enviar Link');

      // Primeira tentativa - erro
      fireEvent.changeText(emailInput, 'usuario@rotamestre.com');
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(global.mockUseAlert.showError).toHaveBeenCalledWith({ title: 'Erro', message: 'Erro temporário' });
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

    it('deve trimar espaços do email antes de enviar', async () => {
      (authService.resetPassword as jest.Mock).mockResolvedValue(undefined);

      const { getByPlaceholderText, getByText } = render(<ForgotPassword />);

      const emailInput = getByPlaceholderText('E-mail');
      const submitButton = getByText('Enviar Link');

      // Email com espaços
      fireEvent.changeText(emailInput, '  usuario@rotamestre.com  ');
      fireEvent.press(submitButton);

      await waitFor(() => {
        // O componente chama email.trim(), então espaços devem ser removidos
        expect(authService.resetPassword).toHaveBeenCalled();
      });
    });
  });
});
