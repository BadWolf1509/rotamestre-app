import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

import { authService } from '@/lib/auth';
import {
  confirmationResendRateLimiter,
  loginRateLimiter,
} from '@/lib/rateLimiter';

import Login from '../../../auth/login';

// Mock do Alert está configurado globalmente no jest.setup.js
// Acessar via global.mockAlert
const _Alert = { alert: (global as any).mockAlert };

// Mock do expo-router já está configurado globalmente no jest.setup.js
const mockRouter = require('expo-router').useRouter();

// Mock do authService
jest.mock('@/lib/auth', () => ({
  authService: {
    signIn: jest.fn(),
    resendConfirmation: jest.fn(),
  },
}));

jest.mock('@/lib/rateLimiter', () => ({
  loginRateLimiter: {
    checkLimit: jest.fn().mockResolvedValue({
      allowed: true,
      remainingAttempts: 5,
      retryAfterMs: null,
      message: null,
    }),
    recordAttempt: jest.fn().mockResolvedValue(undefined),
  },
  confirmationResendRateLimiter: {
    checkLimit: jest.fn().mockResolvedValue({
      allowed: true,
      remainingAttempts: 5,
      retryAfterMs: null,
      message: null,
    }),
    recordAttempt: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('Login Screen - Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Limpar também o mock do Alert
    (global as any).mockAlert.mockClear();
  });

  // ============================================
  // GRUPO 1: Renderização e Elementos da UI
  // ============================================
  describe('Renderização e UI', () => {
    it('deve renderizar corretamente no mobile', () => {
      const { getByPlaceholderText, getByText, getAllByText } = render(
        <Login />,
      );

      expect(getByPlaceholderText('seu@email.com')).toBeTruthy();
      expect(getByPlaceholderText('••••••••')).toBeTruthy();
      expect(getByText('Entrar')).toBeTruthy();
      expect(getByText('Esqueceu a senha?')).toBeTruthy();
      expect(getByText('Bem-vindo de volta!')).toBeTruthy();
      expect(getByText('Entre com sua conta')).toBeTruthy();
      // WCAG 1.3.1: Labels are now visible Text elements above inputs
      expect(getAllByText('E-mail').length).toBeGreaterThanOrEqual(1);
      expect(getAllByText('Senha').length).toBeGreaterThanOrEqual(1);
    });

    it('deve exibir campos de entrada vazios inicialmente', () => {
      const { getByPlaceholderText } = render(<Login />);

      const emailInput = getByPlaceholderText('seu@email.com');
      const passwordInput = getByPlaceholderText('••••••••');

      expect(emailInput.props.value).toBe('');
      expect(passwordInput.props.value).toBe('');
    });

    it('deve ter botão "Esqueceu a senha?" visível', () => {
      const { getByText } = render(<Login />);

      const forgotButton = getByText('Esqueceu a senha?');
      expect(forgotButton).toBeTruthy();
    });
  });

  // ============================================
  // GRUPO 2: Validação de Entrada
  // ============================================
  describe('Validação de Entrada', () => {
    it('deve atualizar o campo de email ao digitar', () => {
      const { getByPlaceholderText } = render(<Login />);

      const emailInput = getByPlaceholderText('seu@email.com');
      fireEvent.changeText(emailInput, 'teste@rotamestre.com');

      expect(emailInput.props.value).toBe('teste@rotamestre.com');
    });

    it('deve atualizar o campo de senha ao digitar', () => {
      const { getByPlaceholderText } = render(<Login />);

      const passwordInput = getByPlaceholderText('••••••••');
      fireEvent.changeText(passwordInput, 'senha123');

      expect(passwordInput.props.value).toBe('senha123');
    });

    it('deve exibir erro inline quando campos estão vazios', async () => {
      const { getByText } = render(<Login />);

      const loginButton = getByText('Entrar');
      fireEvent.press(loginButton);

      await waitFor(() => {
        expect(getByText('E-mail é obrigatório')).toBeTruthy();
        expect(getByText('Senha é obrigatória')).toBeTruthy();
      });
    });

    it('deve exibir erro inline quando email está vazio', async () => {
      const { getByPlaceholderText, getByText } = render(<Login />);

      const passwordInput = getByPlaceholderText('••••••••');
      fireEvent.changeText(passwordInput, 'senha123');

      const loginButton = getByText('Entrar');
      fireEvent.press(loginButton);

      await waitFor(() => {
        expect(getByText('E-mail é obrigatório')).toBeTruthy();
      });
    });

    it('deve exibir erro inline quando senha está vazia', async () => {
      const { getByPlaceholderText, getByText } = render(<Login />);

      const emailInput = getByPlaceholderText('seu@email.com');
      fireEvent.changeText(emailInput, 'teste@rotamestre.com');

      const loginButton = getByText('Entrar');
      fireEvent.press(loginButton);

      await waitFor(() => {
        expect(getByText('Senha é obrigatória')).toBeTruthy();
      });
    });

    it('deve exibir erro inline quando email é inválido', async () => {
      const { getByPlaceholderText, getByText } = render(<Login />);

      const emailInput = getByPlaceholderText('seu@email.com');
      const passwordInput = getByPlaceholderText('••••••••');
      fireEvent.changeText(emailInput, 'emailinvalido');
      fireEvent.changeText(passwordInput, 'senha123');

      const loginButton = getByText('Entrar');
      fireEvent.press(loginButton);

      await waitFor(() => {
        expect(getByText('E-mail inválido')).toBeTruthy();
      });
      expect(authService.signIn).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // GRUPO 3: Fluxo de Login Bem-Sucedido
  // ============================================
  describe('Login Bem-Sucedido', () => {
    it('deve fazer login com sucesso como gestor', async () => {
      const mockGestor = {
        id: 'gestor-123',
        email: 'gestor@rotamestre.com',
        nome: 'Gestor Teste',
        papel: 'gestor',
        primeira_senha: false,
      };

      (authService.signIn as jest.Mock).mockResolvedValue({
        usuario: mockGestor,
      });

      const { getByPlaceholderText, getByText } = render(<Login />);

      const emailInput = getByPlaceholderText('seu@email.com');
      const passwordInput = getByPlaceholderText('••••••••');

      fireEvent.changeText(emailInput, 'gestor@rotamestre.com');
      fireEvent.changeText(passwordInput, 'senha123');

      const loginButton = getByText('Entrar');
      fireEvent.press(loginButton);

      await waitFor(() => {
        expect(authService.signIn).toHaveBeenCalledWith(
          'gestor@rotamestre.com',
          'senha123',
        );
        expect(mockRouter.replace).toHaveBeenCalledWith('/gestor/inicio');
      });
    });

    it('deve fazer login com sucesso como motorista', async () => {
      const mockMotorista = {
        id: 'motorista-123',
        email: 'motorista@rotamestre.com',
        nome: 'Motorista Teste',
        papel: 'motorista',
        primeira_senha: false,
      };

      (authService.signIn as jest.Mock).mockResolvedValue({
        usuario: mockMotorista,
      });

      const { getByPlaceholderText, getByText } = render(<Login />);

      const emailInput = getByPlaceholderText('seu@email.com');
      const passwordInput = getByPlaceholderText('••••••••');

      fireEvent.changeText(emailInput, 'motorista@rotamestre.com');
      fireEvent.changeText(passwordInput, 'senha123');

      const loginButton = getByText('Entrar');
      fireEvent.press(loginButton);

      await waitFor(() => {
        expect(authService.signIn).toHaveBeenCalledWith(
          'motorista@rotamestre.com',
          'senha123',
        );
        expect(mockRouter.replace).toHaveBeenCalledWith('/motorista');
      });
    });

    it('deve redirecionar para troca de senha no primeiro acesso', async () => {
      const mockUsuarioPrimeiroAcesso = {
        id: 'usuario-123',
        email: 'novo@rotamestre.com',
        nome: 'Novo Usuário',
        papel: 'gestor',
        primeira_senha: true,
      };

      (authService.signIn as jest.Mock).mockResolvedValue({
        usuario: mockUsuarioPrimeiroAcesso,
      });

      const { getByPlaceholderText, getByText } = render(<Login />);

      const emailInput = getByPlaceholderText('seu@email.com');
      const passwordInput = getByPlaceholderText('••••••••');

      fireEvent.changeText(emailInput, 'novo@rotamestre.com');
      fireEvent.changeText(passwordInput, 'senhaTemporaria');

      const loginButton = getByText('Entrar');
      fireEvent.press(loginButton);

      await waitFor(() => {
        expect(mockRouter.replace).toHaveBeenCalledWith(
          '/onboarding/first-password',
        );
      });
    });
  });

  // ============================================
  // GRUPO 4: Tratamento de Erros
  // ============================================
  describe('Tratamento de Erros', () => {
    it('deve exibir erro quando credenciais são inválidas', async () => {
      (authService.signIn as jest.Mock).mockRejectedValue(
        new Error('Invalid login credentials'),
      );

      const { getByPlaceholderText, getByText } = render(<Login />);

      const emailInput = getByPlaceholderText('seu@email.com');
      const passwordInput = getByPlaceholderText('••••••••');

      fireEvent.changeText(emailInput, 'erro@rotamestre.com');
      fireEvent.changeText(passwordInput, 'senhaerrada');

      const loginButton = getByText('Entrar');
      fireEvent.press(loginButton);

      await waitFor(() => {
        expect(getByText('E-mail ou senha incorretos')).toBeTruthy();
        expect(
          getByText('Verifique seus dados e tente novamente.'),
        ).toBeTruthy();
        expect(loginRateLimiter.recordAttempt).toHaveBeenCalledWith(
          'erro@rotamestre.com',
          false,
        );
      });
    });

    it('não deve penalizar o usuário quando a chave do serviço está inválida', async () => {
      (authService.signIn as jest.Mock).mockRejectedValue(
        new Error('Legacy API keys are disabled'),
      );

      const { getByPlaceholderText, getByText } = render(<Login />);

      fireEvent.changeText(
        getByPlaceholderText('seu@email.com'),
        'gestor@rotamestre.com',
      );
      fireEvent.changeText(getByPlaceholderText('••••••••'), 'senha-correta');
      fireEvent.press(getByText('Entrar'));

      await waitFor(() => {
        expect(getByText('Serviço temporariamente indisponível')).toBeTruthy();
        expect(
          getByText(
            'Não foi possível conectar ao serviço. Tente novamente em alguns minutos.',
          ),
        ).toBeTruthy();
      });

      expect(loginRateLimiter.recordAttempt).not.toHaveBeenCalledWith(
        'gestor@rotamestre.com',
        false,
      );
    });

    it('deve exibir erro genérico quando ocorre erro desconhecido', async () => {
      (authService.signIn as jest.Mock).mockRejectedValue(new Error());

      const { getByPlaceholderText, getByText } = render(<Login />);

      const emailInput = getByPlaceholderText('seu@email.com');
      const passwordInput = getByPlaceholderText('••••••••');

      fireEvent.changeText(emailInput, 'teste@rotamestre.com');
      fireEvent.changeText(passwordInput, 'senha123');

      const loginButton = getByText('Entrar');
      fireEvent.press(loginButton);

      await waitFor(() => {
        expect(getByText('Algo deu errado')).toBeTruthy();
        expect(
          getByText(
            'Ocorreu um erro inesperado. Tente novamente ou contate o suporte.',
          ),
        ).toBeTruthy();
      });
    });

    it('deve redirecionar para o onboarding quando o perfil não é encontrado', async () => {
      (authService.signIn as jest.Mock).mockResolvedValue({
        usuario: null,
      });

      const { getByPlaceholderText, getByText, queryByText } = render(
        <Login />,
      );

      const emailInput = getByPlaceholderText('seu@email.com');
      const passwordInput = getByPlaceholderText('••••••••');

      fireEvent.changeText(emailInput, 'naoexiste@rotamestre.com');
      fireEvent.changeText(passwordInput, 'senha123');

      const loginButton = getByText('Entrar');
      fireEvent.press(loginButton);

      await waitFor(() => {
        expect(mockRouter.replace).toHaveBeenCalledWith(
          '/onboarding/criar-unidade',
        );
        expect(loginRateLimiter.recordAttempt).toHaveBeenCalledWith(
          'naoexiste@rotamestre.com',
          true,
        );
      });
      // Regressão: sessão válida sem perfil não pode mais devolver a pessoa
      // para a tela de login com um alerta — esse era o beco sem saída que
      // esta branch (onboarding self-service) existe para eliminar.
      expect(queryByText('Usuário não encontrado')).toBeNull();
    });
  });

  // ============================================
  // GRUPO 5: Estado de Loading
  // ============================================
  describe('Estado de Loading', () => {
    it('deve chamar serviço durante loading', async () => {
      (authService.signIn as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  usuario: {
                    id: 'gestor-123',
                    papel: 'gestor',
                    primeira_senha: false,
                  },
                }),
              100,
            ),
          ),
      );

      const { getByPlaceholderText, getByText } = render(<Login />);

      const emailInput = getByPlaceholderText('seu@email.com');
      const passwordInput = getByPlaceholderText('••••••••');

      fireEvent.changeText(emailInput, 'gestor@rotamestre.com');
      fireEvent.changeText(passwordInput, 'senha123');

      const loginButton = getByText('Entrar');
      fireEvent.press(loginButton);

      // Esperar o serviço ser chamado para confirmar que loading começou
      await waitFor(() => {
        expect(authService.signIn).toHaveBeenCalledWith(
          'gestor@rotamestre.com',
          'senha123',
        );
      });
    });

    it('deve chamar authService ao fazer login', async () => {
      (authService.signIn as jest.Mock).mockResolvedValue({
        usuario: {
          id: 'gestor-123',
          papel: 'gestor',
          primeira_senha: false,
        },
      });

      const { getByPlaceholderText, getByText } = render(<Login />);

      const emailInput = getByPlaceholderText('seu@email.com');
      const passwordInput = getByPlaceholderText('••••••••');

      fireEvent.changeText(emailInput, 'gestor@rotamestre.com');
      fireEvent.changeText(passwordInput, 'senha123');

      const loginButton = getByText('Entrar');
      fireEvent.press(loginButton);

      await waitFor(() => {
        expect(authService.signIn).toHaveBeenCalledWith(
          'gestor@rotamestre.com',
          'senha123',
        );
        expect(mockRouter.replace).toHaveBeenCalled();
      });
    });

    it('deve exibir Alert após tratamento de erro', async () => {
      (authService.signIn as jest.Mock).mockRejectedValue(
        new Error('Erro de teste'),
      );

      const { getByPlaceholderText, getByText } = render(<Login />);

      const emailInput = getByPlaceholderText('seu@email.com');
      const passwordInput = getByPlaceholderText('••••••••');

      fireEvent.changeText(emailInput, 'teste@rotamestre.com');
      fireEvent.changeText(passwordInput, 'senha123');

      const loginButton = getByText('Entrar');
      fireEvent.press(loginButton);

      await waitFor(() => {
        expect(authService.signIn).toHaveBeenCalled();
        expect(getByText('Algo deu errado')).toBeTruthy();
      });
    });
  });

  // ============================================
  // GRUPO 6: Navegação
  // ============================================
  describe('Navegação', () => {
    it('deve navegar para tela de recuperação de senha', () => {
      const { getByText } = render(<Login />);

      const forgotButton = getByText('Esqueceu a senha?');
      fireEvent.press(forgotButton);

      expect(mockRouter.push).toHaveBeenCalledWith('/auth/forgot-password');
    });

    it('deve navegar para tela de registro ao clicar em "Solicitar acesso"', () => {
      const { getByText } = render(<Login />);

      const registerLink = getByText('Solicitar acesso');
      fireEvent.press(registerLink);

      expect(mockRouter.push).toHaveBeenCalledWith('/auth/register');
    });

    it('não deve navegar quando login falha', async () => {
      (authService.signIn as jest.Mock).mockRejectedValue(
        new Error('Invalid login credentials'),
      );

      const { getByPlaceholderText, getByText } = render(<Login />);

      const emailInput = getByPlaceholderText('seu@email.com');
      const passwordInput = getByPlaceholderText('••••••••');

      fireEvent.changeText(emailInput, 'erro@rotamestre.com');
      fireEvent.changeText(passwordInput, 'senhaerrada');

      const loginButton = getByText('Entrar');
      fireEvent.press(loginButton);

      await waitFor(() => {
        expect(getByText('E-mail ou senha incorretos')).toBeTruthy();
      });

      expect(mockRouter.replace).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // GRUPO 7: Casos de Borda
  // ============================================
  describe('Casos de Borda', () => {
    it('aceita email com espaços ao redor e normaliza antes do authService', async () => {
      (authService.signIn as jest.Mock).mockResolvedValue({
        usuario: { id: 'gestor-123', papel: 'gestor', primeira_senha: false },
      });

      const { getByPlaceholderText, getByText } = render(<Login />);

      const emailInput = getByPlaceholderText('seu@email.com');
      const passwordInput = getByPlaceholderText('••••••••');

      // emailSchema apara (trim) e normaliza (lowercase) antes de validar,
      // então o authService recebe o email já limpo.
      fireEvent.changeText(emailInput, '  gestor@rotamestre.com  ');
      fireEvent.changeText(passwordInput, 'senha123');

      const loginButton = getByText('Entrar');
      fireEvent.press(loginButton);

      await waitFor(() => {
        expect(authService.signIn).toHaveBeenCalledWith(
          'gestor@rotamestre.com',
          'senha123',
        );
      });
    });

    it('deve permitir múltiplas tentativas de login após erro', async () => {
      // Configurar mock para duas chamadas: primeira falha, segunda sucesso
      (authService.signIn as jest.Mock)
        .mockRejectedValueOnce(new Error('Invalid login credentials'))
        .mockResolvedValueOnce({
          usuario: {
            id: 'gestor-123',
            papel: 'gestor',
            primeira_senha: false,
          },
        });

      const { getByPlaceholderText, getByText } = render(<Login />);

      const emailInput = getByPlaceholderText('seu@email.com');
      const passwordInput = getByPlaceholderText('••••••••');
      let loginButton = getByText('Entrar');

      // Primeira tentativa - erro
      fireEvent.changeText(emailInput, 'teste@rotamestre.com');
      fireEvent.changeText(passwordInput, 'senhaerrada');
      fireEvent.press(loginButton);

      await waitFor(() => {
        expect(getByText('E-mail ou senha incorretos')).toBeTruthy();
        expect(authService.signIn).toHaveBeenCalledTimes(1);
      });

      // Aguardar componente processar o erro e limpar loading
      await waitFor(() => {
        loginButton = getByText('Entrar');
        expect(loginButton).toBeTruthy();
      });

      // Segunda tentativa - sucesso
      fireEvent.changeText(passwordInput, 'senhacorreta');
      fireEvent.press(loginButton);

      await waitFor(() => {
        expect(authService.signIn).toHaveBeenCalledTimes(2);
        expect(mockRouter.replace).toHaveBeenCalledWith('/gestor/inicio');
      });
    });
  });

  // ============================================
  // GRUPO 8: Reenvio da confirmação de cadastro
  // ============================================
  describe('Reenvio da confirmação de cadastro', () => {
    /** Leva o login até o erro "email não confirmado". */
    async function chegarAoErroDeConfirmacao(
      email = 'naoconfirmado@rotamestre.com',
    ) {
      (authService.signIn as jest.Mock).mockRejectedValue(
        new Error('Email not confirmed'),
      );

      const tela = render(<Login />);

      fireEvent.changeText(tela.getByPlaceholderText('seu@email.com'), email);
      fireEvent.changeText(tela.getByPlaceholderText('••••••••'), 'senha123');
      fireEvent.press(tela.getByText('Entrar'));

      await waitFor(() => {
        expect(tela.getByText('E-mail não confirmado')).toBeTruthy();
      });

      return tela;
    }

    it('oferece reenviar o email quando a conta não foi confirmada', async () => {
      const { getByText } = await chegarAoErroDeConfirmacao();

      expect(getByText('Reenviar email')).toBeTruthy();
    });

    // O beco sem saída que este grupo existe para eliminar: antes, a única
    // resposta era "verifique sua caixa de entrada" — inútil se o link expirou.
    it('não oferece reenvio em erro de credencial inválida', async () => {
      (authService.signIn as jest.Mock).mockRejectedValue(
        new Error('Invalid login credentials'),
      );

      const { getByPlaceholderText, getByText, queryByText } = render(
        <Login />,
      );

      fireEvent.changeText(
        getByPlaceholderText('seu@email.com'),
        'erro@rotamestre.com',
      );
      fireEvent.changeText(getByPlaceholderText('••••••••'), 'senhaerrada');
      fireEvent.press(getByText('Entrar'));

      await waitFor(() => {
        expect(getByText('E-mail ou senha incorretos')).toBeTruthy();
      });
      expect(queryByText('Reenviar email')).toBeNull();
    });

    it('reenvia para o email digitado, em minúsculas', async () => {
      (authService.resendConfirmation as jest.Mock).mockResolvedValue(
        undefined,
      );

      const { getByText } = await chegarAoErroDeConfirmacao(
        'NaoConfirmado@Rotamestre.com',
      );

      fireEvent.press(getByText('Reenviar email'));

      await waitFor(() => {
        expect(authService.resendConfirmation).toHaveBeenCalledWith(
          'naoconfirmado@rotamestre.com',
        );
      });
    });

    it('confirma o envio e registra no limitador', async () => {
      (authService.resendConfirmation as jest.Mock).mockResolvedValue(
        undefined,
      );

      const { getByText } = await chegarAoErroDeConfirmacao();

      fireEvent.press(getByText('Reenviar email'));

      await waitFor(() => {
        expect(getByText('Email enviado!')).toBeTruthy();
        expect(
          confirmationResendRateLimiter.recordAttempt,
        ).toHaveBeenCalledWith('naoconfirmado@rotamestre.com', true);
      });
    });

    it('bloqueia quando o limitador local recusa, sem chamar o Supabase', async () => {
      (
        confirmationResendRateLimiter.checkLimit as jest.Mock
      ).mockResolvedValueOnce({
        allowed: false,
        remainingAttempts: 0,
        retryAfterMs: 300000,
        message: 'Muitos envios. Aguarde 5 minutos.',
      });

      const { getByText } = await chegarAoErroDeConfirmacao();

      fireEvent.press(getByText('Reenviar email'));

      await waitFor(() => {
        expect(getByText('Aguarde')).toBeTruthy();
      });
      expect(authService.resendConfirmation).not.toHaveBeenCalled();
    });

    // 429 não é erro do usuário: o email já saiu. Tratar como falha faria a
    // pessoa achar que precisa tentar de novo.
    it('trata 429 do Supabase como email já enviado', async () => {
      (authService.resendConfirmation as jest.Mock).mockRejectedValue(
        new Error('email rate limit exceeded'),
      );

      const { getByText } = await chegarAoErroDeConfirmacao();

      fireEvent.press(getByText('Reenviar email'));

      await waitFor(() => {
        expect(getByText('Email já enviado')).toBeTruthy();
      });
    });

    // Cenário real: um scanner de email abriu o link e confirmou a conta entre
    // a tentativa de login e o clique em reenviar.
    it('avisa quando a conta já foi confirmada nesse meio-tempo', async () => {
      (authService.resendConfirmation as jest.Mock).mockRejectedValue(
        new Error('Email link is invalid or user already confirmed'),
      );

      const { getByText } = await chegarAoErroDeConfirmacao();

      fireEvent.press(getByText('Reenviar email'));

      await waitFor(() => {
        expect(getByText('Conta já confirmada')).toBeTruthy();
      });
    });

    it('é honesto quando o envio falha no servidor de email', async () => {
      (authService.resendConfirmation as jest.Mock).mockRejectedValue(
        new Error('Error sending confirmation email'),
      );

      const { getByText } = await chegarAoErroDeConfirmacao();

      fireEvent.press(getByText('Reenviar email'));

      await waitFor(() => {
        expect(getByText('Falha ao enviar')).toBeTruthy();
      });
    });
  });
});
