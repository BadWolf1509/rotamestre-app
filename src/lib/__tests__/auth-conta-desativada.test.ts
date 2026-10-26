/**
 * Quem está desativado em TODAS as lojas não entra: o login faz logout local
 * e lança `ContaDesativada` (a tela mostra a mensagem). Ativo entra.
 */
jest.mock('../logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));
jest.mock('../auth/contaAtiva', () => ({
  ...jest.requireActual('../auth/contaAtiva'),
  contaEstaAtiva: jest.fn(),
}));
jest.mock('../auth/limparEstadoLocal', () => ({
  limparEstadoLocalDoUsuario: jest.fn(async () => {}),
  limparAparelhoAoExcluirConta: jest.fn(async () => {}),
}));
jest.mock('../notifications', () => ({
  unregisterPushToken: jest.fn(async () => {}),
  cancelRouteReminder: jest.fn(async () => {}),
}));
jest.mock('@/services/unifiedLocationTracking', () => ({
  stopBackgroundTracking: jest.fn(async () => {}),
}));
jest.mock('@/services/locationTracking', () => ({
  __esModule: true,
  default: { stopTracking: jest.fn(async () => true) },
}));

import {
  authService,
  ContaDesativada,
  MENSAGEM_CONTA_DESATIVADA,
} from '../auth';
import { contaEstaAtiva } from '../auth/contaAtiva';
import { limparEstadoLocalDoUsuario } from '../auth/limparEstadoLocal';
import { supabase } from '../supabase';

const auth = supabase.auth as jest.Mocked<typeof supabase.auth>;
const perfil = { id: 'u1', papel: 'motorista', ativo: true };

beforeEach(() => {
  jest.clearAllMocks();
  auth.getSession.mockResolvedValue({
    data: { session: { user: { id: 'u1' } } },
    error: null,
  } as never);
  auth.signInWithPassword.mockResolvedValue({
    data: { session: { user: { id: 'u1' } }, user: { id: 'u1' } },
    error: null,
  } as never);
  auth.signOut.mockResolvedValue({ error: null } as never);
  (supabase.from as jest.Mock).mockReturnValue({
    select: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    retry: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: perfil, error: null }),
  });
});

describe('signIn com conta desativada', () => {
  it('desativado não entra: sai deste aparelho, limpa e lança a mensagem clara', async () => {
    (contaEstaAtiva as jest.Mock).mockResolvedValue(false);

    await expect(authService.signIn('a@b.com', 'x')).rejects.toBeInstanceOf(
      ContaDesativada,
    );
    await expect(authService.signIn('a@b.com', 'x')).rejects.toThrow(
      'Sua conta está desativada. Fale com o gestor.',
    );
    expect(MENSAGEM_CONTA_DESATIVADA).toBe(
      'Sua conta está desativada. Fale com o gestor.',
    );
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(limparEstadoLocalDoUsuario).toHaveBeenCalled();
  });

  it('desativado não grava ultimo_login', async () => {
    (contaEstaAtiva as jest.Mock).mockResolvedValue(false);
    const update = jest.fn().mockReturnThis();
    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnThis(),
      update,
      eq: jest.fn().mockReturnThis(),
      retry: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: perfil, error: null }),
    });

    await expect(authService.signIn('a@b.com', 'x')).rejects.toBeInstanceOf(
      ContaDesativada,
    );
    expect(update).not.toHaveBeenCalled();
  });

  it('ativo entra normalmente', async () => {
    (contaEstaAtiva as jest.Mock).mockResolvedValue(true);

    const r = await authService.signIn('a@b.com', 'x');

    expect(r.usuario).toEqual(perfil);
    expect(auth.signOut).not.toHaveBeenCalled();
  });
});

describe('garantirContaAtiva (portão da abertura do app)', () => {
  it('desativado: logout local e ContaDesativada', async () => {
    (contaEstaAtiva as jest.Mock).mockResolvedValue(false);
    await expect(
      authService.garantirContaAtiva(perfil as never),
    ).rejects.toBeInstanceOf(ContaDesativada);
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('ativo: não faz nada', async () => {
    (contaEstaAtiva as jest.Mock).mockResolvedValue(true);
    await authService.garantirContaAtiva(perfil as never);
    expect(auth.signOut).not.toHaveBeenCalled();
  });
});
