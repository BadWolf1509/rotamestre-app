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

// Respostas, em ordem, do UPDATE de `primeira_senha` (update → eq → select).
let mockMarcacao: jest.Mock;
function prepararMarcacao(respostas: { data: unknown; error: unknown }[]) {
  mockMarcacao = jest.fn();
  for (const resposta of respostas)
    mockMarcacao.mockResolvedValueOnce(resposta);
  const cadeia = {
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    select: mockMarcacao,
  };
  sb.from.mockReturnValue(cadeia as never);
}

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
  prepararMarcacao([{ data: [{ id: 'u1' }], error: null }]);
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

    // Erro no campo (Zod + useForm), não em diálogo.
    expect(
      await screen.findByText(
        'Senha deve conter pelo menos um caractere especial (!@#$%...)',
      ),
    ).toBeTruthy();
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

  it('confirmação diferente mostra o erro no campo e não troca', async () => {
    render(<FirstPassword />);
    await enviar('NovaSenha@123', 'NovaSenha@124');

    expect(
      (await screen.findAllByText('As senhas não coincidem')).length,
    ).toBeGreaterThan(0);
    expect(mockAuth.updatePassword).not.toHaveBeenCalled();
  });

  it.each([
    ['erro do banco', { data: null, error: { code: '42501', message: 'x' } }],
    ['zero linhas (RLS)', { data: [], error: null }],
  ])(
    'falha ao registrar a troca (%s) não anuncia sucesso; tentar de novo não troca a senha outra vez',
    async (_caso, falha) => {
      prepararMarcacao([falha, { data: [{ id: 'u1' }], error: null }]);
      render(<FirstPassword />);
      await enviar('NovaSenha@123');

      await waitFor(() => expect(mockShowError).toHaveBeenCalled());
      expect(mockShowSuccess).not.toHaveBeenCalled();

      fireEvent.press(screen.getByText('Definir Senha e Continuar'));

      await waitFor(() => expect(mockShowSuccess).toHaveBeenCalled());
      expect(mockAuth.updatePassword).toHaveBeenCalledTimes(1);
      expect(mockMarcacao).toHaveBeenCalledTimes(2);
    },
  );
});
