/**
 * Foto que nunca consegue subir (ex.: vínculo com a loja desativado, a policy
 * do bucket recusa) era reenviada inteira — 1 a 3 MB, em dados móveis — a
 * cada abertura, volta ao primeiro plano, puxar para atualizar e mudança de
 * rede, para sempre. Agora a fila conta as recusas por foto e espaça os
 * reenvios com recuo curto (1, 5, 15, 60 min). Falha de REDE não conta: com o
 * sinal de volta, o comprovante sobe na hora. NUNCA apaga: é comprovante.
 */
import * as FileSystem from 'expo-file-system/legacy';

import {
  _resetProcessingLocks,
  processOfflinePhotos,
  RECUO_REENVIO_FOTO_MS,
} from '../offline';
import { subirFotoDaFilaOffline } from '../storage';

const CHAVE_FOTOS = '@rotamestre:offline_photos_index';
const MIN = 60 * 1000;

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

/** Resposta da leitura da loja da rota (antes do upload). */
let mockRota: { data: unknown; error: unknown } = {
  data: { unidade_id: 'u1' },
  error: null,
};

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
          maybeSingle: async () => mockRota,
        }),
      }),
    })),
  },
}));

/** Queda de rede observada pelo `fetch` do Supabase (nativo). */
let mockRedeCaida = false;
jest.mock('../redeObservada', () => ({
  redeCaidaObservada: () => mockRedeCaida,
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
  mockRedeCaida = false;
  mockRota = { data: { unidade_id: 'u1' }, error: null };
  (subirFotoDaFilaOffline as jest.Mock).mockResolvedValue(null);
});

afterEach(() => {
  jest.restoreAllMocks();
});

const enviar = () => processOfflinePhotos();

it('o recuo é curto e cresce: 1, 5, 15 e 60 min', () => {
  expect(RECUO_REENVIO_FOTO_MS).toEqual([1 * MIN, 5 * MIN, 15 * MIN, 60 * MIN]);
});

it('recusa que não é de rede conta, e a foto continua no aparelho', async () => {
  await enviar();
  expect(indice()).toEqual([expect.objectContaining({ falhas: 1 })]);
  expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
});

it('falha com a queda de rede observada NÃO conta: volta o sinal, sobe na hora', async () => {
  mockRedeCaida = true;
  await enviar();
  await enviar();
  expect(indice()[0].falhas ?? 0).toBe(0);

  // Sinal de volta, logo em seguida: tenta já, sem esperar recuo nenhum
  mockRedeCaida = false;
  (subirFotoDaFilaOffline as jest.Mock).mockResolvedValue({
    resultado: 'ligada',
    path: 'u1/rota-1/p1.jpg',
  });
  await enviar();
  expect(indice()).toEqual([]);
});

it('erro de rede lançado (leitura da rota) também não conta', async () => {
  mockRota = {
    data: null,
    error: { message: 'TypeError: Network request failed', code: '' },
  };
  await enviar();
  expect(indice()[0].falhas ?? 0).toBe(0);
});

it('erro definitivo lançado (ex.: 42501) conta', async () => {
  mockRota = {
    data: null,
    error: { message: 'permission denied', code: '42501' },
  };
  await enviar();
  expect(indice()[0].falhas).toBe(1);
});

it('entre recusas, espera o recuo da vez antes de reenviar', async () => {
  await enviar(); // 1ª recusa: espera 1 min
  expect(subirFotoDaFilaOffline).toHaveBeenCalledTimes(1);

  await enviar(); // gatilho logo depois: não reenvia
  expect(subirFotoDaFilaOffline).toHaveBeenCalledTimes(1);

  agora += 1 * MIN + 1;
  await enviar(); // 2ª recusa: espera 5 min
  expect(subirFotoDaFilaOffline).toHaveBeenCalledTimes(2);

  agora += 1 * MIN + 1;
  await enviar(); // só 1 min depois: ainda esperando
  expect(subirFotoDaFilaOffline).toHaveBeenCalledTimes(2);

  agora += 4 * MIN;
  await enviar();
  expect(subirFotoDaFilaOffline).toHaveBeenCalledTimes(3);
  expect(indice()).toHaveLength(1);
});

it('depois da 4ª recusa, no máximo um reenvio por hora — nunca apaga', async () => {
  for (const espera of [0, 1, 5, 15]) {
    agora += espera * MIN + 1;
    await enviar();
  }
  expect(subirFotoDaFilaOffline).toHaveBeenCalledTimes(4);

  agora += 30 * MIN;
  await enviar();
  expect(subirFotoDaFilaOffline).toHaveBeenCalledTimes(4);

  agora += 30 * MIN + 1;
  await enviar();
  expect(subirFotoDaFilaOffline).toHaveBeenCalledTimes(5);
  expect(indice()).toHaveLength(1);
});
