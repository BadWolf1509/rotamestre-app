import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { authService } from '@/lib/auth';
import { FalhaAoCarregarPerfil } from '@/lib/auth/falhaPerfil';

import Login from '../login';

const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: jest.fn(),
    back: jest.fn(),
  }),
}));

jest.mock('@/lib/auth', () => ({
  authService: {
    signIn: jest.fn(),
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
}));

const mockAuth = authService as jest.Mocked<typeof authService>;

describe('portão de onboarding em app/auth/login', () => {
  beforeEach(() => jest.clearAllMocks());

  it('manda para o onboarding quando o login autentica mas não há perfil', async () => {
    mockAuth.signIn.mockResolvedValue({ usuario: null } as never);

    const { getByPlaceholderText, getByText, queryByText } = render(<Login />);

    fireEvent.changeText(
      getByPlaceholderText('seu@email.com'),
      'sememail@rotamestre.com',
    );
    fireEvent.changeText(getByPlaceholderText('••••••••'), 'senha123');
    fireEvent.press(getByText('Entrar'));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/onboarding/criar-unidade');
    });

    // Regressão: a senha foi aceita (sessão válida), então devolver a pessoa
    // para o login com um alerta é exatamente o beco sem saída que travou 5
    // pessoas reais — esta branch existe para eliminar esse caminho.
    expect(queryByText('Usuário não encontrado')).toBeNull();
    expect(mockReplace).not.toHaveBeenCalledWith('/auth/login');
  });

  it('mantém o destino de gestor quando o login autentica e há perfil', async () => {
    mockAuth.signIn.mockResolvedValue({
      usuario: { id: 'u1', papel: 'gestor', primeira_senha: false },
    } as never);

    const { getByPlaceholderText, getByText } = render(<Login />);

    fireEvent.changeText(
      getByPlaceholderText('seu@email.com'),
      'gestor@rotamestre.com',
    );
    fireEvent.changeText(getByPlaceholderText('••••••••'), 'senha123');
    fireEvent.press(getByText('Entrar'));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/gestor/inicio');
    });
    expect(mockReplace).not.toHaveBeenCalledWith('/onboarding/criar-unidade');
  });

  // Contrato com `authService.signIn`: falha ao buscar o perfil agora
  // REJEITA (antes virava `usuario: null` e caía no ramo do onboarding acima).
  // Aqui só se fixa que a rejeição não leva ao onboarding.
  it('falha ao buscar o perfil não manda ao onboarding e diz o que houve', async () => {
    mockAuth.signIn.mockRejectedValue(
      new FalhaAoCarregarPerfil('sem resposta', {
        transitoria: true,
        status: 0,
      }),
    );

    const { getByPlaceholderText, getByText, findByText } = render(<Login />);

    fireEvent.changeText(
      getByPlaceholderText('seu@email.com'),
      'motorista@rotamestre.com',
    );
    fireEvent.changeText(getByPlaceholderText('••••••••'), 'senha123');
    fireEvent.press(getByText('Entrar'));

    await waitFor(() => expect(mockAuth.signIn).toHaveBeenCalled());
    await waitFor(() => expect(getByText('Entrar')).toBeTruthy());
    expect(mockReplace).not.toHaveBeenCalledWith('/onboarding/criar-unidade');
    // M3: a senha foi aceita — não é "erro de login" genérico.
    expect(
      await findByText(
        'Você entrou, mas não conseguimos carregar seu perfil. Verifique a conexão e tente de novo.',
      ),
    ).toBeTruthy();
  });
});
