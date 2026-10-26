/**
 * `secureAuthStorage`: único armazenamento da sessão do Supabase no nativo.
 * Sessão perdida = motorista deslogado no meio da rota, e a fila offline com
 * ações pendentes depende do login. A lógica própria (blocos de 1800
 * caracteres, contagem em metadado, migração do AsyncStorage legado) não tinha
 * teste algum.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { secureAuthStorage } from '../secureAuthStorage';

const mockCofre = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (chave: string) => mockCofre.get(chave) ?? null),
  setItemAsync: jest.fn(async (chave: string, valor: string) => {
    mockCofre.set(chave, valor);
  }),
  deleteItemAsync: jest.fn(async (chave: string) => {
    mockCofre.delete(chave);
  }),
}));

const CHAVE = 'sb-sessao';
const TAMANHO_BLOCO = 1800;

function chavesDoCofre(): string[] {
  return [...mockCofre.keys()].sort();
}

describe('secureAuthStorage', () => {
  beforeEach(() => {
    mockCofre.clear();
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  });

  it('grava e lê um valor que cabe num bloco só', async () => {
    await secureAuthStorage.setItem(CHAVE, '{"a":1}');

    expect(await secureAuthStorage.getItem(CHAVE)).toBe('{"a":1}');
    expect(chavesDoCofre()).toEqual([
      `${CHAVE}.secure.0`,
      `${CHAVE}.secure.meta`,
    ]);
    expect(mockCofre.get(`${CHAVE}.secure.meta`)).toBe('1');
  });

  it('parte valor grande em blocos de 1800 e o devolve inteiro', async () => {
    const valor = 'x'.repeat(TAMANHO_BLOCO * 2 + 5) + 'FIM';
    await secureAuthStorage.setItem(CHAVE, valor);

    expect(mockCofre.get(`${CHAVE}.secure.meta`)).toBe('3');
    expect(mockCofre.get(`${CHAVE}.secure.0`)).toHaveLength(TAMANHO_BLOCO);
    expect(await secureAuthStorage.getItem(CHAVE)).toBe(valor);
  });

  it('sessão nova menor que a antiga não deixa bloco velho no cofre', async () => {
    await secureAuthStorage.setItem(CHAVE, 'y'.repeat(TAMANHO_BLOCO * 3));
    await secureAuthStorage.setItem(CHAVE, 'curta');

    expect(chavesDoCofre()).toEqual([
      `${CHAVE}.secure.0`,
      `${CHAVE}.secure.meta`,
    ]);
    expect(await secureAuthStorage.getItem(CHAVE)).toBe('curta');
  });

  it('devolve null se algum bloco sumiu, em vez de uma sessão truncada', async () => {
    await secureAuthStorage.setItem(CHAVE, 'z'.repeat(TAMANHO_BLOCO * 2 + 1));
    mockCofre.delete(`${CHAVE}.secure.1`);

    expect(await secureAuthStorage.getItem(CHAVE)).toBeNull();
  });

  it('devolve null quando não há nada, nem no cofre nem no legado', async () => {
    expect(await secureAuthStorage.getItem(CHAVE)).toBeNull();
  });

  it('migra a sessão legada do AsyncStorage: grava no cofre e só então apaga o legado', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('{"legado":true}');
    const ordem: string[] = [];
    (AsyncStorage.removeItem as jest.Mock).mockImplementation(async () => {
      // No instante em que o legado é apagado, o mockCofre já tem a sessão.
      ordem.push(`apagou-legado;cofre=${mockCofre.get(`${CHAVE}.secure.0`)}`);
    });

    expect(await secureAuthStorage.getItem(CHAVE)).toBe('{"legado":true}');

    expect(ordem).toEqual(['apagou-legado;cofre={"legado":true}']);
    expect(mockCofre.get(`${CHAVE}.secure.meta`)).toBe('1');
  });

  it('com a sessão já no cofre, não consulta nem migra o legado', async () => {
    await secureAuthStorage.setItem(CHAVE, 'no-mockCofre');
    (AsyncStorage.getItem as jest.Mock).mockClear();

    expect(await secureAuthStorage.getItem(CHAVE)).toBe('no-mockCofre');
    expect(AsyncStorage.getItem).not.toHaveBeenCalled();
  });

  it('setItem apaga qualquer cópia legada', async () => {
    await secureAuthStorage.setItem(CHAVE, 'nova');

    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(CHAVE);
  });

  it('removeItem limpa blocos, metadado e legado', async () => {
    await secureAuthStorage.setItem(CHAVE, 'w'.repeat(TAMANHO_BLOCO + 1));
    await secureAuthStorage.removeItem(CHAVE);

    expect(chavesDoCofre()).toEqual([]);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(CHAVE);
    expect(await secureAuthStorage.getItem(CHAVE)).toBeNull();
  });
});
