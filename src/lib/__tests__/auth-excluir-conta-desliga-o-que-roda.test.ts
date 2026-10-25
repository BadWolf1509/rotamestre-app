/**
 * Excluir a conta também desliga o que roda em nome dela neste aparelho:
 * rastreamento (segundo plano e modo navegação), lembrete diário e push. O
 * "Sair" já fazia isso; a exclusão tem caminho próprio e deixava o lembrete
 * "Bom dia!" agendado para uma conta que não existe mais.
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
  limparEstadoLocalDoUsuario: jest.fn(async () => undefined),
  limparAparelhoAoExcluirConta: jest.fn(async () => {
    mockOrdem.push('limpar');
  }),
}));
jest.mock('../logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

import LocationTrackingService from '@/services/locationTracking';
import { stopBackgroundTracking } from '@/services/unifiedLocationTracking';

import { authService } from '../auth';
import { cancelRouteReminder, unregisterPushToken } from '../notifications';
import { supabase } from '../supabase';

const auth = supabase.auth as jest.Mocked<typeof supabase.auth>;
const functions = supabase as unknown as { functions: { invoke: jest.Mock } };

beforeEach(() => {
  jest.clearAllMocks();
  mockOrdem.length = 0;
  auth.getSession.mockResolvedValue({
    data: { session: { user: { id: 'user-1' } } },
    error: null,
  } as never);
  auth.signOut.mockImplementation((async () => {
    mockOrdem.push('signOut');
    return { error: null };
  }) as never);
  functions.functions = {
    invoke: jest.fn().mockResolvedValue({
      data: { success: true, deletedAt: 'x', retainedData: [] },
      error: null,
    }),
  };
});

describe('excluir a conta desliga o que roda pela conta', () => {
  it('para os rastreamentos, cancela o lembrete e tira o push, nessa ordem, antes de sair', async () => {
    await authService.deleteAccount();

    expect(stopBackgroundTracking).toHaveBeenCalledTimes(1);
    expect(LocationTrackingService.stopTracking).toHaveBeenCalledTimes(1);
    expect(cancelRouteReminder).toHaveBeenCalledTimes(1);
    expect(unregisterPushToken).toHaveBeenCalledWith('user-1');
    const i = (x: string) => mockOrdem.findIndex((o) => o.startsWith(x));
    expect(i('para-')).toBeLessThan(i('lembrete'));
    expect(i('lembrete')).toBeLessThan(i('unregister'));
    expect(i('unregister')).toBeLessThan(i('signOut'));
    expect(i('signOut')).toBeLessThan(i('limpar'));
  });

  it('falha ao desligar não impede a exclusão de terminar', async () => {
    (stopBackgroundTracking as jest.Mock).mockRejectedValue(new Error('x'));
    (cancelRouteReminder as jest.Mock).mockRejectedValue(new Error('y'));
    (unregisterPushToken as jest.Mock).mockRejectedValue(new Error('z'));

    await expect(authService.deleteAccount()).resolves.toMatchObject({
      success: true,
    });
    expect(mockOrdem).toContain('signOut');
    expect(mockOrdem).toContain('limpar');
  });

  it('servidor recusou (guarda): nada é desligado', async () => {
    functions.functions.invoke.mockResolvedValue({
      data: null,
      error: new Error('recusou'),
    });

    await expect(authService.deleteAccount()).rejects.toThrow('recusou');
    expect(stopBackgroundTracking).not.toHaveBeenCalled();
    expect(LocationTrackingService.stopTracking).not.toHaveBeenCalled();
    expect(cancelRouteReminder).not.toHaveBeenCalled();
    expect(unregisterPushToken).not.toHaveBeenCalled();
  });
});
