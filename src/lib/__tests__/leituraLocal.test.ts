/**
 * Leitura do AsyncStorage para quem vai GRAVAR em seguida: a falha da leitura
 * não pode virar "lista vazia", senão quem chamou grava por cima da fila que
 * estava lá (OFF-4).
 */
let mockDisco: Record<string, string> = {};
let mockFalhaNaLeitura: Error | null = null;
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (k: string) => {
    if (mockFalhaNaLeitura) throw mockFalhaNaLeitura;
    return mockDisco[k] ?? null;
  }),
  setItem: jest.fn(async (k: string, v: string) => {
    mockDisco[k] = v;
  }),
}));

jest.mock('../logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';

import { FalhaDeLeituraLocal, lerJsonParaGravar } from '../leituraLocal';
import { logger } from '../logger';

const CHAVE = '@rotamestre:qualquer_fila';

beforeEach(() => {
  jest.clearAllMocks();
  mockDisco = {};
  mockFalhaNaLeitura = null;
});

describe('lerJsonParaGravar', () => {
  it('devolve o JSON guardado', async () => {
    mockDisco[CHAVE] = JSON.stringify([{ id: 1 }]);
    await expect(lerJsonParaGravar(CHAVE, [])).resolves.toEqual([{ id: 1 }]);
  });

  it('sem nada guardado, devolve o vazio', async () => {
    await expect(lerJsonParaGravar(CHAVE, [])).resolves.toEqual([]);
  });

  it('getItem lança → rejeita com FalhaDeLeituraLocal', async () => {
    mockFalhaNaLeitura = new Error('Row too big to fit into CursorWindow');

    const leitura = lerJsonParaGravar(CHAVE, []);

    await expect(leitura).rejects.toBeInstanceOf(FalhaDeLeituraLocal);
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it('JSON inválido → devolve vazio e grava a quarentena com o bruto', async () => {
    mockDisco[CHAVE] = '[{"id":1},{"id":';

    await expect(lerJsonParaGravar(CHAVE, [])).resolves.toEqual([]);

    expect(mockDisco[`${CHAVE}:quarentena`]).toBe('[{"id":1},{"id":');
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('JSON inválido e a quarentena não grava → rejeita, para não apagar o bruto', async () => {
    mockDisco[CHAVE] = '{quebrado';
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
      new Error('disco cheio'),
    );

    await expect(lerJsonParaGravar(CHAVE, [])).rejects.toBeInstanceOf(
      FalhaDeLeituraLocal,
    );
  });
});
