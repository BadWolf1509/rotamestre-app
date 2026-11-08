/**
 * Incidente reportado sem rede sobe pelo ponto único de envio
 * (`solicitarEnvioFila`), na volta da rede: depois da foto de comprovante e
 * das ações de parada, na ordem em que foi reportado, com a sua foto subindo
 * antes da linha — e sem gatilho próprio em paralelo.
 */
import NetInfo from '@react-native-community/netinfo';

import { sincronizarFilaAcoesParada } from '../motorista/filaAcoesParada';
import {
  enfileirarIncidente,
  lerFilaIncidentes,
  _resetFilaIncidentes,
} from '../motorista/filaIncidentes';
import {
  setupOfflineSync,
  solicitarEnvioFila,
  _resetProcessingLocks,
} from '../offline';
import { enviarFotoDeIncidente, subirFotoDaFilaOffline } from '../storage';

const ordem: string[] = [];
const mockLinhas: { id: string; descricao: string; foto_url: string | null }[] =
  [];

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
  makeDirectoryAsync: jest.fn(async () => undefined),
  copyAsync: jest.fn(async () => undefined),
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
    from: jest.fn((tabela: string) => {
      if (tabela === 'incidentes') {
        return {
          insert: async (linha: {
            id: string;
            descricao: string;
            foto_url: string | null;
          }) => {
            ordem.push(`incidente:${linha.descricao}`);
            mockLinhas.push(linha);
            return { error: null };
          },
        };
      }
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { unidade_id: 'u1' },
              error: null,
            }),
          }),
        }),
      };
    }),
  },
}));

jest.mock('../storage', () => ({
  subirFotoDaFilaOffline: jest.fn(),
  enviarFotoDeIncidente: jest.fn(),
}));

jest.mock('../queries', () => ({ logIncidenteAction: jest.fn() }));

jest.mock('../notifications', () => ({
  notifySyncComplete: jest.fn(),
  notifyOfflineMode: jest.fn(),
  notifyEnviosDescartados: jest.fn(),
}));

jest.mock('../motorista/filaAcoesParada', () => ({
  ...jest.requireActual('../motorista/filaAcoesParada'),
  sincronizarFilaAcoesParada: jest.fn(),
  lerFilaAcoesParada: jest.fn(async () => []),
  lerUsuarioParaEnvio: jest.fn(async () => 'mot-1'),
}));

function incidente(n: number, foto?: string) {
  return {
    id: `00000000-0000-4000-8000-00000000000${n}`,
    motoristaId: 'mot-1',
    rotaId: 'rota-1',
    paradaId: 'p1',
    categoria: 'blocked' as const,
    descricao: `i${n}`,
    endereco: 'Rua A',
    fotoLocal: foto,
    em: '2026-11-08T12:00:00Z',
    tentativas: 0,
  };
}

beforeEach(async () => {
  ordem.length = 0;
  mockLinhas.length = 0;
  _resetProcessingLocks();
  _resetFilaIncidentes();
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
  (subirFotoDaFilaOffline as jest.Mock).mockImplementation(async () => {
    ordem.push('foto');
    return true;
  });
  (sincronizarFilaAcoesParada as jest.Mock).mockImplementation(async () => {
    ordem.push('acoes');
    return { enviadas: 1, descartadas: [], restantes: 0 };
  });
  (enviarFotoDeIncidente as jest.Mock).mockImplementation(
    async (_uri: string, nome: string) => {
      ordem.push('foto-incidente');
      return `incidentes/${nome}`;
    },
  );
});

it('na volta da rede: comprovante, ações e então os incidentes, na ordem, com a foto antes da linha', async () => {
  await enfileirarIncidente(incidente(1, 'file:///cache/cam.jpg'));
  await enfileirarIncidente(incidente(2));
  setupOfflineSync();
  const ouvinte = (NetInfo.addEventListener as jest.Mock).mock.calls.at(-1)[0];

  await ouvinte({ isConnected: true, isInternetReachable: true });

  expect(ordem).toEqual([
    'foto',
    'acoes',
    'foto-incidente',
    'incidente:i1',
    'incidente:i2',
  ]);
  expect(mockLinhas[0].id).toBe(incidente(1).id);
  expect(mockLinhas[0].foto_url).toMatch(/^incidentes\//);
  expect(await lerFilaIncidentes()).toEqual([]);
});

it('pedidos simultâneos não enviam o mesmo incidente duas vezes', async () => {
  await enfileirarIncidente(incidente(3));

  await Promise.all([
    solicitarEnvioFila(),
    solicitarEnvioFila(),
    solicitarEnvioFila(),
  ]);

  expect(ordem.filter((o) => o === 'incidente:i3')).toHaveLength(1);
});

it('o resultado do envio conta os incidentes que subiram', async () => {
  await enfileirarIncidente(incidente(4));
  const r = await solicitarEnvioFila();
  expect(r.incidentes).toBe(1);
});
