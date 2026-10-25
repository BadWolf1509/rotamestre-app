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

const NOVA_VALIDA = 'NovaSenha@1';

function preencherESalvar(nova = NOVA_VALIDA, confirmacao = nova) {
  fireEvent.changeText(
    screen.getByPlaceholderText('Digite sua senha atual'),
    'antiga123',
  );
  fireEvent.changeText(screen.getByPlaceholderText('Digite a nova senha'), nova);
  fireEvent.changeText(
    screen.getByPlaceholderText('Digite a senha novamente'),
    confirmacao,
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
      expect(mockAuth.updatePassword).toHaveBeenCalledWith(NOVA_VALIDA),
    );
    expect(textosExibidos()).not.toContain('Senha atual incorreta');
  });
});

// AN7: o servidor fora não prova que a senha está errada.
describe('alterar senha: servidor fora não vira "senha incorreta"', () => {
  it('erro 5xx do Auth diz que o serviço não respondeu', async () => {
    mockAuth.signIn.mockRejectedValue(
      new AuthApiError('boom', 500, 'unexpected_failure'),
    );
    render(<AlterarSenha />);

    preencherESalvar();

    await waitFor(() =>
      expect(textosExibidos()).toContain('Serviço indisponível'),
    );
    expect(textosExibidos()).not.toContain('Senha atual incorreta');
    expect(mockAuth.updatePassword).not.toHaveBeenCalled();
  });
});

// AN8: a regra da nova senha é a do cadastro, com erro inline por campo.
describe('alterar senha: mesma regra do cadastro (Zod + erro inline)', () => {
  it.each([
    ['6 caracteres (a regra antiga do motorista)', 'Ab@1de', 'Senha deve ter no mínimo 8 caracteres'],
    ['sem maiúscula', 'novasenha@1', 'Senha deve conter pelo menos uma letra maiúscula'],
    ['sem número', 'NovaSenha@a', 'Senha deve conter pelo menos um número'],
    ['sem caractere especial', 'NovaSenha12', 'Senha deve conter pelo menos um caractere especial (!@#$%...)'],
  ])('recusa nova senha %s sem tocar no servidor', async (_n, nova, msg) => {
    render(<AlterarSenha />);

    preencherESalvar(nova);

    expect(await screen.findByText(msg)).toBeTruthy();
    expect(mockAuth.signIn).not.toHaveBeenCalled();
    expect(mockAuth.updatePassword).not.toHaveBeenCalled();
  });

  it('confirmação diferente mostra o erro no campo da confirmação', async () => {
    render(<AlterarSenha />);

    preencherESalvar(NOVA_VALIDA, 'Outra@12345');

    expect(await screen.findByText('As senhas não coincidem')).toBeTruthy();
    expect(mockAuth.updatePassword).not.toHaveBeenCalled();
  });

  it('senha atual vazia mostra o erro no campo', async () => {
    render(<AlterarSenha />);
    fireEvent.press(screen.getByText('Salvar'));

    expect(await screen.findByText('Digite sua senha atual')).toBeTruthy();
    expect(mockAuth.signIn).not.toHaveBeenCalled();
  });

  it('nova senha igual à atual é recusada', async () => {
    render(<AlterarSenha />);
    fireEvent.changeText(
      screen.getByPlaceholderText('Digite sua senha atual'),
      NOVA_VALIDA,
    );
    fireEvent.changeText(
      screen.getByPlaceholderText('Digite a nova senha'),
      NOVA_VALIDA,
    );
    fireEvent.changeText(
      screen.getByPlaceholderText('Digite a senha novamente'),
      NOVA_VALIDA,
    );
    fireEvent.press(screen.getByText('Salvar'));

    expect(
      await screen.findByText('A nova senha deve ser diferente da atual'),
    ).toBeTruthy();
    expect(mockAuth.signIn).not.toHaveBeenCalled();
  });
});
