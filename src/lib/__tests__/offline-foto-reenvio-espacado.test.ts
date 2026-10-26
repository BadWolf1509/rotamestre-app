/**
 * Foto que nunca consegue subir (ex.: vínculo com a loja desativado, a policy
 * do bucket recusa) era reenviada inteira — 1 a 3 MB, em dados móveis — a
 * cada abertura, volta ao primeiro plano, puxar para atualizar e mudança de
 * rede, para sempre. Agora a fila conta as falhas por foto e, passado o
 * limite, espaça os reenvios. NUNCA apaga: é comprovante de entrega.
 */
import * as FileSystem from 'expo-file-system/legacy';

import {
  _resetProcessingLocks,
  ESPACO_REENVIO_FOTO_MS,
  LIMITE_FALHAS_FOTO,
  processOfflinePhotos,
} from '../offline';
import { subirFotoDaFilaOffline } from '../storage';

const CHAVE_FOTOS = '@rotamestre:offline_photos_index';

jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(async () => ({
    isConnected: true,
    isInternetReachable: true,
  })),
  addEventListener: jest.fn(() => jest.fn()),
}));

jest.mock('@react-native-async-storage/async-storage', () => {
  const mapa = new Map<string, string>();
  return {
    __mapa: mapa,
    getItem: jest.fn(async (k: string) => mapa.get(k) ?? null),
    setItem: jest.fn(async (k: string, v: string) => {
      mapa.set(k, v);
    }),
    removeItem: jest.fn(async (k: string) => {
      mapa.delete(k);
    }),
  };
});

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: '/docs/',
  getInfoAsync: jest.fn(async () => ({ exists: true })),
  deleteAsync: jest.fn(async () => undefined),
}));

jest.mock('../supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(async () => ({
        data: { session: { user: { id: 'mot-1' } } },
      })),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
    },
    from: jest.fn(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { unidade_id: 'u1' },
            error: null,
          }),
        }),
      }),
    })),
  },
}));

jest.mock('../storage', () => ({ subirFotoDaFilaOffline: jest.fn() }));
jest.mock('../notifications', () => ({
  notifySyncComplete: jest.fn(),
  notifyOfflineMode: jest.fn(),
}));

function disco(): Map<string, string> {
  return jest.requireMock('@react-native-async-storage/async-storage').__mapa;
}
const indice = () => JSON.parse(disco().get(CHAVE_FOTOS) ?? '[]');

const FOTO = {
  localPath: '/docs/offline_photos/p1.jpg',
  unidadeId: 'u1',
  rotaId: 'rota-1',
  paradaId: 'p1',
  originalUri: 'file://x',
  savedAt: '2026-10-23T12:00:00Z',
  userId: 'mot-1',
};

let agora = Date.parse('2026-10-26T12:00:00Z');

beforeEach(() => {
  jest.clearAllMocks();
  _resetProcessingLocks();
  disco().clear();
  disco().set(CHAVE_FOTOS, JSON.stringify([FOTO]));
  agora = Date.parse('2026-10-26T12:00:00Z');
  jest.spyOn(Date, 'now').mockImplementation(() => agora);
  (subirFotoDaFilaOffline as jest.Mock).mockResolvedValue(null);
});

afterEach(() => {
  jest.restoreAllMocks();
});

async function rodadas(n: number) {
  for (let i = 0; i < n; i++) await processOfflinePhotos();
}

it('cada falha fica contada na foto, e a foto continua no aparelho', async () => {
  await rodadas(2);
  expect(indice()).toEqual([expect.objectContaining({ falhas: 2 })]);
  expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
});

it('passado o limite, não reenvia a cada gatilho: espera o intervalo', async () => {
  await rodadas(LIMITE_FALHAS_FOTO);
  expect(subirFotoDaFilaOffline).toHaveBeenCalledTimes(LIMITE_FALHAS_FOTO);

  // Gatilhos seguidos (abrir, voltar ao primeiro plano, puxar): nada sobe
  await rodadas(3);
  expect(subirFotoDaFilaOffline).toHaveBeenCalledTimes(LIMITE_FALHAS_FOTO);

  // Passado o intervalo, tenta de novo — e nunca apaga
  agora += ESPACO_REENVIO_FOTO_MS + 1;
  await rodadas(1);
  expect(subirFotoDaFilaOffline).toHaveBeenCalledTimes(LIMITE_FALHAS_FOTO + 1);
  expect(indice()).toHaveLength(1);
});

it('quando enfim sobe, sai do índice como qualquer outra', async () => {
  await rodadas(LIMITE_FALHAS_FOTO);
  agora += ESPACO_REENVIO_FOTO_MS + 1;
  (subirFotoDaFilaOffline as jest.Mock).mockResolvedValue({
    resultado: 'ligada',
    path: 'u1/rota-1/p1.jpg',
  });
  await rodadas(1);
  expect(indice()).toEqual([]);
});
