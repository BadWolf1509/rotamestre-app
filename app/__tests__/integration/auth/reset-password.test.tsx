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
  },
}));

describe('Reset Password Screen - Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
      fireEvent.changeText(passwordInput, 'novaSenha123');

      expect(passwordInput.props.value).toBe('novaSenha123');
    });

    it('deve atualizar o campo de confirmar senha ao digitar', () => {
      const { getByPlaceholderText } = render(<ResetPassword />);

      const confirmPasswordInput = getByPlaceholderText('Confirmar senha');
      fireEvent.changeText(confirmPasswordInput, 'novaSenha123');

      expect(confirmPasswordInput.props.value).toBe('novaSenha123');
    });

    it('deve exibir erro quando senha está vazia', async () => {
      const { getByText } = render(<ResetPassword />);

      const submitButton = getByText('Redefinir Senha');
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(global.mockUseAlert.showWarning).toHaveBeenCalledWith('Erro', 'Digite sua nova senha');
      });
    });

    it('deve exibir erro quando senha contém apenas espaços', async () => {
      const { getByPlaceholderText, getByText } = render(<ResetPassword />);

      const passwordInput = getByPlaceholderText('Nova senha');
      fireEvent.changeText(passwordInput, '   ');

      const submitButton = getByText('Redefinir Senha');
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(global.mockUseAlert.showWarning).toHaveBeenCalledWith('Erro', 'Digite sua nova senha');
      });
    });

    it('deve exibir erro quando senha tem menos de 8 caracteres', async () => {
      const { getByPlaceholderText, getByText } = render(<ResetPassword />);

      const passwordInput = getByPlaceholderText('Nova senha');
      const confirmPasswordInput = getByPlaceholderText('Confirmar senha');

      fireEvent.changeText(passwordInput, 'abc123');
      fireEvent.changeText(confirmPasswordInput, 'abc123');

      const submitButton = getByText('Redefinir Senha');
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(global.mockUseAlert.showWarning).toHaveBeenCalledWith(
          'Erro',
          'A senha deve ter no mínimo 8 caracteres'
        );
      });
    });

    it('deve exibir erro quando senhas não coincidem', async () => {
      const { getByPlaceholderText, getByText } = render(<ResetPassword />);

      const passwordInput = getByPlaceholderText('Nova senha');
      const confirmPasswordInput = getByPlaceholderText('Confirmar senha');

      fireEvent.changeText(passwordInput, 'novaSenha123');
      fireEvent.changeText(confirmPasswordInput, 'outraSenha123');

      const submitButton = getByText('Redefinir Senha');
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(global.mockUseAlert.showWarning).toHaveBeenCalledWith('Erro', 'As senhas não coincidem');
      });
    });

    it('deve aceitar senha válida de exatamente 8 caracteres', async () => {
      (authService.updatePassword as jest.Mock).mockResolvedValue(undefined);

      const { getByPlaceholderText, getByText } = render(<ResetPassword />);

      const passwordInput = getByPlaceholderText('Nova senha');
      const confirmPasswordInput = getByPlaceholderText('Confirmar senha');

      fireEvent.changeText(passwordInput, '12345678');
      fireEvent.changeText(confirmPasswordInput, '12345678');

      const submitButton = getByText('Redefinir Senha');
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(authService.updatePassword).toHaveBeenCalledWith('12345678');
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

      const passwordInput = getByPlaceholderText('Nova senha');
      const confirmPasswordInput = getByPlaceholderText('Confirmar senha');

      fireEvent.changeText(passwordInput, 'novaSenha123');
      fireEvent.changeText(confirmPasswordInput, 'novaSenha123');

      const submitButton = getByText('Redefinir Senha');
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(authService.updatePassword).toHaveBeenCalledWith('novaSenha123');
        expect(global.mockUseAlert.showSuccess).toHaveBeenCalledWith(
          'Senha atualizada!',
          'Sua senha foi redefinida com sucesso. Faça login com sua nova senha.',
          expect.any(Function)
        );
      });
    });

    it('deve redirecionar para login após confirmar sucesso', async () => {
      (authService.updatePassword as jest.Mock).mockResolvedValue(undefined);

      const { getByPlaceholderText, getByText } = render(<ResetPassword />);

      const passwordInput = getByPlaceholderText('Nova senha');
      const confirmPasswordInput = getByPlaceholderText('Confirmar senha');

      fireEvent.changeText(passwordInput, 'novaSenha123');
      fireEvent.changeText(confirmPasswordInput, 'novaSenha123');

      const submitButton = getByText('Redefinir Senha');
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(global.mockUseAlert.showSuccess).toHaveBeenCalled();
      });

      // Simular callback de sucesso
      const successCall = global.mockUseAlert.showSuccess.mock.calls[0];
      const onDismissCallback = successCall[2];
      onDismissCallback();

      expect(mockRouter.replace).toHaveBeenCalledWith('/auth/login');
    });

    it('deve aceitar senhas longas (mais de 8 caracteres)', async () => {
      (authService.updatePassword as jest.Mock).mockResolvedValue(undefined);

      const { getByPlaceholderText, getByText } = render(<ResetPassword />);

      const passwordInput = getByPlaceholderText('Nova senha');
      const confirmPasswordInput = getByPlaceholderText('Confirmar senha');

      const longPassword = 'estaeumaSenhaMuitoSegura123!@#';

      fireEvent.changeText(passwordInput, longPassword);
      fireEvent.changeText(confirmPasswordInput, longPassword);

      const submitButton = getByText('Redefinir Senha');
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(authService.updatePassword).toHaveBeenCalledWith(longPassword);
      });
    });

    it('deve aceitar senhas com caracteres especiais', async () => {
      (authService.updatePassword as jest.Mock).mockResolvedValue(undefined);

      const { getByPlaceholderText, getByText } = render(<ResetPassword />);

      const passwordInput = getByPlaceholderText('Nova senha');
      const confirmPasswordInput = getByPlaceholderText('Confirmar senha');

      const specialPassword = 'Senha!@#123';

      fireEvent.changeText(passwordInput, specialPassword);
      fireEvent.changeText(confirmPasswordInput, specialPassword);

      const submitButton = getByText('Redefinir Senha');
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(authService.updatePassword).toHaveBeenCalledWith(specialPassword);
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

      const passwordInput = getByPlaceholderText('Nova senha');
      const confirmPasswordInput = getByPlaceholderText('Confirmar senha');

      fireEvent.changeText(passwordInput, 'novaSenha123');
      fireEvent.changeText(confirmPasswordInput, 'novaSenha123');

      const submitButton = getByText('Redefinir Senha');
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(global.mockUseAlert.showError).toHaveBeenCalledWith(testError);
      });
    });

    it('deve exibir erro genérico quando ocorre erro desconhecido', async () => {
      const testError = new Error();
      (authService.updatePassword as jest.Mock).mockRejectedValue(testError);

      const { getByPlaceholderText, getByText } = render(<ResetPassword />);

      const passwordInput = getByPlaceholderText('Nova senha');
      const confirmPasswordInput = getByPlaceholderText('Confirmar senha');

      fireEvent.changeText(passwordInput, 'novaSenha123');
      fireEvent.changeText(confirmPasswordInput, 'novaSenha123');

      const submitButton = getByText('Redefinir Senha');
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(global.mockUseAlert.showError).toHaveBeenCalledWith(testError);
      });
    });

    it('não deve chamar authService quando validação falha', async () => {
      const { getByPlaceholderText, getByText } = render(<ResetPassword />);

      const passwordInput = getByPlaceholderText('Nova senha');
      const confirmPasswordInput = getByPlaceholderText('Confirmar senha');

      // Senhas não coincidem
      fireEvent.changeText(passwordInput, 'senha123456');
      fireEvent.changeText(confirmPasswordInput, 'outra123456');

      const submitButton = getByText('Redefinir Senha');
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(global.mockUseAlert.showWarning).toHaveBeenCalledWith('Erro', 'As senhas não coincidem');
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
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      const { getByPlaceholderText, getByText } = render(<ResetPassword />);

      const passwordInput = getByPlaceholderText('Nova senha');
      const confirmPasswordInput = getByPlaceholderText('Confirmar senha');

      fireEvent.changeText(passwordInput, 'novaSenha123');
      fireEvent.changeText(confirmPasswordInput, 'novaSenha123');

      const submitButton = getByText('Redefinir Senha');
      fireEvent.press(submitButton);

      // Esperar o serviço ser chamado para confirmar que loading começou
      await waitFor(() => {
        expect(authService.updatePassword).toHaveBeenCalledWith('novaSenha123');
      });
    });

    it('deve chamar authService ao atualizar senha', async () => {
      (authService.updatePassword as jest.Mock).mockResolvedValue(undefined);

      const { getByPlaceholderText, getByText } = render(<ResetPassword />);

      const passwordInput = getByPlaceholderText('Nova senha');
      const confirmPasswordInput = getByPlaceholderText('Confirmar senha');

      fireEvent.changeText(passwordInput, 'novaSenha123');
      fireEvent.changeText(confirmPasswordInput, 'novaSenha123');

      const submitButton = getByText('Redefinir Senha');
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(authService.updatePassword).toHaveBeenCalledWith('novaSenha123');
        expect(global.mockUseAlert.showSuccess).toHaveBeenCalled();
      });
    });

    it('deve exibir Alert após tratamento de erro', async () => {
      const testError = new Error('Erro de teste');
      (authService.updatePassword as jest.Mock).mockRejectedValue(testError);

      const { getByPlaceholderText, getByText } = render(<ResetPassword />);

      const passwordInput = getByPlaceholderText('Nova senha');
      const confirmPasswordInput = getByPlaceholderText('Confirmar senha');

      fireEvent.changeText(passwordInput, 'novaSenha123');
      fireEvent.changeText(confirmPasswordInput, 'novaSenha123');

      const submitButton = getByText('Redefinir Senha');
      fireEvent.press(submitButton);

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

    it('deve exibir Alert de sucesso com callback de confirmação', async () => {
      (authService.updatePassword as jest.Mock).mockResolvedValue(undefined);

      const { getByPlaceholderText, getByText } = render(<ResetPassword />);

      const passwordInput = getByPlaceholderText('Nova senha');
      const confirmPasswordInput = getByPlaceholderText('Confirmar senha');

      fireEvent.changeText(passwordInput, 'novaSenha123');
      fireEvent.changeText(confirmPasswordInput, 'novaSenha123');

      const submitButton = getByText('Redefinir Senha');
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(global.mockUseAlert.showSuccess).toHaveBeenCalledWith(
          'Senha atualizada!',
          'Sua senha foi redefinida com sucesso. Faça login com sua nova senha.',
          expect.any(Function)
        );
      });
    });

    it('não deve navegar quando atualização falha', async () => {
      const testError = new Error('Erro de teste');
      (authService.updatePassword as jest.Mock).mockRejectedValue(testError);

      const { getByPlaceholderText, getByText } = render(<ResetPassword />);

      const passwordInput = getByPlaceholderText('Nova senha');
      const confirmPasswordInput = getByPlaceholderText('Confirmar senha');

      fireEvent.changeText(passwordInput, 'novaSenha123');
      fireEvent.changeText(confirmPasswordInput, 'novaSenha123');

      const submitButton = getByText('Redefinir Senha');
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(global.mockUseAlert.showError).toHaveBeenCalledWith(testError);
      });

      // Não deve ter chamado replace (exceto pelo mock inicial)
      const replaceCalls = (mockRouter.replace as jest.Mock).mock.calls;
      expect(replaceCalls.length).toBe(0);
    });
  });

  // ============================================
  // GRUPO 7: Casos de Borda
  // ============================================
  describe('Casos de Borda', () => {
    it('deve permitir múltiplas tentativas de atualização após erro', async () => {
      // Configurar mock para duas chamadas: primeira falha, segunda sucesso
      const firstError = new Error('Erro temporário');
      (authService.updatePassword as jest.Mock)
        .mockRejectedValueOnce(firstError)
        .mockResolvedValueOnce(undefined);

      const { getByPlaceholderText, getByText } = render(<ResetPassword />);

      const passwordInput = getByPlaceholderText('Nova senha');
      const confirmPasswordInput = getByPlaceholderText('Confirmar senha');
      let submitButton = getByText('Redefinir Senha');

      // Primeira tentativa - erro
      fireEvent.changeText(passwordInput, 'novaSenha123');
      fireEvent.changeText(confirmPasswordInput, 'novaSenha123');
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
        // Verificar que o authService foi chamado duas vezes
        expect(authService.updatePassword).toHaveBeenCalledTimes(2);
      });
    });

    it('deve validar em ordem: vazio -> tamanho -> confirmação', async () => {
      const { getByPlaceholderText, getByText } = render(<ResetPassword />);

      const passwordInput = getByPlaceholderText('Nova senha');
      const confirmPasswordInput = getByPlaceholderText('Confirmar senha');
      const submitButton = getByText('Redefinir Senha');

      // Teste 1: Campo vazio
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(global.mockUseAlert.showWarning).toHaveBeenCalledWith('Erro', 'Digite sua nova senha');
      });

      jest.clearAllMocks();

      // Teste 2: Senha muito curta
      fireEvent.changeText(passwordInput, '123');
      fireEvent.changeText(confirmPasswordInput, '123');
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(global.mockUseAlert.showWarning).toHaveBeenCalledWith(
          'Erro',
          'A senha deve ter no mínimo 8 caracteres'
        );
      });

      jest.clearAllMocks();

      // Teste 3: Senhas não coincidem
      fireEvent.changeText(passwordInput, '12345678');
      fireEvent.changeText(confirmPasswordInput, '87654321');
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(global.mockUseAlert.showWarning).toHaveBeenCalledWith('Erro', 'As senhas não coincidem');
      });
    });

    it('deve considerar case-sensitive na confirmação de senha', async () => {
      const { getByPlaceholderText, getByText } = render(<ResetPassword />);

      const passwordInput = getByPlaceholderText('Nova senha');
      const confirmPasswordInput = getByPlaceholderText('Confirmar senha');

      // Senhas diferem apenas no case
      fireEvent.changeText(passwordInput, 'NovaSenha123');
      fireEvent.changeText(confirmPasswordInput, 'novasenha123');

      const submitButton = getByText('Redefinir Senha');
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(global.mockUseAlert.showWarning).toHaveBeenCalledWith('Erro', 'As senhas não coincidem');
      });
    });
  });
});
