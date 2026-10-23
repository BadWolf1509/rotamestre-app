/**
 * Manter o registro do aparelho atualizado e o limite de aparelhos por uso
 * recente: a cada abertura do app com sessão, e na volta ao primeiro plano
 * depois de um intervalo, o app chama de novo `registrar_push_token` para a
 * conta atual — mesmo com token e conta iguais aos da última vez.
 */
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest
    .fn()
    .mockResolvedValue({ data: 'ExponentPushToken[aparelho]' }),
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

jest.mock('../supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    auth: { getSession: () => mockGetSession() },
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { logger } from '../logger';
import {
  INTERVALO_MINIMO_REENVIO_PUSH_MS,
  atualizarRegistroDePush,
  registerPushToken,
  reiniciarControleDeReenvioDePush,
} from '../notifications';

const TOKEN = 'ExponentPushToken[aparelho]';
const getItem = AsyncStorage.getItem as jest.Mock;
const getPermissionsAsync = Notifications.getPermissionsAsync as jest.Mock;
const requestPermissionsAsync =
  Notifications.requestPermissionsAsync as jest.Mock;

function sessaoDe(id: string | null) {
  mockGetSession.mockResolvedValue({
    data: { session: id ? { user: { id } } : null },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-23T12:00:00Z'));
  reiniciarControleDeReenvioDePush();
  Object.defineProperty(Platform, 'OS', { value: 'android', writable: true });
  getPermissionsAsync.mockResolvedValue({ status: 'granted' });
  mockRpc.mockResolvedValue({ data: null, error: null });
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

  it('falha de rede não lança, não alerta e tenta de novo na próxima', async () => {
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Network request failed' },
    });

    await expect(atualizarRegistroDePush({ forcar: true })).resolves.toBe(
      false,
    );
    expect(warn).toHaveBeenCalled();

    // Falhou: não conta como enviado, então a próxima volta já tenta.
    await expect(atualizarRegistroDePush()).resolves.toBe(true);
    expect(mockRpc).toHaveBeenCalledTimes(2);
  });

  it('exceção da rede também é engolida', async () => {
    jest.spyOn(logger, 'warn').mockImplementation(() => {});
    mockRpc.mockRejectedValueOnce(new Error('offline'));
    await expect(atualizarRegistroDePush({ forcar: true })).resolves.toBe(
      false,
    );
  });

  it('sem sessão não chama', async () => {
    sessaoDe(null);
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
    expect(mockRpc).not.toHaveBeenCalled();
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
});
