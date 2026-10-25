/**
 * AN9: trocar ou redefinir a senha encerra as OUTRAS sessões da conta
 * (`signOut({ scope: 'others' })`). Quem tinha a senha antiga num aparelho
 * perdido seguia logado depois da troca.
 *
 * ONDE FICA: dentro de `authService.updatePassword`, o único caminho das três
 * telas (gestor, motorista, redefinição por e-mail). A alternativa, uma chamada
 * em cada tela, deixaria a quarta tela futura esquecer — e o guarda de
 * `signout-so-neste-aparelho` já obriga o `auth.signOut` a viver em
 * `src/lib/auth.ts`.
 *
 * O QUE NÃO PODE ACONTECER: `scope: 'others'` não é o "Sair" local. Não pode
 * parar o rastreamento nem cancelar o lembrete deste aparelho, nem limpar o
 * estado local, nem tirar o push daqui — a pessoa continua logada AQUI.
 */
const mockChamadas: string[] = [];

jest.mock('../notifications', () => ({
  unregisterPushToken: jest.fn(async () => {
    mockChamadas.push('unregister');
  }),
  cancelRouteReminder: jest.fn(async () => {
    mockChamadas.push('lembrete');
  }),
}));
jest.mock('@/services/unifiedLocationTracking', () => ({
  stopBackgroundTracking: jest.fn(async () => {
    mockChamadas.push('para-segundo-plano');
  }),
}));
jest.mock('@/services/locationTracking', () => ({
  __esModule: true,
  default: {
    stopTracking: jest.fn(async () => {
      mockChamadas.push('para-navegacao');
      return true;
    }),
  },
}));
jest.mock('../auth/limparEstadoLocal', () => ({
  limparEstadoLocalDoUsuario: jest.fn(async () => {
    mockChamadas.push('limpar');
  }),
}));
jest.mock('../logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

import { authService } from '../auth';
import { logger } from '../logger';
import { supabase } from '../supabase';

const auth = supabase.auth as jest.Mocked<typeof supabase.auth>;

beforeEach(() => {
  jest.clearAllMocks();
  mockChamadas.length = 0;
  auth.updateUser.mockImplementation((async () => {
    mockChamadas.push('updateUser');
    return { data: { user: {} }, error: null };
  }) as never);
  auth.signOut.mockImplementation((async (opcoes?: { scope?: string }) => {
    mockChamadas.push(`signOut:${opcoes?.scope}`);
    return { error: null };
  }) as never);
});

describe('updatePassword encerra as outras sessões', () => {
  it("chama signOut({ scope: 'others' }) DEPOIS de gravar a senha", async () => {
    await authService.updatePassword('NovaSenha@123');

    expect(mockChamadas).toEqual(['updateUser', 'signOut:others']);
    expect(auth.signOut).toHaveBeenCalledTimes(1);
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'others' });
  });

  it('não mexe neste aparelho: sem parar rastreamento, lembrete, push nem limpeza', async () => {
    await authService.updatePassword('NovaSenha@123');

    expect(mockChamadas).not.toContain('para-segundo-plano');
    expect(mockChamadas).not.toContain('para-navegacao');
    expect(mockChamadas).not.toContain('lembrete');
    expect(mockChamadas).not.toContain('unregister');
    expect(mockChamadas).not.toContain('limpar');
    expect(auth.signOut).not.toHaveBeenCalledWith({ scope: 'local' });
    expect(auth.signOut).not.toHaveBeenCalledWith();
  });

  it('o "Sair" local continua parando o rastreamento (as duas chamadas são distintas)', async () => {
    await authService.signOut();

    expect(mockChamadas).toContain('para-segundo-plano');
    expect(mockChamadas).toContain('limpar');
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(auth.signOut).not.toHaveBeenCalledWith({ scope: 'others' });
  });

  it('falha (erro devolvido) ao encerrar as outras NÃO faz a troca parecer falha', async () => {
    auth.signOut.mockResolvedValue({
      error: new Error('rede caiu'),
    } as never);

    await expect(
      authService.updatePassword('NovaSenha@123'),
    ).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('outras sessões'),
      expect.any(Error),
    );
  });

  it('falha (exceção) ao encerrar as outras NÃO faz a troca parecer falha', async () => {
    auth.signOut.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(
      authService.updatePassword('NovaSenha@123'),
    ).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('se a troca da senha falha, não encerra sessão nenhuma', async () => {
    auth.updateUser.mockResolvedValue({
      data: { user: null },
      error: new Error('senha fraca'),
    } as never);

    await expect(authService.updatePassword('x')).rejects.toThrow(
      'senha fraca',
    );
    expect(auth.signOut).not.toHaveBeenCalled();
  });
});
