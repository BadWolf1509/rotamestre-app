/**
 * "Sair" tira o token de push do banco com a sessão AINDA viva e depois limpa
 * o estado local da conta.
 *
 * O token era removido no evento SIGNED_OUT, que o supabase-js dispara DEPOIS
 * de apagar a sessão: o UPDATE ia anônimo, a RLS filtrava 0 linhas sem erro, e
 * o aparelho continuava recebendo push da conta que saiu (inclusive com outra
 * pessoa logada nele).
 */
const mockOrdem: string[] = [];

jest.mock('../notifications', () => ({
  unregisterPushToken: jest.fn(async (id: string) => {
    mockOrdem.push(`unregister:${id}`);
  }),
}));

jest.mock('../auth/limparEstadoLocal', () => ({
  limparEstadoLocalDoUsuario: jest.fn(async () => {
    mockOrdem.push('limpar');
  }),
}));

jest.mock('../logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

import { authService } from '../auth';
import { limparEstadoLocalDoUsuario } from '../auth/limparEstadoLocal';
import { unregisterPushToken } from '../notifications';
import { supabase } from '../supabase';

const auth = supabase.auth as jest.Mocked<typeof supabase.auth>;

beforeEach(() => {
  jest.clearAllMocks();
  mockOrdem.length = 0;
  auth.getSession.mockResolvedValue({
    data: { session: { user: { id: 'user-1' } } },
    error: null,
  } as never);
  auth.signOut.mockImplementation(async () => {
    mockOrdem.push('signOut');
    return { error: null };
  });
});

describe('authService.signOut', () => {
  it('limpa o token com a sessão viva, sai só deste aparelho e limpa o estado', async () => {
    await authService.signOut();

    expect(mockOrdem).toEqual(['unregister:user-1', 'signOut', 'limpar']);
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('sem sessão não tenta limpar token, mas limpa o estado local', async () => {
    auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    } as never);

    await authService.signOut();

    expect(unregisterPushToken).not.toHaveBeenCalled();
    expect(mockOrdem).toEqual(['signOut', 'limpar']);
  });

  it('falha ao limpar o token não impede o logout', async () => {
    (unregisterPushToken as jest.Mock).mockRejectedValueOnce(new Error('rede'));

    await authService.signOut();

    expect(auth.signOut).toHaveBeenCalled();
    expect(limparEstadoLocalDoUsuario).toHaveBeenCalled();
  });

  it('limpa o estado local mesmo quando o signOut falha de verdade', async () => {
    auth.signOut.mockResolvedValue({
      error: { message: 'Network error' },
    } as never);

    await expect(authService.signOut()).rejects.toEqual({
      message: 'Network error',
    });
    expect(limparEstadoLocalDoUsuario).toHaveBeenCalled();
  });
});
