/**
 * Trocar senha do gestor.
 *
 * AN7: a conferência da senha atual (`signIn`) dizia "Senha atual incorreta"
 * para QUALQUER falha. AN8: a regra da nova senha agora é a do cadastro (Zod),
 * com erro inline por campo. Roda nos dois layouts (mobile e desktop).
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

import AlterarSenha from '../trocar-senha';

const mockRouter = {
  back: jest.fn(),
  push: jest.fn(),
  replace: jest.fn(),
  canGoBack: jest.fn(() => true),
};
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

let mockIsDesktop = false;
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({ isDesktop: mockIsDesktop }),
}));

jest.mock('@/lib/auth', () => ({
  authService: {
    getSession: jest.fn(),
    signIn: jest.fn(),
    updatePassword: jest.fn(),
  },
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
const NOVA_VALIDA = 'NovaSenha@1';

const textosExibidos = () =>
  [mockShowWarning, mockShowError, mockShowSuccess].flatMap((fn) =>
    fn.mock.calls.flat().filter((a): a is string => typeof a === 'string'),
  );

function preencherESalvar(
  nova = NOVA_VALIDA,
  confirmacao = nova,
  atual = 'antiga123',
) {
  fireEvent.changeText(
    screen.getByPlaceholderText('Digite sua senha atual'),
    atual,
  );
  fireEvent.changeText(
    screen.getByPlaceholderText('Digite a nova senha'),
    nova,
  );
  fireEvent.changeText(
    screen.getByPlaceholderText('Digite a senha novamente'),
    confirmacao,
  );
  // No desktop o título da página também diz "Alterar Senha": o botão é o último.
  const botoes = screen.getAllByText(
    mockIsDesktop ? 'Alterar Senha' : 'Salvar',
  );
  fireEvent.press(botoes[botoes.length - 1]);
}

beforeEach(() => {
  jest.clearAllMocks();
  const { logger } = require('@/lib/logger');
  jest.spyOn(logger, 'error').mockImplementation(() => {});
  jest.spyOn(logger, 'warn').mockImplementation(() => {});
  mockAuth.getSession.mockResolvedValue({
    user: { id: 'g1', email: 'gestor@rotamestre.com' },
  } as never);
  mockAuth.updatePassword.mockResolvedValue(undefined as never);
});

describe.each([
  ['mobile', false],
  ['desktop', true],
])('trocar senha do gestor (%s)', (_nome, desktop) => {
  beforeEach(() => {
    mockIsDesktop = desktop;
  });

  describe('AN7: falha ao conferir a senha atual', () => {
    it('credencial recusada diz "Senha atual incorreta"', async () => {
      mockAuth.signIn.mockRejectedValue(
        new AuthApiError(
          'Invalid login credentials',
          400,
          'invalid_credentials',
        ),
      );
      render(<AlterarSenha />);
      preencherESalvar();

      await waitFor(() =>
        expect(textosExibidos()).toContain('Senha atual incorreta'),
      );
      expect(mockAuth.updatePassword).not.toHaveBeenCalled();
    });

    it('sem rede NÃO diz que a senha está incorreta', async () => {
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

    it('servidor fora NÃO diz que a senha está incorreta', async () => {
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

    it('perfil que não carregou depois da senha aceita segue para a troca', async () => {
      mockAuth.signIn.mockRejectedValue(
        new FalhaAoCarregarPerfil('sem resposta', { transitoria: true }),
      );
      render(<AlterarSenha />);
      preencherESalvar();

      await waitFor(() =>
        expect(mockAuth.updatePassword).toHaveBeenCalledWith(NOVA_VALIDA),
      );
      expect(textosExibidos()).not.toContain('Senha atual incorreta');
    });
  });

  describe('AN8: mesma regra do cadastro, erro inline', () => {
    it.each([
      ['curta', 'Ab@1de', 'Senha deve ter no mínimo 8 caracteres'],
      [
        'sem maiúscula',
        'novasenha@1',
        'Senha deve conter pelo menos uma letra maiúscula',
      ],
      [
        'sem caractere especial',
        'NovaSenha12',
        'Senha deve conter pelo menos um caractere especial (!@#$%...)',
      ],
    ])(
      'recusa nova senha %s antes de ir ao servidor',
      async (_n, nova, msg) => {
        render(<AlterarSenha />);
        preencherESalvar(nova);

        expect(await screen.findByText(msg)).toBeTruthy();
        expect(mockAuth.signIn).not.toHaveBeenCalled();
        expect(mockAuth.updatePassword).not.toHaveBeenCalled();
      },
    );

    it('confirmação diferente mostra o erro inline', async () => {
      render(<AlterarSenha />);
      preencherESalvar(NOVA_VALIDA, 'Outra@12345');

      expect(await screen.findByText('As senhas não coincidem')).toBeTruthy();
      expect(mockAuth.updatePassword).not.toHaveBeenCalled();
    });

    it('nova senha igual à atual é recusada', async () => {
      render(<AlterarSenha />);
      preencherESalvar(NOVA_VALIDA, NOVA_VALIDA, NOVA_VALIDA);

      expect(
        await screen.findByText('A nova senha deve ser diferente da atual'),
      ).toBeTruthy();
      expect(mockAuth.signIn).not.toHaveBeenCalled();
    });

    it('senha válida troca a senha', async () => {
      mockAuth.signIn.mockResolvedValue({} as never);
      render(<AlterarSenha />);
      preencherESalvar();

      await waitFor(() =>
        expect(mockAuth.updatePassword).toHaveBeenCalledWith(NOVA_VALIDA),
      );
    });
  });

  it('Cancelar volta à tela anterior, sem empilhar outro perfil', async () => {
    render(<AlterarSenha />);
    fireEvent.press(await screen.findByText('Cancelar'));

    expect(mockRouter.back).toHaveBeenCalled();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });
});
