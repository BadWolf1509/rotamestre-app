/**
 * Alterar senha do motorista: a senha atual é conferida com `signIn`. Antes,
 * QUALQUER falha dele virava "Senha atual incorreta" — inclusive falta de
 * rede e a busca do perfil falhando depois de a senha ter sido ACEITA.
 */
import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import { authService } from '@/lib/auth';
import { FalhaAoCarregarPerfil } from '@/lib/auth/falhaPerfil';

import AlterarSenha from '../senha';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
}));

jest.mock('@/lib/auth', () => ({
  authService: {
    getSession: jest.fn(),
    signIn: jest.fn(),
    updatePassword: jest.fn(),
  },
}));

// O Dialog real não desenha no Jest; as mensagens são lidas das chamadas.
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

/** Todos os textos (título e mensagem) que a tela tentou mostrar. */
const textosExibidos = () =>
  [mockShowWarning, mockShowError, mockShowSuccess].flatMap((fn) =>
    fn.mock.calls.flat().filter((a): a is string => typeof a === 'string'),
  );

function preencherESalvar() {
  fireEvent.changeText(
    screen.getByPlaceholderText('Digite sua senha atual'),
    'antiga123',
  );
  fireEvent.changeText(
    screen.getByPlaceholderText('Digite a nova senha'),
    'NovaSenha1',
  );
  fireEvent.changeText(
    screen.getByPlaceholderText('Digite a senha novamente'),
    'NovaSenha1',
  );
  fireEvent.press(screen.getByText('Salvar'));
}

beforeEach(() => {
  jest.clearAllMocks();
  const { logger } = require('@/lib/logger');
  jest.spyOn(logger, 'error').mockImplementation(() => {});
  mockAuth.getSession.mockResolvedValue({
    user: { id: 'm1', email: 'motorista@rotamestre.com' },
  } as never);
  mockAuth.updatePassword.mockResolvedValue(undefined as never);
});

describe('alterar senha: falha ao conferir a senha atual', () => {
  it('credencial errada continua dizendo "Senha atual incorreta"', async () => {
    mockAuth.signIn.mockRejectedValue(
      new AuthApiError('Invalid login credentials', 400, 'invalid_credentials'),
    );
    render(<AlterarSenha />);

    preencherESalvar();

    await waitFor(() =>
      expect(textosExibidos()).toContain('Senha atual incorreta'),
    );
    expect(mockAuth.updatePassword).not.toHaveBeenCalled();
  });

  it('sem rede diz que não conseguiu conferir, não que a senha está errada', async () => {
    mockAuth.signIn.mockRejectedValue(
      new AuthRetryableFetchError('Failed to fetch', 0),
    );
    render(<AlterarSenha />);

    preencherESalvar();

    await waitFor(() =>
      expect(textosExibidos()).toContain(
        'Não foi possível conferir sua senha atual. Verifique a conexão e tente de novo.',
      ),
    );
    expect(textosExibidos()).not.toContain('Senha atual incorreta');
    expect(mockAuth.updatePassword).not.toHaveBeenCalled();
  });

  // A senha foi ACEITA (a sessão foi criada); só o perfil não carregou, e
  // trocar a senha não depende dele.
  it('perfil não carregado depois da senha aceita segue para a troca', async () => {
    mockAuth.signIn.mockRejectedValue(
      new FalhaAoCarregarPerfil('sem resposta', {
        transitoria: true,
        status: 0,
      }),
    );
    render(<AlterarSenha />);

    preencherESalvar();

    await waitFor(() =>
      expect(mockAuth.updatePassword).toHaveBeenCalledWith('NovaSenha1'),
    );
    expect(textosExibidos()).not.toContain('Senha atual incorreta');
  });
});
