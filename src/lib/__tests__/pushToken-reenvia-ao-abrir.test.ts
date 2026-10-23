/**
 * Manter o registro do aparelho atualizado e o limite de aparelhos por uso
 * recente: a cada abertura do app com sessão, e na volta ao primeiro plano
 * depois de um intervalo, o app chama de novo `registrar_push_token` para a
 * conta atual — mesmo com token e conta iguais aos da última vez.
 *
 * Também cobre as corridas: logout/troca de conta no meio do reenvio,
 * chamadas simultâneas (uma só viagem ao banco) e o recuo após falha.
 */
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
  AndroidImportance: { DEFAULT: 3, MAX: 5 },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('expo-constants', () => ({
  expoConfig: { extra: { eas: { projectId: 'p' } } },
}));

jest.mock('expo-device', () => ({ isDevice: true }));

const mockRpc = jest.fn();
const mockGetSession = jest.fn();
const mockUpdate = jest.fn();
const mockUpdateEq = jest.fn();
const mockDeleteResult: { error: { message: string } | null } = { error: null };

jest.mock('../supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    auth: { getSession: () => mockGetSession() },
    from: () => ({
      update: (payload: unknown) => {
        mockUpdate(payload);
        return {
          eq: (col: string, val: unknown) => {
            mockUpdateEq(col, val);
            return Promise.resolve({ error: null });
          },
        };
      },
      delete: () => ({
        eq: () => Promise.resolve({ error: mockDeleteResult.error }),
      }),
    }),
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { logger } from '../logger';
import {
  INTERVALO_MINIMO_REENVIO_PUSH_MS,
  RECUO_APOS_FALHA_PUSH_MS,
  atualizarRegistroDePush,
  registerPushToken,
  reiniciarControleDeReenvioDePush,
  unregisterPushToken,
} from '../notifications';

const TOKEN = 'ExponentPushToken[aparelho]';
const getItem = AsyncStorage.getItem as jest.Mock;
const setItem = AsyncStorage.setItem as jest.Mock;
const getPermissionsAsync = Notifications.getPermissionsAsync as jest.Mock;
const requestPermissionsAsync =
  Notifications.requestPermissionsAsync as jest.Mock;
const getExpoPushTokenAsync = Notifications.getExpoPushTokenAsync as jest.Mock;

function sessaoDe(id: string | null) {
  mockGetSession.mockResolvedValue({
    data: { session: id ? { user: { id } } : null },
  });
}

function adiavel<T>() {
  let resolver!: (v: T) => void;
  const promessa = new Promise<T>((r) => {
    resolver = r;
  });
  return { promessa, resolver };
}

/** Deixa as promessas pendentes andarem até onde der. */
async function drenar() {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-23T12:00:00Z'));
  reiniciarControleDeReenvioDePush();
  Object.defineProperty(Platform, 'OS', { value: 'android', writable: true });
  getPermissionsAsync.mockResolvedValue({ status: 'granted' });
  getExpoPushTokenAsync.mockResolvedValue({ data: TOKEN });
  mockRpc.mockResolvedValue({ data: null, error: null });
  mockDeleteResult.error = null;
  // Token e conta IGUAIS aos guardados: antes isso pulava o banco.
  getItem.mockResolvedValue(JSON.stringify({ token: TOKEN, userId: 'A' }));
  sessaoDe('A');
});

afterEach(() => jest.useRealTimers());

describe('reenvio do registro ao abrir', () => {
  it('registerPushToken chama a RPC mesmo com token e conta iguais', async () => {
    await expect(registerPushToken('A')).resolves.toBe(true);
    expect(mockRpc).toHaveBeenCalledWith('registrar_push_token', {
      p_token: TOKEN,
    });
  });

  it('ao abrir (forcar) reenvia para a conta da sessão', async () => {
    await expect(atualizarRegistroDePush({ forcar: true })).resolves.toBe(true);
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });

  it('respeita o intervalo mínimo entre chamadas', async () => {
    await atualizarRegistroDePush({ forcar: true });
    jest.advanceTimersByTime(INTERVALO_MINIMO_REENVIO_PUSH_MS - 1000);

    await expect(atualizarRegistroDePush()).resolves.toBe(false);
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });

  it('na volta ao primeiro plano depois do intervalo, reenvia', async () => {
    await atualizarRegistroDePush({ forcar: true });
    jest.advanceTimersByTime(INTERVALO_MINIMO_REENVIO_PUSH_MS + 1000);

    await expect(atualizarRegistroDePush()).resolves.toBe(true);
    expect(mockRpc).toHaveBeenCalledTimes(2);
  });

  it('sem sessão não chama', async () => {
    sessaoDe(null);
    await expect(atualizarRegistroDePush({ forcar: true })).resolves.toBe(
      false,
    );
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('getSession com erro recuperável devolve false sem lançar', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: { message: 'Network request failed' },
    });
    await expect(atualizarRegistroDePush({ forcar: true })).resolves.toBe(
      false,
    );
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('sem permissão de notificação não pede de novo nem chama', async () => {
    getPermissionsAsync.mockResolvedValue({ status: 'denied' });
    await expect(atualizarRegistroDePush({ forcar: true })).resolves.toBe(
      false,
    );
    expect(requestPermissionsAsync).not.toHaveBeenCalled();
    expect(getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('consulta a permissão uma vez só no reenvio', async () => {
    await atualizarRegistroDePush({ forcar: true });
    expect(getPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('trocou de conta: registra para a nova, sem esperar o intervalo', async () => {
    await atualizarRegistroDePush({ forcar: true });
    sessaoDe('B');

    await expect(atualizarRegistroDePush()).resolves.toBe(true);
    expect(mockRpc).toHaveBeenCalledTimes(2);
  });

  it('web não se aplica', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'web', writable: true });
    await expect(atualizarRegistroDePush({ forcar: true })).resolves.toBe(
      false,
    );
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('PGRST202 cai no UPDATE de fallback com a conta da sessão', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'sem função', code: 'PGRST202' },
    });

    await expect(atualizarRegistroDePush({ forcar: true })).resolves.toBe(true);

    expect(mockUpdate).toHaveBeenCalledWith({ push_token: TOKEN });
    expect(mockUpdateEq).toHaveBeenCalledWith('id', 'A');
  });
});

describe('falhas e recuo', () => {
  it('falha da RPC não lança, avisa por warn e não alerta', async () => {
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Network request failed' },
    });

    await expect(atualizarRegistroDePush({ forcar: true })).resolves.toBe(
      false,
    );
    expect(warn).toHaveBeenCalled();
  });

  it('exceção da rede também é engolida', async () => {
    jest.spyOn(logger, 'warn').mockImplementation(() => {});
    mockRpc.mockRejectedValueOnce(new Error('offline'));
    await expect(atualizarRegistroDePush({ forcar: true })).resolves.toBe(
      false,
    );
  });

  it('getExpoPushToken lançando offline: sem propagar, sem pedir permissão, só warn', async () => {
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    const error = jest.spyOn(logger, 'error').mockImplementation(() => {});
    getExpoPushTokenAsync.mockRejectedValue(
      new Error('Network request failed'),
    );

    await expect(atualizarRegistroDePush({ forcar: true })).resolves.toBe(
      false,
    );

    expect(requestPermissionsAsync).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('recuo: depois de falhar, o primeiro plano não repete antes do recuo', async () => {
    jest.spyOn(logger, 'warn').mockImplementation(() => {});
    getExpoPushTokenAsync.mockRejectedValue(
      new Error('Network request failed'),
    );
    await atualizarRegistroDePush({ forcar: true });
    getExpoPushTokenAsync.mockClear();

    jest.advanceTimersByTime(RECUO_APOS_FALHA_PUSH_MS - 1000);
    await expect(atualizarRegistroDePush()).resolves.toBe(false);
    expect(getExpoPushTokenAsync).not.toHaveBeenCalled();
  });

  it('recuo: passado o tempo, tenta de novo', async () => {
    jest.spyOn(logger, 'warn').mockImplementation(() => {});
    getExpoPushTokenAsync.mockRejectedValueOnce(
      new Error('Network request failed'),
    );
    await atualizarRegistroDePush({ forcar: true });

    jest.advanceTimersByTime(RECUO_APOS_FALHA_PUSH_MS + 1000);
    await expect(atualizarRegistroDePush()).resolves.toBe(true);
  });

  it('recuo: a abertura (forcar) ignora o recuo', async () => {
    jest.spyOn(logger, 'warn').mockImplementation(() => {});
    getExpoPushTokenAsync.mockRejectedValueOnce(
      new Error('Network request failed'),
    );
    await atualizarRegistroDePush({ forcar: true });

    await expect(atualizarRegistroDePush({ forcar: true })).resolves.toBe(true);
  });
});

describe('chamadas simultâneas (uma viagem só)', () => {
  it('duas chamadas ao mesmo tempo fazem uma RPC', async () => {
    const rpc = adiavel<{ data: null; error: null }>();
    mockRpc.mockReturnValue(rpc.promessa);

    const a = atualizarRegistroDePush({ forcar: true });
    const b = atualizarRegistroDePush({ forcar: false });
    await drenar();
    rpc.resolver({ data: null, error: null });

    await expect(Promise.all([a, b])).resolves.toEqual([true, true]);
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });

  it('o registro do login junto com o reenvio também é uma RPC só', async () => {
    const rpc = adiavel<{ data: null; error: null }>();
    mockRpc.mockReturnValue(rpc.promessa);

    const a = atualizarRegistroDePush({ forcar: true });
    const b = registerPushToken('A');
    await drenar();
    rpc.resolver({ data: null, error: null });

    await Promise.all([a, b]);
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });
});

describe('sair da conta no meio do reenvio', () => {
  it('logout durante a RPC: não grava estado local nem conta como enviado', async () => {
    const rpc = adiavel<{ data: null; error: null }>();
    mockRpc.mockReturnValue(rpc.promessa);

    const envio = atualizarRegistroDePush({ forcar: true });
    await drenar();
    expect(mockRpc).toHaveBeenCalledTimes(1);

    await unregisterPushToken('A');
    rpc.resolver({ data: null, error: null });
    await envio;

    expect(setItem).not.toHaveBeenCalled();

    // Quem entrar depois não encontra "enviado há pouco" de outra sessão.
    mockRpc.mockResolvedValue({ data: null, error: null });
    await expect(atualizarRegistroDePush()).resolves.toBe(true);
  });

  it('logout antes da RPC: descarta sem chamar', async () => {
    const token = adiavel<{ data: string }>();
    getExpoPushTokenAsync.mockReturnValue(token.promessa);

    const envio = atualizarRegistroDePush({ forcar: true });
    await drenar();
    await unregisterPushToken('A');
    token.resolver({ data: TOKEN });

    await expect(envio).resolves.toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });

  it('conta B entrando durante a chamada: o local não fica com A', async () => {
    const token = adiavel<{ data: string }>();
    getExpoPushTokenAsync.mockReturnValue(token.promessa);

    const envio = atualizarRegistroDePush({ forcar: true });
    await drenar();
    sessaoDe('B');
    token.resolver({ data: TOKEN });

    await expect(envio).resolves.toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });

  it('ultimoEnvio é zerado no logout', async () => {
    await atualizarRegistroDePush({ forcar: true });
    await unregisterPushToken('A');

    await expect(atualizarRegistroDePush()).resolves.toBe(true);
    expect(mockRpc).toHaveBeenCalledTimes(2);
  });

  it('ultimoEnvio é zerado no logout mesmo offline', async () => {
    jest.spyOn(logger, 'warn').mockImplementation(() => {});
    await atualizarRegistroDePush({ forcar: true });
    mockDeleteResult.error = { message: 'Network request failed' };

    await expect(unregisterPushToken('A')).resolves.toBe(false);

    await expect(atualizarRegistroDePush()).resolves.toBe(true);
    expect(mockRpc).toHaveBeenCalledTimes(2);
  });
});
