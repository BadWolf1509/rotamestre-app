/**
 * A volta da rede envia a foto ANTES da conclusão/pulo guardados sem rede:
 * o comprovante sobe primeiro, depois a ação que o gestor vê.
 */
import NetInfo from '@react-native-community/netinfo';

import { sincronizarFilaAcoesParada } from '../motorista/filaAcoesParada';
import { setupOfflineSync, _resetProcessingLocks } from '../offline';
import { uploadELinkFotoParada } from '../storage';

const ordem: string[] = [];

jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(async () => ({
    isConnected: true,
    isInternetReachable: true,
  })),
  addEventListener: jest.fn(),
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

jest.mock('../storage', () => ({
  uploadELinkFotoParada: jest.fn(),
}));

jest.mock('../notifications', () => ({
  notifySyncComplete: jest.fn(),
  notifyOfflineMode: jest.fn(),
}));

jest.mock('../motorista/filaAcoesParada', () => ({
  sincronizarFilaAcoesParada: jest.fn(),
}));

beforeEach(async () => {
  ordem.length = 0;
  _resetProcessingLocks();
  const AsyncStorage = jest.requireMock(
    '@react-native-async-storage/async-storage',
  );
  AsyncStorage.__mapa.clear();
  AsyncStorage.__mapa.set(
    '@rotamestre:offline_photos_index',
    JSON.stringify([
      {
        localPath: '/docs/offline_photos/p1.jpg',
        unidadeId: 'u1',
        rotaId: 'rota-1',
        paradaId: 'p1',
        originalUri: 'file://x',
        savedAt: '2026-10-23T12:00:00Z',
      },
    ]),
  );
  (uploadELinkFotoParada as jest.Mock).mockImplementation(async () => {
    ordem.push('foto');
    return true;
  });
  (sincronizarFilaAcoesParada as jest.Mock).mockImplementation(async () => {
    ordem.push('acoes');
    return { enviadas: 1, descartadas: [], restantes: 0 };
  });
});

it('na reconexão, sobe a foto e só então envia as ações de parada', async () => {
  setupOfflineSync();
  const ouvinte = (NetInfo.addEventListener as jest.Mock).mock.calls[0][0];

  await ouvinte({ isConnected: true, isInternetReachable: true });

  expect(ordem).toEqual(['foto', 'acoes']);
});

it('sem nada de foto, as ações de parada são enviadas mesmo assim', async () => {
  const AsyncStorage = jest.requireMock(
    '@react-native-async-storage/async-storage',
  );
  AsyncStorage.__mapa.clear();
  setupOfflineSync();
  const ouvinte = (NetInfo.addEventListener as jest.Mock).mock.calls.at(-1)[0];

  await ouvinte({ isConnected: true, isInternetReachable: true });

  expect(ordem).toEqual(['acoes']);
});
