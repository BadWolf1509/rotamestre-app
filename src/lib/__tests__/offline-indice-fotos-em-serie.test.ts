/**
 * O índice de fotos offline é um item só no AsyncStorage, lido e regravado
 * inteiro. Sem fila em série, a remoção da foto que acabou de subir e a
 * inclusão de uma foto nova liam o mesmo índice, e quem gravava por último
 * apagava a outra: o comprovante novo sumia da fila (OFF-3).
 */
jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest
    .fn()
    .mockResolvedValue({ isConnected: true, isInternetReachable: true }),
  addEventListener: jest.fn(() => jest.fn()),
}));

const INDICE = '@rotamestre:offline_photos_index';
let mockDisco: Record<string, string> = {};
/** Liga para segurar a PRÓXIMA leitura do índice (resposta atrasada). */
let mockSegurarProximaLeitura = false;
let mockSoltarLeitura: (() => void) | null = null;
let mockAvisarLeituraSegurada: (() => void) | null = null;
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (k: string) => {
    // O valor é o do disco NO MOMENTO da leitura; só a resposta atrasa.
    const valor = mockDisco[k] ?? null;
    if (k === '@rotamestre:offline_photos_index' && mockSegurarProximaLeitura) {
      mockSegurarProximaLeitura = false;
      await new Promise<void>((soltar) => {
        mockSoltarLeitura = soltar;
        mockAvisarLeituraSegurada?.();
      });
    }
    return valor;
  }),
  setItem: jest.fn(async (k: string, v: string) => {
    mockDisco[k] = v;
  }),
  removeItem: jest.fn(async (k: string) => {
    delete mockDisco[k];
  }),
}));

jest.mock('../supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(async () => ({
        data: { session: { user: { id: 'U' } } },
        error: null,
      })),
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          maybeSingle: jest.fn(async () => ({
            data: { unidade_id: 'un1' },
            error: null,
          })),
        })),
      })),
    })),
  },
}));

jest.mock('../auth/sessao', () => ({
  lerSessao: jest.fn(async () => ({
    session: { user: { id: 'U' } },
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
  // O upload de A deu certo; a leitura do índice que vem logo depois (a da
  // remoção de A) é a que fica segurada.
  subirFotoDaFilaOffline: jest.fn(async () => {
    mockSegurarProximaLeitura = true;
    return true;
  }),
}));

jest.mock('../logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

jest.mock('../notifications', () => ({
  notifySyncComplete: jest.fn(),
  notifyOfflineMode: jest.fn(),
}));

import { Platform } from 'react-native';

import {
  _resetProcessingLocks,
  processOfflinePhotos,
  queuePhotoUpload,
} from '../offline';

/** Deixa rodar tudo o que não depende da leitura segurada. */
async function escoar() {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setImmediate(r));
  }
}

beforeEach(() => {
  jest.clearAllMocks();
  _resetProcessingLocks();
  mockDisco = {};
  mockSegurarProximaLeitura = false;
  mockSoltarLeitura = null;
  mockAvisarLeituraSegurada = null;
  Object.defineProperty(Platform, 'OS', { value: 'android', writable: true });
});

describe('índice de fotos offline em série', () => {
  it('remoção e inclusão concorrentes não perdem a foto', async () => {
    mockDisco[INDICE] = JSON.stringify([
      {
        localPath: '/docs/offline_photos/A.jpg',
        unidadeId: 'un1',
        rotaId: 'r1',
        paradaId: 'A',
        originalUri: 'file:///a.jpg',
        savedAt: '2026-10-25T12:00:00.000Z',
        userId: 'U',
      },
    ]);
    const leituraSegurada = new Promise<void>((r) => {
      mockAvisarLeituraSegurada = r;
    });

    // A sobe e a remoção dela lê o índice — a resposta atrasa.
    const envio = processOfflinePhotos();
    await leituraSegurada;

    // Enquanto isso, o motorista tira a foto de B.
    const inclusao = queuePhotoUpload('un1', 'r1', 'B', 'file:///b.jpg');
    await escoar();

    mockSoltarLeitura?.();
    await expect(envio).resolves.toEqual({ success: 1, failed: 0 });
    await inclusao;

    const indice = JSON.parse(mockDisco[INDICE]) as { paradaId: string }[];
    expect(indice.map((p) => p.paradaId)).toEqual(['B']);
  });
});
