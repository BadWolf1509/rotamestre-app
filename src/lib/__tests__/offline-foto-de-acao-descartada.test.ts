/**
 * Foto de comprovante cuja conclusão está na fila do aparelho só sobe
 * DEPOIS que o servidor aceita a conclusão. Se a ação for descartada
 * (parada removida, rota passada a outro motorista ou encerrada, status
 * divergente), a foto não sobe: subir deixaria um objeto sem referência no
 * Storage (parada invisível) ou um comprovante ligado a uma parada aberta.
 *
 * A fila de ações é a real (AsyncStorage em memória); só a decisão do
 * servidor (`sincronizarFilaAcoesParada`) é simulada, mexendo no disco do
 * mesmo jeito que o módulo real.
 */
import * as FileSystem from 'expo-file-system/legacy';

import { solicitarEnvioFila, _resetProcessingLocks } from '../offline';
import { uploadELinkFotoParada } from '../storage';

const CHAVE_FILA = '@rotamestre:fila_acoes_parada';
const CHAVE_DESCARTES = '@rotamestre:fila_acoes_parada_descartes';
const CHAVE_FOTOS = '@rotamestre:offline_photos_index';

const ordem: string[] = [];

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

jest.mock('../storage', () => ({ uploadELinkFotoParada: jest.fn() }));
jest.mock('../notifications', () => ({
  notifySyncComplete: jest.fn(),
  notifyOfflineMode: jest.fn(),
}));

type Decisao = 'aceita' | 'descartada';
let decisoes: Record<string, Decisao> = {};

jest.mock('../motorista/filaAcoesParada', () => {
  const real = jest.requireActual('../motorista/filaAcoesParada');
  return {
    ...real,
    sincronizarFilaAcoesParada: jest.fn(),
  };
});

function disco(): Map<string, string> {
  return jest.requireMock('@react-native-async-storage/async-storage').__mapa;
}
const ler = (k: string) => JSON.parse(disco().get(k) ?? '[]');

const acao = (paradaId: string, motoristaId = 'mot-1') => ({
  id: `a-${paradaId}`,
  tipo: 'concluir',
  paradaId,
  rotaId: 'rota-1',
  motoristaId,
  em: '2026-10-23T12:00:00.000Z',
  tentativas: 0,
});
const foto = (paradaId: string, userId = 'mot-1') => ({
  localPath: `/docs/offline_photos/${paradaId}.jpg`,
  unidadeId: 'u1',
  rotaId: 'rota-1',
  paradaId,
  originalUri: 'file://x',
  savedAt: '2026-10-23T12:00:00Z',
  userId,
});

beforeEach(() => {
  ordem.length = 0;
  decisoes = {};
  _resetProcessingLocks();
  disco().clear();
  (FileSystem.deleteAsync as jest.Mock).mockClear();
  (uploadELinkFotoParada as jest.Mock).mockImplementation(
    async (_u: string, _r: string, paradaId: string) => {
      ordem.push(`foto:${paradaId}`);
      return true;
    },
  );
  const { sincronizarFilaAcoesParada } = jest.requireMock(
    '../motorista/filaAcoesParada',
  );
  (sincronizarFilaAcoesParada as jest.Mock).mockImplementation(async () => {
    // Simula o servidor: cada ação da conta sai da fila; a descartada vira
    // descarte persistido, como em `processarFilaAcoesParada`.
    const fila = ler(CHAVE_FILA) as ReturnType<typeof acao>[];
    const minhas = fila.filter((a) => a.motoristaId === 'mot-1');
    const descartadas = [];
    for (const a of minhas) {
      ordem.push(`acao:${a.paradaId}`);
      if (decisoes[a.paradaId] === 'descartada') {
        const d = {
          acao: a,
          motivo: 'rota_encerrada',
          em: new Date().toISOString(),
        };
        descartadas.push(d);
        disco().set(
          CHAVE_DESCARTES,
          JSON.stringify([...ler(CHAVE_DESCARTES), d]),
        );
      }
    }
    disco().set(
      CHAVE_FILA,
      JSON.stringify(fila.filter((a) => a.motoristaId !== 'mot-1')),
    );
    return {
      enviadas: minhas.length - descartadas.length,
      descartadas,
      restantes: 0,
    };
  });
});

describe('foto de comprovante x ação da fila', () => {
  it('foto de conclusão na fila sobe só depois que a conclusão é aceita', async () => {
    disco().set(CHAVE_FILA, JSON.stringify([acao('p1')]));
    disco().set(CHAVE_FOTOS, JSON.stringify([foto('p1')]));
    decisoes.p1 = 'aceita';

    await solicitarEnvioFila();

    expect(ordem).toEqual(['acao:p1', 'foto:p1']);
    expect(ler(CHAVE_FOTOS)).toEqual([]);
  });

  it('ação descartada: a foto não sobe e sai do aparelho', async () => {
    disco().set(CHAVE_FILA, JSON.stringify([acao('p1')]));
    disco().set(CHAVE_FOTOS, JSON.stringify([foto('p1')]));
    decisoes.p1 = 'descartada';

    await solicitarEnvioFila();

    expect(ordem).toEqual(['acao:p1']);
    expect(ler(CHAVE_FOTOS)).toEqual([]);
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
      '/docs/offline_photos/p1.jpg',
      { idempotent: true },
    );
  });

  it('foto sem ação na fila continua subindo antes das ações', async () => {
    disco().set(CHAVE_FILA, JSON.stringify([acao('p2')]));
    disco().set(CHAVE_FOTOS, JSON.stringify([foto('p1'), foto('p2')]));
    decisoes.p2 = 'aceita';

    await solicitarEnvioFila();

    expect(ordem).toEqual(['foto:p1', 'acao:p2', 'foto:p2']);
  });

  it('descarte já registrado (app fechou antes de limpar a foto): a foto não sobe', async () => {
    disco().set(
      CHAVE_DESCARTES,
      JSON.stringify([
        {
          acao: acao('p1'),
          motivo: 'parada_removida',
          em: '2026-10-23T13:00:00.000Z',
        },
      ]),
    );
    disco().set(CHAVE_FOTOS, JSON.stringify([foto('p1')]));

    await solicitarEnvioFila();

    expect(ordem.filter((o) => o.startsWith('foto'))).toEqual([]);
    expect(ler(CHAVE_FOTOS)).toEqual([]);
  });

  it('foto de OUTRA conta nunca é apagada pelo descarte desta', async () => {
    disco().set(
      CHAVE_DESCARTES,
      JSON.stringify([
        {
          acao: acao('p1'),
          motivo: 'parada_removida',
          em: '2026-10-23T13:00:00.000Z',
        },
      ]),
    );
    disco().set(CHAVE_FOTOS, JSON.stringify([foto('p1', 'outra-conta')]));

    await solicitarEnvioFila();

    expect(ler(CHAVE_FOTOS)).toHaveLength(1);
    expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
  });

  it('foto nova da mesma parada, tirada DEPOIS do descarte, sobe normalmente', async () => {
    disco().set(
      CHAVE_DESCARTES,
      JSON.stringify([
        {
          acao: acao('p1'),
          motivo: 'rota_encerrada',
          em: '2026-10-23T11:00:00.000Z',
        },
      ]),
    );
    disco().set(CHAVE_FOTOS, JSON.stringify([foto('p1')])); // savedAt 12:00

    await solicitarEnvioFila();

    expect(ordem).toEqual(['foto:p1']);
  });
});
