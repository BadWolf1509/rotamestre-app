/**
 * Excluir a conta com uma das chaves de pendência ilegível (OFF-4): antes, a
 * leitura que falhava virava "[]", o `clear()` apagava tudo e nada era
 * regravado — sumiam as pendências de OUTRAS contas, inclusive comprovantes.
 * Agora a chave ilegível fica como está; o resto do aparelho é apagado.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { limparAparelhoAoExcluirConta } from '../limparEstadoLocal';

jest.mock('../../motorista/filaPosicoes', () => ({
  invalidarPosicoesEmVoo: jest.fn(),
}));
jest.mock('../../logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

const FILA = '@rotamestre:fila_acoes_parada';
const DESCARTES = '@rotamestre:fila_acoes_parada_descartes';
const INDICE = '@rotamestre:offline_photos_index';

const acao = (paradaId: string, motoristaId: string) => ({
  id: `a-${paradaId}`,
  tipo: 'concluir',
  paradaId,
  rotaId: 'r1',
  motoristaId,
  em: '2026-10-23T12:00:00.000Z',
  tentativas: 0,
});
const foto = (paradaId: string, userId: string) => ({
  localPath: `/docs/offline_photos/${paradaId}.jpg`,
  unidadeId: 'u1',
  rotaId: 'r1',
  paradaId,
  originalUri: 'file://x',
  savedAt: '2026-10-23T12:00:00Z',
  userId,
});

let disco: Map<string, string>;
let ilegivel: string | null;

beforeEach(() => {
  jest.clearAllMocks();
  ilegivel = null;
  disco = new Map([
    ['@rotamestre:theme_preference', 'dark'],
    ['@rotamestre:unidade_ativa', 'u1'],
    [FILA, JSON.stringify([acao('p1', 'quem-sai'), acao('p2', 'outra')])],
    [
      DESCARTES,
      JSON.stringify([
        { acao: acao('p3', 'quem-sai'), motivo: 'rota_encerrada', em: 'x' },
        { acao: acao('p4', 'outra'), motivo: 'rota_encerrada', em: 'x' },
      ]),
    ],
    [INDICE, JSON.stringify([foto('p1', 'quem-sai'), foto('p2', 'outra')])],
  ]);
  (AsyncStorage.getItem as jest.Mock).mockImplementation(async (k: string) => {
    if (k === ilegivel) throw new Error('CursorWindow cheio');
    return disco.get(k) ?? null;
  });
  (AsyncStorage.setItem as jest.Mock).mockImplementation(
    async (k: string, v: string) => {
      disco.set(k, v);
    },
  );
  (AsyncStorage.getAllKeys as jest.Mock).mockImplementation(async () => [
    ...disco.keys(),
  ]);
  (AsyncStorage.multiRemove as jest.Mock).mockImplementation(
    async (ks: string[]) => {
      for (const k of ks) disco.delete(k);
    },
  );
  (AsyncStorage.clear as jest.Mock).mockImplementation(async () => {
    disco.clear();
  });
});

const ler = (k: string) => JSON.parse(disco.get(k) ?? '[]');

it.each([FILA, DESCARTES, INDICE])(
  'leitura falhando em %s: as pendências de outra conta continuam no aparelho',
  async (chave) => {
    const antes = disco.get(chave);
    ilegivel = chave;

    await limparAparelhoAoExcluirConta('quem-sai');

    // A chave ilegível não foi tocada (nem apagada, nem regravada).
    expect(disco.get(chave)).toBe(antes);
    // As legíveis seguem a regra normal: só fica o que é de outra conta.
    if (chave !== FILA) {
      expect(ler(FILA).map((a: { paradaId: string }) => a.paradaId)).toEqual([
        'p2',
      ]);
    }
    if (chave !== INDICE) {
      expect(ler(INDICE).map((f: { paradaId: string }) => f.paradaId)).toEqual([
        'p2',
      ]);
    }
    // O resto do aparelho foi apagado.
    expect(disco.has('@rotamestre:theme_preference')).toBe(false);
    expect(disco.has('@rotamestre:unidade_ativa')).toBe(false);
  },
);

it('ilegível e sem conseguir listar as chaves: não apaga nada', async () => {
  ilegivel = INDICE;
  (AsyncStorage.getAllKeys as jest.Mock).mockRejectedValue(new Error('disco'));

  await expect(
    limparAparelhoAoExcluirConta('quem-sai'),
  ).resolves.toBeUndefined();

  expect(disco.has(INDICE)).toBe(true);
  expect(AsyncStorage.clear).not.toHaveBeenCalled();
});
