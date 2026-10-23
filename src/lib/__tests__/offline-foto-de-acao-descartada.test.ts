/**
 * Foto de comprovante x ação da fila descartada.
 *
 * Regra: comprovante NUNCA é apagado do aparelho sem ter subido. O descarte
 * da conclusão (parada removida, rota reatribuída ou encerrada, status
 * divergente, recusa persistente) não decide nada sobre a foto: ela sobe
 * pelo `subirFotoDaFilaOffline`, que liga na parada quando pode e, quando
 * não pode, registra o caminho em `logs` para o gestor recuperar. A foto só
 * sai do aparelho quando esse envio confirma o destino.
 */
import * as FileSystem from 'expo-file-system/legacy';

import { solicitarEnvioFila, _resetProcessingLocks } from '../offline';
import { subirFotoDaFilaOffline } from '../storage';

const CHAVE_FILA = '@rotamestre:fila_acoes_parada';
const CHAVE_DESCARTES = '@rotamestre:fila_acoes_parada_descartes';
const CHAVE_FOTOS = '@rotamestre:offline_photos_index';

const ordem: string[] = [];
/** O que `rotas` devolve (null = rota passada a outro motorista, RLS). */
let mockRotaVisivel: { unidade_id: string } | null = { unidade_id: 'u1' };

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
          maybeSingle: async () => ({ data: mockRotaVisivel, error: null }),
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

let mockDescartar = new Set<string>();

jest.mock('../motorista/filaAcoesParada', () => ({
  ...jest.requireActual('../motorista/filaAcoesParada'),
  sincronizarFilaAcoesParada: jest.fn(),
}));

function disco(): Map<string, string> {
  return jest.requireMock('@react-native-async-storage/async-storage').__mapa;
}
const ler = (k: string) => JSON.parse(disco().get(k) ?? '[]');

const acao = (paradaId: string) => ({
  id: `a-${paradaId}`,
  tipo: 'concluir',
  paradaId,
  rotaId: 'rota-1',
  motoristaId: 'mot-1',
  em: '2026-10-23T12:00:00.000Z',
  tentativas: 0,
});
const foto = (paradaId: string, userId = 'mot-1') => ({
  localPath: `/docs/offline_photos/${paradaId}.jpg`,
  unidadeId: 'u-da-captura',
  rotaId: 'rota-1',
  paradaId,
  originalUri: 'file://x',
  savedAt: '2026-10-23T12:00:00Z',
  userId,
});

beforeEach(() => {
  ordem.length = 0;
  mockDescartar = new Set();
  mockRotaVisivel = { unidade_id: 'u1' };
  _resetProcessingLocks();
  disco().clear();
  (FileSystem.deleteAsync as jest.Mock).mockClear();
  (subirFotoDaFilaOffline as jest.Mock).mockReset();
  (subirFotoDaFilaOffline as jest.Mock).mockImplementation(
    async ({ paradaId }: { paradaId: string }) => {
      ordem.push(`foto:${paradaId}`);
      return { resultado: 'registrada', path: `u1/rota-1/${paradaId}.jpg` };
    },
  );
  const { sincronizarFilaAcoesParada } = jest.requireMock(
    '../motorista/filaAcoesParada',
  );
  (sincronizarFilaAcoesParada as jest.Mock).mockImplementation(async () => {
    // Simula o servidor: a ação sai da fila; a descartada vira descarte.
    const fila = ler(CHAVE_FILA) as ReturnType<typeof acao>[];
    const descartadas = [];
    for (const a of fila) {
      ordem.push(`acao:${a.paradaId}`);
      if (mockDescartar.has(a.paradaId)) {
        const d = { acao: a, motivo: 'rota_encerrada', em: 'agora' };
        descartadas.push(d);
        disco().set(
          CHAVE_DESCARTES,
          JSON.stringify([...ler(CHAVE_DESCARTES), d]),
        );
      }
    }
    disco().set(CHAVE_FILA, '[]');
    return {
      enviadas: fila.length - descartadas.length,
      descartadas,
      restantes: 0,
    };
  });
});

describe('foto de comprovante x ação descartada', () => {
  it('ação descartada não apaga a foto: ela sobe (antes da ação, como sempre)', async () => {
    disco().set(CHAVE_FILA, JSON.stringify([acao('p1')]));
    disco().set(CHAVE_FOTOS, JSON.stringify([foto('p1')]));
    mockDescartar.add('p1');

    await solicitarEnvioFila();

    expect(ordem).toEqual(['foto:p1', 'acao:p1']);
  });

  it('descarte já registrado não impede o envio da foto que ficou', async () => {
    disco().set(
      CHAVE_DESCARTES,
      JSON.stringify([
        { acao: acao('p1'), motivo: 'parada_removida', em: 'x' },
      ]),
    );
    disco().set(CHAVE_FOTOS, JSON.stringify([foto('p1')]));

    await solicitarEnvioFila();

    expect(ordem).toEqual(['foto:p1']);
    expect(ler(CHAVE_FOTOS)).toEqual([]);
  });

  it('envio sem destino confirmado (null): a foto e o arquivo FICAM no aparelho', async () => {
    (subirFotoDaFilaOffline as jest.Mock).mockResolvedValue(null);
    disco().set(CHAVE_FOTOS, JSON.stringify([foto('p1')]));

    await solicitarEnvioFila();

    expect(ler(CHAVE_FOTOS)).toHaveLength(1);
    expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
  });

  it('rota passada a outro motorista (invisível): sobe pela loja gravada na captura', async () => {
    mockRotaVisivel = null;
    disco().set(CHAVE_FOTOS, JSON.stringify([foto('p1')]));

    await solicitarEnvioFila();

    expect(subirFotoDaFilaOffline).toHaveBeenCalledWith(
      expect.objectContaining({
        unidadeId: 'u-da-captura',
        rotaId: 'rota-1',
        paradaId: 'p1',
        usuarioId: 'mot-1',
      }),
    );
    expect(ler(CHAVE_FOTOS)).toEqual([]);
  });

  it('foto de OUTRA conta não sobe nem sai do aparelho', async () => {
    disco().set(CHAVE_FOTOS, JSON.stringify([foto('p1', 'outra-conta')]));

    await solicitarEnvioFila();

    expect(subirFotoDaFilaOffline).not.toHaveBeenCalled();
    expect(ler(CHAVE_FOTOS)).toHaveLength(1);
    expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
  });
});
