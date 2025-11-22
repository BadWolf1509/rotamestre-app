import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import * as ReactNative from 'react-native';

import { authService } from '@/lib/auth';

(ReactNative as any).Alert = (ReactNative as any).Alert || { alert: (global as any).mockAlert };
(ReactNative as any).Alert.alert = (global as any).mockAlert;

const Register = require('../register').default;
const Alert = ReactNative.Alert;

// Mock expo-router
const mockBack = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockBack,
    replace: mockReplace,
  }),
}));

// Mock authService
jest.mock('@/lib/auth', () => ({
  authService: {
    signUp: jest.fn(),
  },
}));

// Mock useResponsive
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({
    isDesktop: false,
    isMobile: true,
    isTablet: false,
  }),
}));

// Mock ResponsiveContainer
jest.mock('@/components/ResponsiveContainer', () => ({
  ResponsiveContainer: ({ children }: any) => children,
}));

describe('Register Screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).mockAlert.mockClear();
  });

  describe('Renderização', () => {
    it('deve renderizar todos os elementos do formulário', () => {
      const { getAllByText, getByText, getByPlaceholderText } = render(<Register />);

      expect(getAllByText('Criar Conta').length).toBeGreaterThan(0);
      expect(getByText('Preencha os dados abaixo para criar sua conta no Rota Mestre')).toBeTruthy();
      expect(getByPlaceholderText('Digite seu nome')).toBeTruthy();
      expect(getByPlaceholderText('Digite seu e-mail')).toBeTruthy();
      expect(getByPlaceholderText('Mínimo 6 caracteres')).toBeTruthy();
      expect(getByPlaceholderText('Digite a senha novamente')).toBeTruthy();
    });

    it('deve renderizar labels dos campos', () => {
      const { getByText } = render(<Register />);

      expect(getByText('Nome Completo')).toBeTruthy();
      expect(getByText('E-mail')).toBeTruthy();
      expect(getByText('Senha')).toBeTruthy();
      expect(getByText('Confirmar Senha')).toBeTruthy();
      expect(getByText('Tipo de Conta')).toBeTruthy();
    });

    it('deve renderizar botões de tipo de usuário', () => {
      const { getByText } = render(<Register />);

      expect(getByText('Motorista')).toBeTruthy();
      expect(getByText('Gestor')).toBeTruthy();
    });

    it('deve renderizar botão de criar conta', () => {
      const { getAllByText } = render(<Register />);

      expect(getAllByText('Criar Conta').length).toBeGreaterThan(0);
    });

    it('deve renderizar link de voltar para login', () => {
      const { getByText } = render(<Register />);

      expect(getByText('Já tem uma conta? Faça login')).toBeTruthy();
    });
  });

  describe('Alteração de Estado', () => {
    it('deve atualizar campo nome', () => {
      const { getByPlaceholderText } = render(<Register />);
      const input = getByPlaceholderText('Digite seu nome');

      fireEvent.changeText(input, 'João Silva');
      expect(input.props.value).toBe('João Silva');
    });

    it('deve atualizar campo email', () => {
      const { getByPlaceholderText } = render(<Register />);
      const input = getByPlaceholderText('Digite seu e-mail');

      fireEvent.changeText(input, 'joao@exemplo.com');
      expect(input.props.value).toBe('joao@exemplo.com');
    });

    it('deve atualizar campo senha', () => {
      const { getByPlaceholderText } = render(<Register />);
      const input = getByPlaceholderText('Mínimo 6 caracteres');

      fireEvent.changeText(input, '123456');
      expect(input.props.value).toBe('123456');
    });

    it('deve atualizar campo confirmar senha', () => {
      const { getByPlaceholderText } = render(<Register />);
      const input = getByPlaceholderText('Digite a senha novamente');

      fireEvent.changeText(input, '123456');
      expect(input.props.value).toBe('123456');
    });

    it('deve alternar tipo de usuário para gestor', async () => {
      (authService.signUp as jest.Mock).mockResolvedValueOnce(undefined);

      const { getByText, getByPlaceholderText, getAllByText } = render(<Register />);
      fireEvent.press(getByText('Gestor'));

      fireEvent.changeText(getByPlaceholderText('Digite seu nome'), 'João Silva');
      fireEvent.changeText(getByPlaceholderText('Digite seu e-mail'), 'gestor@exemplo.com');
      fireEvent.changeText(getByPlaceholderText('Mínimo 6 caracteres'), '123456');
      fireEvent.changeText(getByPlaceholderText('Digite a senha novamente'), '123456');
      fireEvent.press(getAllByText('Criar Conta')[1]);

      await waitFor(() => {
        expect(authService.signUp).toHaveBeenCalledWith(
          'gestor@exemplo.com',
          '123456',
          'João Silva',
          'gestor'
        );
      });
    });

    it('deve alternar tipo de usuário para motorista', async () => {
      (authService.signUp as jest.Mock).mockResolvedValueOnce(undefined);

      const { getByText, getByPlaceholderText, getAllByText } = render(<Register />);
      fireEvent.press(getByText('Motorista'));

      fireEvent.changeText(getByPlaceholderText('Digite seu nome'), 'Maria Souza');
      fireEvent.changeText(getByPlaceholderText('Digite seu e-mail'), 'motorista@exemplo.com');
      fireEvent.changeText(getByPlaceholderText('Mínimo 6 caracteres'), '123456');
      fireEvent.changeText(getByPlaceholderText('Digite a senha novamente'), '123456');
      fireEvent.press(getAllByText('Criar Conta')[1]);

      await waitFor(() => {
        expect(authService.signUp).toHaveBeenCalledWith(
          'motorista@exemplo.com',
          '123456',
          'Maria Souza',
          'motorista'
        );
      });
    });
  });

  describe('Validação de Formulário', () => {
    it('deve mostrar erro ao submeter sem preencher campos', () => {
      const { getAllByText } = render(<Register />);
      const submitButton = getAllByText('Criar Conta')[1]; // Botão é o segundo elemento

      fireEvent.press(submitButton);

      expect(Alert.alert).toHaveBeenCalledWith('Erro', 'Preencha todos os campos');
    });

    it('deve mostrar erro ao submeter sem nome', () => {
      const { getByPlaceholderText, getAllByText } = render(<Register />);

      fireEvent.changeText(getByPlaceholderText('Digite seu e-mail'), 'joao@exemplo.com');
      fireEvent.changeText(getByPlaceholderText('Mínimo 6 caracteres'), '123456');
      fireEvent.changeText(getByPlaceholderText('Digite a senha novamente'), '123456');
      fireEvent.press(getAllByText('Criar Conta')[1]);

      expect(Alert.alert).toHaveBeenCalledWith('Erro', 'Preencha todos os campos');
    });

    it('deve mostrar erro ao submeter sem email', () => {
      const { getByPlaceholderText, getAllByText } = render(<Register />);

      fireEvent.changeText(getByPlaceholderText('Digite seu nome'), 'João Silva');
      fireEvent.changeText(getByPlaceholderText('Mínimo 6 caracteres'), '123456');
      fireEvent.changeText(getByPlaceholderText('Digite a senha novamente'), '123456');
      fireEvent.press(getAllByText('Criar Conta')[1]);

      expect(Alert.alert).toHaveBeenCalledWith('Erro', 'Preencha todos os campos');
    });

    it('deve mostrar erro ao submeter sem senha', () => {
      const { getByPlaceholderText, getAllByText } = render(<Register />);

      fireEvent.changeText(getByPlaceholderText('Digite seu nome'), 'João Silva');
      fireEvent.changeText(getByPlaceholderText('Digite seu e-mail'), 'joao@exemplo.com');
      fireEvent.changeText(getByPlaceholderText('Digite a senha novamente'), '123456');
      fireEvent.press(getAllByText('Criar Conta')[1]);

      expect(Alert.alert).toHaveBeenCalledWith('Erro', 'Preencha todos os campos');
    });

    it('deve mostrar erro ao submeter sem confirmar senha', () => {
      const { getByPlaceholderText, getAllByText } = render(<Register />);

      fireEvent.changeText(getByPlaceholderText('Digite seu nome'), 'João Silva');
      fireEvent.changeText(getByPlaceholderText('Digite seu e-mail'), 'joao@exemplo.com');
      fireEvent.changeText(getByPlaceholderText('Mínimo 6 caracteres'), '123456');
      fireEvent.press(getAllByText('Criar Conta')[1]);

      expect(Alert.alert).toHaveBeenCalledWith('Erro', 'Preencha todos os campos');
    });

    it('deve mostrar erro quando senhas não coincidem', () => {
      const { getByPlaceholderText, getAllByText } = render(<Register />);

      fireEvent.changeText(getByPlaceholderText('Digite seu nome'), 'João Silva');
      fireEvent.changeText(getByPlaceholderText('Digite seu e-mail'), 'joao@exemplo.com');
      fireEvent.changeText(getByPlaceholderText('Mínimo 6 caracteres'), '123456');
      fireEvent.changeText(getByPlaceholderText('Digite a senha novamente'), '654321');
      fireEvent.press(getAllByText('Criar Conta')[1]);

      expect(Alert.alert).toHaveBeenCalledWith('Erro', 'As senhas não coincidem');
    });

    it('deve mostrar erro quando senha tem menos de 6 caracteres', () => {
      const { getByPlaceholderText, getAllByText } = render(<Register />);

      fireEvent.changeText(getByPlaceholderText('Digite seu nome'), 'João Silva');
      fireEvent.changeText(getByPlaceholderText('Digite seu e-mail'), 'joao@exemplo.com');
      fireEvent.changeText(getByPlaceholderText('Mínimo 6 caracteres'), '12345');
      fireEvent.changeText(getByPlaceholderText('Digite a senha novamente'), '12345');
      fireEvent.press(getAllByText('Criar Conta')[1]);

      expect(Alert.alert).toHaveBeenCalledWith('Erro', 'A senha deve ter pelo menos 6 caracteres');
    });
  });

  describe('Registro de Usuário', () => {
    it('deve chamar authService.signUp com dados corretos', async () => {
      (authService.signUp as jest.Mock).mockResolvedValue(undefined);

      const { getByPlaceholderText, getAllByText } = render(<Register />);

      fireEvent.changeText(getByPlaceholderText('Digite seu nome'), 'João Silva');
      fireEvent.changeText(getByPlaceholderText('Digite seu e-mail'), 'joao@exemplo.com');
      fireEvent.changeText(getByPlaceholderText('Mínimo 6 caracteres'), '123456');
      fireEvent.changeText(getByPlaceholderText('Digite a senha novamente'), '123456');
      fireEvent.press(getAllByText('Criar Conta')[1]);

      await waitFor(() => {
        expect(authService.signUp).toHaveBeenCalledWith(
          'joao@exemplo.com',
          '123456',
          'João Silva',
          'motorista'
        );
      });
    });

    it('deve chamar authService.signUp com tipo gestor', async () => {
      (authService.signUp as jest.Mock).mockResolvedValue(undefined);

      const { getByPlaceholderText, getByText, getAllByText } = render(<Register />);

      fireEvent.changeText(getByPlaceholderText('Digite seu nome'), 'Maria Gestora');
      fireEvent.changeText(getByPlaceholderText('Digite seu e-mail'), 'maria@exemplo.com');
      fireEvent.changeText(getByPlaceholderText('Mínimo 6 caracteres'), 'senha123');
      fireEvent.changeText(getByPlaceholderText('Digite a senha novamente'), 'senha123');
      fireEvent.press(getByText('Gestor'));
      fireEvent.press(getAllByText('Criar Conta')[1]);

      await waitFor(() => {
        expect(authService.signUp).toHaveBeenCalledWith(
          'maria@exemplo.com',
          'senha123',
          'Maria Gestora',
          'gestor'
        );
      });
    });

    it('deve mostrar alert de sucesso ao criar conta', async () => {
      (authService.signUp as jest.Mock).mockResolvedValue(undefined);

      const { getByPlaceholderText, getAllByText } = render(<Register />);

      fireEvent.changeText(getByPlaceholderText('Digite seu nome'), 'João Silva');
      fireEvent.changeText(getByPlaceholderText('Digite seu e-mail'), 'joao@exemplo.com');
      fireEvent.changeText(getByPlaceholderText('Mínimo 6 caracteres'), '123456');
      fireEvent.changeText(getByPlaceholderText('Digite a senha novamente'), '123456');
      fireEvent.press(getAllByText('Criar Conta')[1]);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Sucesso',
          'Conta criada com sucesso! Verifique seu e-mail para confirmar.',
          [{ text: 'OK', onPress: expect.any(Function) }]
        );
      });
    });

    it('deve redirecionar para login ao confirmar sucesso', async () => {
      (authService.signUp as jest.Mock).mockResolvedValue(undefined);

      const { getByPlaceholderText, getAllByText } = render(<Register />);

      fireEvent.changeText(getByPlaceholderText('Digite seu nome'), 'João Silva');
      fireEvent.changeText(getByPlaceholderText('Digite seu e-mail'), 'joao@exemplo.com');
      fireEvent.changeText(getByPlaceholderText('Mínimo 6 caracteres'), '123456');
      fireEvent.changeText(getByPlaceholderText('Digite a senha novamente'), '123456');
      fireEvent.press(getAllByText('Criar Conta')[1]);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalled();
      });

      // Simula pressionar OK no alert
      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const okButton = alertCall[2][0];
      okButton.onPress();

      expect(mockReplace).toHaveBeenCalledWith('/auth/login');
    });

    it('deve mostrar erro ao falhar registro', async () => {
      (authService.signUp as jest.Mock).mockRejectedValue(
        new Error('Email já cadastrado')
      );

      const { getByPlaceholderText, getAllByText } = render(<Register />);

      fireEvent.changeText(getByPlaceholderText('Digite seu nome'), 'João Silva');
      fireEvent.changeText(getByPlaceholderText('Digite seu e-mail'), 'joao@exemplo.com');
      fireEvent.changeText(getByPlaceholderText('Mínimo 6 caracteres'), '123456');
      fireEvent.changeText(getByPlaceholderText('Digite a senha novamente'), '123456');
      fireEvent.press(getAllByText('Criar Conta')[1]);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Erro', 'Email já cadastrado');
      });
    });

    it('deve mostrar erro genérico ao falhar sem mensagem', async () => {
      (authService.signUp as jest.Mock).mockRejectedValue(new Error());

      const { getByPlaceholderText, getAllByText } = render(<Register />);

      fireEvent.changeText(getByPlaceholderText('Digite seu nome'), 'João Silva');
      fireEvent.changeText(getByPlaceholderText('Digite seu e-mail'), 'joao@exemplo.com');
      fireEvent.changeText(getByPlaceholderText('Mínimo 6 caracteres'), '123456');
      fireEvent.changeText(getByPlaceholderText('Digite a senha novamente'), '123456');
      fireEvent.press(getAllByText('Criar Conta')[1]);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Erro', 'Erro ao criar conta');
      });
    });
  });

  describe('Loading State', () => {
    it('deve mostrar ActivityIndicator durante registro', async () => {
      (authService.signUp as jest.Mock).mockResolvedValue(undefined);

      const { getByPlaceholderText, getAllByText, queryByText } = render(<Register />);

      fireEvent.changeText(getByPlaceholderText('Digite seu nome'), 'João Silva');
      fireEvent.changeText(getByPlaceholderText('Digite seu e-mail'), 'joao@exemplo.com');
      fireEvent.changeText(getByPlaceholderText('Mínimo 6 caracteres'), '123456');
      fireEvent.changeText(getByPlaceholderText('Digite a senha novamente'), '123456');
      fireEvent.press(getAllByText('Criar Conta')[1]);

      // Durante loading, texto do botão some (mostra ActivityIndicator)
      await waitFor(() => {
        // Título ainda existe, mas botão com texto some
        expect(getAllByText('Criar Conta').length).toBe(1); // Apenas título
        expect(queryByText('Criar Conta')).toBeTruthy();
      });

      await waitFor(() => {
        expect(getAllByText('Criar Conta').length).toBe(2);
      });
    });

    it('deve chamar authService durante loading', async () => {
      (authService.signUp as jest.Mock).mockResolvedValue(undefined);

      const { getByPlaceholderText, getAllByText } = render(<Register />);

      fireEvent.changeText(getByPlaceholderText('Digite seu nome'), 'João Silva');
      fireEvent.changeText(getByPlaceholderText('Digite seu e-mail'), 'joao@exemplo.com');
      fireEvent.changeText(getByPlaceholderText('Mínimo 6 caracteres'), '123456');
      fireEvent.changeText(getByPlaceholderText('Digite a senha novamente'), '123456');

      const submitButton = getAllByText('Criar Conta')[1];
      fireEvent.press(submitButton);

      // Verifica que authService foi chamado
      await waitFor(() => {
        expect(authService.signUp).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(getAllByText('Criar Conta').length).toBe(2);
      });
    });
  });

  describe('Navegação', () => {
    it('deve voltar ao clicar no link de login', () => {
      const { getByText } = render(<Register />);
      const backLink = getByText('Já tem uma conta? Faça login');

      fireEvent.press(backLink);

      expect(mockBack).toHaveBeenCalled();
    });
  });

  describe('Propriedades dos Inputs', () => {
    it('input de nome deve ter autoCapitalize words', () => {
      const { getByPlaceholderText } = render(<Register />);
      const input = getByPlaceholderText('Digite seu nome');

      expect(input.props.autoCapitalize).toBe('words');
    });

    it('input de email deve ter keyboardType email-address', () => {
      const { getByPlaceholderText } = render(<Register />);
      const input = getByPlaceholderText('Digite seu e-mail');

      expect(input.props.keyboardType).toBe('email-address');
      expect(input.props.autoCapitalize).toBe('none');
      expect(input.props.autoComplete).toBe('email');
    });

    it('input de senha deve ter secureTextEntry', () => {
      const { getByPlaceholderText } = render(<Register />);
      const passwordInput = getByPlaceholderText('Mínimo 6 caracteres');

      expect(passwordInput.props.secureTextEntry).toBe(true);
      expect(passwordInput.props.autoComplete).toBe('password');
    });

    it('input de confirmar senha deve ter secureTextEntry', () => {
      const { getByPlaceholderText } = render(<Register />);
      const confirmInput = getByPlaceholderText('Digite a senha novamente');

      expect(confirmInput.props.secureTextEntry).toBe(true);
    });
  });

  describe('Estado Inicial', () => {
    it('deve começar com tipo motorista selecionado', () => {
      const { getByPlaceholderText, getAllByText } = render(<Register />);

      // Preenche todos campos e submete
      fireEvent.changeText(getByPlaceholderText('Digite seu nome'), 'João Silva');
      fireEvent.changeText(getByPlaceholderText('Digite seu e-mail'), 'joao@exemplo.com');
      fireEvent.changeText(getByPlaceholderText('Mínimo 6 caracteres'), '123456');
      fireEvent.changeText(getByPlaceholderText('Digite a senha novamente'), '123456');
      fireEvent.press(getAllByText('Criar Conta')[1]);

      // Verifica que foi chamado com motorista (padrão)
      expect(authService.signUp).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
        'motorista'
      );
    });

    it('todos os campos devem começar vazios', () => {
      const { getByPlaceholderText } = render(<Register />);

      expect(getByPlaceholderText('Digite seu nome').props.value).toBe('');
      expect(getByPlaceholderText('Digite seu e-mail').props.value).toBe('');
      expect(getByPlaceholderText('Mínimo 6 caracteres').props.value).toBe('');
      expect(getByPlaceholderText('Digite a senha novamente').props.value).toBe('');
    });

    it('não deve estar em loading inicialmente', () => {
      const { getAllByText } = render(<Register />);

      // Ambos título e botão estão presentes
      expect(getAllByText('Criar Conta').length).toBe(2);
    });
  });
});
