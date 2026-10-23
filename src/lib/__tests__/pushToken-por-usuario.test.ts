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
const mockDeletes: Array<{ tabela: string; eq: Array<[string, unknown]> }> = [];
const mockRpc: Array<[string, unknown]> = [];
let mockErroUpdate: { message: string } | null = null;
let mockErroDelete: { message: string; code?: string } | null = null;
let mockErroRpc: { message: string; code?: string } | null = null;

jest.mock('../supabase', () => ({
  supabase: {
    rpc: jest.fn(async (nome: string, args: unknown) => {
      mockRpc.push([nome, args]);
      return { data: null, error: mockErroRpc };
    }),
    from: jest.fn((tabela: string) => ({
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
          then: (resolve: (v: { error: unknown }) => unknown) =>
            resolve({ error: mockErroUpdate }),
        };
        return builder;
      }),
      delete: jest.fn(() => {
        const registro = { tabela, eq: [] as Array<[string, unknown]> };
        mockDeletes.push(registro);
        const builder = {
          eq: jest.fn((col: string, val: unknown) => {
            registro.eq.push([col, val]);
            return builder;
          }),
          then: (resolve: (v: { error: unknown }) => unknown) =>
            resolve({ error: mockErroDelete }),
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
  mockDeletes.length = 0;
  mockRpc.length = 0;
  mockErroUpdate = null;
  mockErroDelete = null;
  mockErroRpc = null;
  Object.defineProperty(Platform, 'OS', { value: 'android', writable: true });
});

describe('registerPushToken: token guardado por conta', () => {
  it('grava no banco quando o token do aparelho é de OUTRA conta', async () => {
    getItem.mockResolvedValue(JSON.stringify({ token: TOKEN, userId: 'A' }));

    await expect(registerPushToken('B')).resolves.toBe(true);

    // Pela RPC, que tira o mesmo token de qualquer OUTRA conta no servidor:
    // a linha de A não pode continuar apontando para o celular de B.
    expect(mockRpc).toEqual([['registrar_push_token', { p_token: TOKEN }]]);
    expect(mockChamadas).toEqual([]);
    expect(setItem).toHaveBeenCalledWith(
      CHAVE,
      JSON.stringify({ token: TOKEN, userId: 'B' }),
    );
  });

  // Antes: "não regrava quando o token e a conta são os mesmos". Esse atalho
  // saiu: o reenvio a cada abertura mantém o registro do aparelho atualizado e
  // o limite de aparelhos por uso recente (ver pushToken-reenvia-ao-abrir).
  it('regrava mesmo quando o token e a conta são os mesmos', async () => {
    getItem.mockResolvedValue(JSON.stringify({ token: TOKEN, userId: 'A' }));

    await expect(registerPushToken('A')).resolves.toBe(true);

    expect(mockRpc).toEqual([['registrar_push_token', { p_token: TOKEN }]]);
  });

  it('formato antigo (só o token, sem dono) grava de novo', async () => {
    getItem.mockResolvedValue(TOKEN);

    await registerPushToken('A');

    expect(mockRpc).toHaveLength(1);
    expect(setItem).toHaveBeenCalledWith(
      CHAVE,
      JSON.stringify({ token: TOKEN, userId: 'A' }),
    );
  });
});

describe('unregisterPushToken: só o token deste aparelho', () => {
  // Migration 45: o token mora em push_tokens (um por aparelho, só o dono
  // vê e apaga pela RLS); a coluna usuarios.push_token fica sempre vazia, e o
  // UPDATE antigo `.eq('push_token', token)` não casaria linha nenhuma.
  it('apaga de push_tokens só o token deste aparelho', async () => {
    getItem.mockResolvedValue(JSON.stringify({ token: TOKEN, userId: 'A' }));

    await unregisterPushToken('A');

    expect(mockDeletes).toEqual([
      { tabela: 'push_tokens', eq: [['token', TOKEN]] },
    ]);
    expect(mockChamadas).toEqual([]);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(CHAVE);
  });

  it('formato antigo também serve: o valor é o token', async () => {
    getItem.mockResolvedValue(TOKEN);

    await unregisterPushToken('A');

    expect(mockDeletes[0]?.eq).toEqual([['token', TOKEN]]);
  });

  it('banco sem a Migration 45 (PGRST205): cai no UPDATE antigo da coluna', async () => {
    getItem.mockResolvedValue(JSON.stringify({ token: TOKEN, userId: 'A' }));
    // Formato real do PostgREST quando a tabela não está no schema cache.
    mockErroDelete = {
      code: 'PGRST205',
      message:
        "Could not find the table 'public.push_tokens' in the schema cache",
    };

    await expect(unregisterPushToken('A')).resolves.toBe(true);
    expect(mockChamadas).toEqual([
      {
        update: { push_token: null },
        eq: [
          ['id', 'A'],
          ['push_token', TOKEN],
        ],
      },
    ]);
  });

  it('sem token guardado não mexe no banco (o token no banco é de outro aparelho)', async () => {
    getItem.mockResolvedValue(null);

    await unregisterPushToken('A');

    expect(mockChamadas).toEqual([]);
    expect(mockDeletes).toEqual([]);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(CHAVE);
  });
});

describe('registerPushToken: falha da RPC', () => {
  it('não guarda o token como registrado quando a RPC falha', async () => {
    getItem.mockResolvedValue(null);
    mockErroRpc = { message: 'offline' };

    await expect(registerPushToken('A')).resolves.toBe(false);
    expect(setItem).not.toHaveBeenCalled();
  });

  it('RPC ainda não publicada (PGRST202): cai no UPDATE direto da própria linha', async () => {
    getItem.mockResolvedValue(null);
    // Formato real do PostgREST quando a função não existe no schema cache.
    mockErroRpc = {
      code: 'PGRST202',
      message:
        'Could not find the function public.registrar_push_token(p_token) in the schema cache',
    };

    await expect(registerPushToken('A')).resolves.toBe(true);
    expect(mockChamadas).toEqual([
      { update: { push_token: TOKEN }, eq: [['id', 'A']] },
    ]);
    expect(setItem).toHaveBeenCalledWith(
      CHAVE,
      JSON.stringify({ token: TOKEN, userId: 'A' }),
    );
  });

  it('outro erro da RPC (ex.: 42501) NÃO cai no UPDATE direto', async () => {
    getItem.mockResolvedValue(null);
    mockErroRpc = { code: '42501', message: 'Sessão necessária' };

    await expect(registerPushToken('A')).resolves.toBe(false);
    expect(mockChamadas).toEqual([]);
  });
});

describe('unregisterPushToken: só esquece o token quando o banco limpou', () => {
  it('DELETE com erro (offline): mantém a chave local e devolve false', async () => {
    getItem.mockResolvedValue(JSON.stringify({ token: TOKEN, userId: 'A' }));
    mockErroDelete = { message: 'Network request failed' };

    await expect(unregisterPushToken('A')).resolves.toBe(false);
    expect(mockChamadas).toEqual([]);
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
  });

  it('DELETE ok: apaga a chave e devolve true', async () => {
    getItem.mockResolvedValue(JSON.stringify({ token: TOKEN, userId: 'A' }));

    await expect(unregisterPushToken('A')).resolves.toBe(true);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(CHAVE);
  });

  it('sem sessão viva não tenta (iria anônimo, a RLS filtraria 0 linhas) e mantém a chave', async () => {
    getItem.mockResolvedValue(JSON.stringify({ token: TOKEN, userId: 'A' }));

    await expect(unregisterPushToken(undefined)).resolves.toBe(false);
    expect(mockChamadas).toEqual([]);
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
  });
});
