/**
 * Primeira senha: é o quarto caminho de troca de senha. Antes chamava
 * `supabase.auth.updateUser` direto (não encerrava as outras sessões, onde
 * quem conhecia a senha temporária seguia logado) e validava por outra regra
 * (`isPasswordValid`), que aceitava 12+ caracteres SEM caractere especial.
 */
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import { authService } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

import FirstPassword from '../first-password';

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn() }),
}));

jest.mock('@/lib/auth', () => ({
  authService: { updatePassword: jest.fn(), signOut: jest.fn() },
}));

jest.mock('@/hooks/useProfile', () => ({
  useProfile: () => ({
    profile: { nome: 'Fulano', papel: 'gestor', primeira_senha: true },
  }),
}));

const mockShowWarning = jest.fn();
const mockShowError = jest.fn();
const mockShowSuccess = jest.fn();
jest.mock('@/hooks/useAlert', () => ({
  useAlert: () => ({
    showWarning: mockShowWarning,
    showError: mockShowError,
    showSuccess: mockShowSuccess,
    AlertDialog: null,
  }),
}));

const mockAuth = authService as jest.Mocked<typeof authService>;
const sb = supabase as jest.Mocked<typeof supabase>;

async function enviar(senha: string, confirmacao = senha) {
  // Espera o usuário carregar (efeito da tela) antes de enviar.
  await waitFor(() => expect(sb.auth.getUser).toHaveBeenCalled());
  await act(async () => {});
  fireEvent.changeText(
    screen.getByPlaceholderText('Digite sua nova senha'),
    senha,
  );
  fireEvent.changeText(
    screen.getByPlaceholderText('Digite novamente sua nova senha'),
    confirmacao,
  );
  fireEvent.press(screen.getByText('Definir Senha e Continuar'));
}

beforeEach(() => {
  jest.clearAllMocks();
  const { logger } = require('@/lib/logger');
  jest.spyOn(logger, 'error').mockImplementation(() => {});
  jest.spyOn(logger, 'warn').mockImplementation(() => {});
  sb.auth.getUser.mockResolvedValue({
    data: { user: { id: 'u1' } },
    error: null,
  } as never);
  sb.auth.getSession.mockResolvedValue({
    data: { session: { user: { id: 'u1' } } },
    error: null,
  } as never);
  sb.auth.updateUser.mockResolvedValue({ data: {}, error: null } as never);
  const cadeia = {
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockResolvedValue({ error: null }),
  };
  sb.from.mockReturnValue(cadeia as never);
  mockAuth.updatePassword.mockResolvedValue(undefined as never);
});

describe('primeira senha', () => {
  it('troca pela authService.updatePassword (que encerra as outras sessões), não pelo supabase direto', async () => {
    render(<FirstPassword />);
    await enviar('NovaSenha@123');

    await waitFor(() =>
      expect(mockAuth.updatePassword).toHaveBeenCalledWith('NovaSenha@123'),
    );
    expect(sb.auth.updateUser).not.toHaveBeenCalled();
  });

  it('usa a regra única: 12+ caracteres sem caractere especial é recusada', async () => {
    render(<FirstPassword />);
    await enviar('NovaSenha12345');

    await waitFor(() => expect(mockShowWarning).toHaveBeenCalled());
    expect(mockShowWarning.mock.calls[0][0]).toBe('Senha Fraca');
    expect(mockShowWarning.mock.calls[0][1]).toBe(
      'Senha deve conter pelo menos um caractere especial (!@#$%...)',
    );
    expect(mockAuth.updatePassword).not.toHaveBeenCalled();
  });

  it('senha igual à temporária continua com o aviso próprio', async () => {
    mockAuth.updatePassword.mockRejectedValue(
      new Error('New password should be different from the old password.'),
    );
    render(<FirstPassword />);
    await enviar('NovaSenha@123');

    await waitFor(() =>
      expect(mockShowWarning).toHaveBeenCalledWith(
        'Senha Inválida',
        expect.stringContaining('senha temporária'),
      ),
    );
    expect(mockShowError).not.toHaveBeenCalled();
  });
});
