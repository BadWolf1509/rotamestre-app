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
  cancelRouteReminder: jest.fn(async () => {
    mockOrdem.push('lembrete');
  }),
}));

jest.mock('@/services/unifiedLocationTracking', () => ({
  stopBackgroundTracking: jest.fn(async () => {
    mockOrdem.push('para-segundo-plano');
  }),
}));

jest.mock('@/services/locationTracking', () => ({
  __esModule: true,
  default: {
    stopTracking: jest.fn(async () => {
      mockOrdem.push('para-navegacao');
      return true;
    }),
  },
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

import LocationTrackingService from '@/services/locationTracking';
import { stopBackgroundTracking } from '@/services/unifiedLocationTracking';

import { authService, PRAZO_LIMPEZA_PUSH_MS } from '../auth';
import { limparEstadoLocalDoUsuario } from '../auth/limparEstadoLocal';
import { cancelRouteReminder, unregisterPushToken } from '../notifications';
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

    expect(mockOrdem).toEqual([
      'para-segundo-plano',
      'para-navegacao',
      'lembrete',
      'unregister:user-1',
      'signOut',
      'limpar',
    ]);
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('para a task de segundo plano e o modo navegação, e cancela o lembrete, antes de limpar o estado', async () => {
    await authService.signOut();

    expect(stopBackgroundTracking).toHaveBeenCalledTimes(1);
    expect(LocationTrackingService.stopTracking).toHaveBeenCalledTimes(1);
    expect(cancelRouteReminder).toHaveBeenCalledTimes(1);
    expect(mockOrdem.indexOf('limpar')).toBeGreaterThan(
      mockOrdem.indexOf('para-navegacao'),
    );
    expect(mockOrdem.indexOf('limpar')).toBeGreaterThan(
      mockOrdem.indexOf('lembrete'),
    );
  });

  it('falha ao parar o rastreamento ou cancelar o lembrete não impede o logout', async () => {
    (stopBackgroundTracking as jest.Mock).mockRejectedValueOnce(new Error('x'));
    (LocationTrackingService.stopTracking as jest.Mock).mockRejectedValueOnce(
      new Error('y'),
    );
    (cancelRouteReminder as jest.Mock).mockRejectedValueOnce(new Error('z'));

    await authService.signOut();

    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(limparEstadoLocalDoUsuario).toHaveBeenCalled();
  });

  it('sem sessão não tenta limpar token, mas limpa o estado local', async () => {
    auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    } as never);

    await authService.signOut();

    expect(unregisterPushToken).not.toHaveBeenCalled();
    expect(mockOrdem).toEqual([
      'para-segundo-plano',
      'para-navegacao',
      'lembrete',
      'signOut',
      'limpar',
    ]);
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

  it('limpeza do push que não responde não segura o logout além do prazo', async () => {
    jest.useFakeTimers();
    try {
      // Rede pendurada: a promessa nunca resolve.
      (unregisterPushToken as jest.Mock).mockImplementationOnce(
        () => new Promise(() => {}),
      );

      let terminou = false;
      const p = authService.signOut().then(() => {
        terminou = true;
      });

      await jest.advanceTimersByTimeAsync(PRAZO_LIMPEZA_PUSH_MS - 1);
      expect(terminou).toBe(false);

      await jest.advanceTimersByTimeAsync(1);
      await p;
      expect(terminou).toBe(true);
      expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
      expect(limparEstadoLocalDoUsuario).toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('getSession pendurado também cai no prazo', async () => {
    jest.useFakeTimers();
    try {
      auth.getSession.mockImplementationOnce(() => new Promise(() => {}));

      const p = authService.signOut();
      await jest.advanceTimersByTimeAsync(PRAZO_LIMPEZA_PUSH_MS);
      await p;

      expect(auth.signOut).toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('o prazo é curto (3–5 s)', () => {
    expect(PRAZO_LIMPEZA_PUSH_MS).toBeGreaterThanOrEqual(3000);
    expect(PRAZO_LIMPEZA_PUSH_MS).toBeLessThanOrEqual(5000);
  });
});
