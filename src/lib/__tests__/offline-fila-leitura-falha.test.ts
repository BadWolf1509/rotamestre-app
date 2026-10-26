/**
 * Leitura do AsyncStorage que FALHA (ex.: `CursorWindow` cheio no Android) não
 * é fila vazia. Antes, quem ia gravar lia "[]" e gravava por cima: a fila de
 * concluir/pular, o índice de fotos ou a fila de posições sumiam inteiros
 * (OFF-4). Agora quem grava não grava, e o erro sobe a quem chamou.
 */
jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest
    .fn()
    .mockResolvedValue({ isConnected: false, isInternetReachable: false }),
  addEventListener: jest.fn(() => jest.fn()),
}));

let mockDisco: Record<string, string> = {};
/** Chaves cuja leitura lança. */
let mockChavesIlegiveis = new Set<string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (k: string) => {
    if (mockChavesIlegiveis.has(k)) {
      throw new Error("Couldn't read row 0, col 0 from CursorWindow");
    }
    return mockDisco[k] ?? null;
  }),
  setItem: jest.fn(async (k: string, v: string) => {
    mockDisco[k] = v;
  }),
  removeItem: jest.fn(async (k: string) => {
    delete mockDisco[k];
  }),
}));

const mockInsert = jest.fn();
jest.mock('../supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(async () => ({
        data: { session: { user: { id: 'm1' } } },
        error: null,
      })),
    },
    from: jest.fn(() => ({
      insert: (linhas: unknown) => mockInsert(linhas),
    })),
  },
}));

jest.mock('../auth/sessao', () => ({
  lerSessao: jest.fn(async () => ({
    session: { user: { id: 'm1' } },
    offline: false,
  })),
}));

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: '/docs/',
  getInfoAsync: jest.fn(async () => ({ exists: true })),
  makeDirectoryAsync: jest.fn(),
  copyAsync: jest.fn(),
  deleteAsync: jest.fn(),
}));

jest.mock('../storage', () => ({
  subirFotoDaFilaOffline: jest.fn(async () => true),
}));

jest.mock('../logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

jest.mock('../notifications', () => ({
  notifySyncComplete: jest.fn(),
  notifyOfflineMode: jest.fn(),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { getErrorMessage } from '../errorMapping';
import { FalhaDeLeituraLocal } from '../leituraLocal';
import {
  _resetFilaAcoesParada,
  criarAcaoParada,
  enfileirarAcaoParada,
} from '../motorista/filaAcoesParada';
import { registrarPosicao } from '../motorista/filaPosicoes';
import { _resetProcessingLocks, queuePhotoUpload } from '../offline';

const CHAVE_ACOES = '@rotamestre:fila_acoes_parada';
const CHAVE_POSICOES = '@rotamestre:fila_posicoes';
const INDICE_FOTOS = '@rotamestre:offline_photos_index';

function gravacoesEm(chave: string) {
  return (AsyncStorage.setItem as jest.Mock).mock.calls.filter(
    ([k]) => k === chave,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  _resetFilaAcoesParada();
  _resetProcessingLocks();
  mockDisco = {};
  mockChavesIlegiveis = new Set();
  Object.defineProperty(Platform, 'OS', { value: 'android', writable: true });
});

describe('leitura que falha não regrava a fila', () => {
  it('enfileirarAcaoParada com getItem falhando não apaga a fila', async () => {
    const guardada = JSON.stringify([
      criarAcaoParada({
        tipo: 'concluir',
        paradaId: 'p0',
        rotaId: 'r1',
        motoristaId: 'm1',
        em: '2026-10-25T12:00:00.000Z',
      }),
    ]);
    mockDisco[CHAVE_ACOES] = guardada;
    mockChavesIlegiveis.add(CHAVE_ACOES);

    const enfileirar = enfileirarAcaoParada(
      criarAcaoParada({
        tipo: 'concluir',
        paradaId: 'p1',
        rotaId: 'r1',
        motoristaId: 'm1',
        em: '2026-10-25T12:05:00.000Z',
      }),
    );

    await expect(enfileirar).rejects.toBeInstanceOf(FalhaDeLeituraLocal);
    expect(gravacoesEm(CHAVE_ACOES)).toHaveLength(0);
    expect(mockDisco[CHAVE_ACOES]).toBe(guardada);
  });

  it("registrarPosicao com leitura falhando devolve 'perdida' e não grava", async () => {
    const guardada = JSON.stringify({
      userId: 'm1',
      posicoes: [
        {
          motorista_id: 'm1',
          rota_id: 'r1',
          latitude: -7.1,
          longitude: -34.8,
          velocidade: null,
          precisao: 10,
          heading: null,
          timestamp: '2026-10-25T12:00:00.000Z',
        },
      ],
      estourou: false,
    });
    mockDisco[CHAVE_POSICOES] = guardada;
    mockChavesIlegiveis.add(CHAVE_POSICOES);
    mockInsert.mockResolvedValue({
      error: { message: 'TypeError: Network request failed' },
    });

    const destino = await registrarPosicao(
      {
        motorista_id: 'm1',
        rota_id: 'r1',
        latitude: -7.2,
        longitude: -34.9,
        velocidade: null,
        precisao: 10,
        heading: null,
      },
      Date.UTC(2026, 9, 25, 12, 1),
      '[Teste] posição',
    );

    expect(destino).toBe('perdida');
    expect(gravacoesEm(CHAVE_POSICOES)).toHaveLength(0);
    expect(mockDisco[CHAVE_POSICOES]).toBe(guardada);
  });

  it('queuePhotoUpload com leitura do índice falhando não grava o índice', async () => {
    const guardado = JSON.stringify([
      {
        localPath: '/docs/offline_photos/p0.jpg',
        unidadeId: 'un1',
        rotaId: 'r1',
        paradaId: 'p0',
        originalUri: 'file:///p0.jpg',
        savedAt: '2026-10-25T12:00:00.000Z',
        userId: 'm1',
      },
    ]);
    mockDisco[INDICE_FOTOS] = guardado;
    mockChavesIlegiveis.add(INDICE_FOTOS);

    await expect(
      queuePhotoUpload('un1', 'r1', 'p1', 'file:///p1.jpg'),
    ).rejects.toBeInstanceOf(FalhaDeLeituraLocal);

    expect(gravacoesEm(INDICE_FOTOS)).toHaveLength(0);
    expect(mockDisco[INDICE_FOTOS]).toBe(guardado);
  });

  it('a falha chega à tela como "não ficou salvo", não como erro genérico', () => {
    const erro = new FalhaDeLeituraLocal(INDICE_FOTOS, new Error('x'));

    expect(getErrorMessage(erro).title).toBe('Não ficou salvo');
  });
});
