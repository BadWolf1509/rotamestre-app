/**
 * AN10 na tela: o limite de cadastro só registra a tentativa que chegou ao
 * servidor e foi recusada por abuso ou pelo e-mail. Rede e senha fraca não.
 */
import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { authService } from '@/lib/auth';
import { signupRateLimiter } from '@/lib/rateLimiter';

const Register = require('../register').default;

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), replace: jest.fn() }),
}));

jest.mock('@/lib/auth', () => ({
  authService: { signUp: jest.fn() },
}));

jest.mock('@/lib/rateLimiter', () => ({
  signupRateLimiter: {
    checkLimit: jest.fn(),
    recordAttempt: jest.fn(),
  },
}));

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({ isDesktop: false, isMobile: true, isTablet: false }),
}));

jest.mock('@/components/ResponsiveContainer', () => ({
  ResponsiveContainer: ({ children }: { children: unknown }) => children,
}));

const mockSignUp = authService.signUp as jest.Mock;
const mockCheck = signupRateLimiter.checkLimit as jest.Mock;
const mockRecord = signupRateLimiter.recordAttempt as jest.Mock;

function enviar() {
  const tela = render(<Register />);
  fireEvent.changeText(tela.getByPlaceholderText('Digite seu nome'), 'Fulano Silva');
  fireEvent.changeText(tela.getByPlaceholderText('Digite seu e-mail'), 'fulano@exemplo.com');
  fireEvent.changeText(
    tela.getByPlaceholderText('Mínimo 8 caracteres, maiúscula, número e especial'),
    'Senha@1234',
  );
  fireEvent.changeText(
    tela.getByPlaceholderText('Digite a senha novamente'),
    'Senha@1234',
  );
  const botoes = tela.getAllByText('Criar Conta');
  fireEvent.press(botoes[botoes.length - 1]);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCheck.mockResolvedValue({ allowed: true, message: null });
  mockRecord.mockResolvedValue(undefined);
});

describe('limite de cadastro: o que conta como tentativa', () => {
  it('e-mail já cadastrado conta', async () => {
    mockSignUp.mockRejectedValue(
      new AuthApiError('exists', 422, 'user_already_exists'),
    );
    enviar();

    await waitFor(() =>
      expect(mockRecord).toHaveBeenCalledWith('fulano@exemplo.com', false),
    );
  });

  it('falta de rede NÃO conta', async () => {
    mockSignUp.mockRejectedValue(
      new AuthRetryableFetchError('Failed to fetch', 0),
    );
    enviar();

    await waitFor(() => expect(mockSignUp).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    expect(mockRecord).not.toHaveBeenCalled();
  });

  it('senha fraca recusada pelo servidor NÃO conta', async () => {
    mockSignUp.mockRejectedValue(
      new AuthApiError('weak', 422, 'weak_password'),
    );
    enviar();

    await waitFor(() => expect(mockSignUp).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    expect(mockRecord).not.toHaveBeenCalled();
  });

  it('cadastro bem-sucedido zera o limite (success: true)', async () => {
    mockSignUp.mockResolvedValue({});
    enviar();

    await waitFor(() =>
      expect(mockRecord).toHaveBeenCalledWith('fulano@exemplo.com', true),
    );
  });
});
