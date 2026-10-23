/**
 * O token de push guardado no aparelho é de UMA conta.
 *
 * Antes, `registerPushToken` pulava o banco sempre que o token do aparelho
 * fosse igual ao guardado — sem olhar de quem era. Com duas contas no mesmo
 * celular (gestor que também dirige, motorista que troca de conta), a segunda
 * nunca gravava o token dela e não recebia push.
 *
 * E `unregisterPushToken` limpa só se o banco ainda tiver o token DESTE
 * aparelho: a coluna é uma só por usuário, e o logout no aparelho A não pode
 * apagar o token que o aparelho B registrou depois.
 */
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
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

const mockChamadas: Array<{ update: unknown; eq: Array<[string, unknown]> }> =
  [];

jest.mock('../supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      update: jest.fn((payload: unknown) => {
        const registro = {
          update: payload,
          eq: [] as Array<[string, unknown]>,
        };
        mockChamadas.push(registro);
        const builder = {
          eq: jest.fn((col: string, val: unknown) => {
            registro.eq.push([col, val]);
            return builder;
          }),
          then: (resolve: (v: { error: null }) => unknown) =>
            resolve({ error: null }),
        };
        return builder;
      }),
    })),
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { registerPushToken, unregisterPushToken } from '../notifications';

const CHAVE = '@rotamestre:push_token';
const TOKEN = 'ExponentPushToken[aparelho]';
const getItem = AsyncStorage.getItem as jest.Mock;
const setItem = AsyncStorage.setItem as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockChamadas.length = 0;
  Object.defineProperty(Platform, 'OS', { value: 'android', writable: true });
});

describe('registerPushToken: token guardado por conta', () => {
  it('grava no banco quando o token do aparelho é de OUTRA conta', async () => {
    getItem.mockResolvedValue(JSON.stringify({ token: TOKEN, userId: 'A' }));

    await expect(registerPushToken('B')).resolves.toBe(true);

    expect(mockChamadas).toEqual([
      { update: { push_token: TOKEN }, eq: [['id', 'B']] },
    ]);
    expect(setItem).toHaveBeenCalledWith(
      CHAVE,
      JSON.stringify({ token: TOKEN, userId: 'B' }),
    );
  });

  it('não regrava quando o token e a conta são os mesmos', async () => {
    getItem.mockResolvedValue(JSON.stringify({ token: TOKEN, userId: 'A' }));

    await expect(registerPushToken('A')).resolves.toBe(true);

    expect(mockChamadas).toEqual([]);
    expect(setItem).not.toHaveBeenCalled();
  });

  it('formato antigo (só o token, sem dono) grava de novo', async () => {
    getItem.mockResolvedValue(TOKEN);

    await registerPushToken('A');

    expect(mockChamadas).toHaveLength(1);
    expect(setItem).toHaveBeenCalledWith(
      CHAVE,
      JSON.stringify({ token: TOKEN, userId: 'A' }),
    );
  });
});

describe('unregisterPushToken: só o token deste aparelho', () => {
  it('limpa no banco só se ainda for o token deste aparelho', async () => {
    getItem.mockResolvedValue(JSON.stringify({ token: TOKEN, userId: 'A' }));

    await unregisterPushToken('A');

    expect(mockChamadas).toEqual([
      {
        update: { push_token: null },
        eq: [
          ['id', 'A'],
          ['push_token', TOKEN],
        ],
      },
    ]);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(CHAVE);
  });

  it('formato antigo também serve: o valor é o token', async () => {
    getItem.mockResolvedValue(TOKEN);

    await unregisterPushToken('A');

    expect(mockChamadas[0]?.eq).toEqual([
      ['id', 'A'],
      ['push_token', TOKEN],
    ]);
  });

  it('sem token guardado não mexe no banco (o token no banco é de outro aparelho)', async () => {
    getItem.mockResolvedValue(null);

    await unregisterPushToken('A');

    expect(mockChamadas).toEqual([]);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(CHAVE);
  });
});
