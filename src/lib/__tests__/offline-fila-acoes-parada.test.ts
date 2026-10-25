/**
 * A volta da rede envia a foto ANTES da conclusão/pulo guardados sem rede:
 * o comprovante sobe primeiro, depois a ação que o gestor vê.
 */
import NetInfo from '@react-native-community/netinfo';

import { sincronizarFilaAcoesParada } from '../motorista/filaAcoesParada';
import {
  processOfflinePhotos,
  setupOfflineSync,
  solicitarEnvioFila,
  _resetProcessingLocks,
} from '../offline';
import { subirFotoDaFilaOffline } from '../storage';

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

const mockOuvintesAuth: ((
  evento: string,
  sessao: { user: { id: string } } | null,
) => void)[] = [];

jest.mock('../supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(async () => ({
        data: { session: { user: { id: 'mot-1' } } },
      })),
      onAuthStateChange: jest.fn((fn) => {
        mockOuvintesAuth.push(fn);
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      }),
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

jest.mock('../storage', () => ({
  subirFotoDaFilaOffline: jest.fn(),
}));

jest.mock('../notifications', () => ({
  notifySyncComplete: jest.fn(),
  notifyOfflineMode: jest.fn(),
}));

jest.mock('../motorista/filaAcoesParada', () => ({
  sincronizarFilaAcoesParada: jest.fn(),
  lerFilaAcoesParada: jest.fn(async () => []),
  lerDescartesDaFila: jest.fn(async () => []),
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
  (subirFotoDaFilaOffline as jest.Mock).mockImplementation(async () => {
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

describe('solicitarEnvioFila (ponto único de envio)', () => {
  it('fotos antes das ações', async () => {
    await solicitarEnvioFila();
    expect(ordem).toEqual(['foto', 'acoes']);
  });

  it('pedidos durante um envio se juntam numa rodada extra, não em paralelo', async () => {
    let liberar: () => void = () => undefined;
    (subirFotoDaFilaOffline as jest.Mock).mockImplementationOnce(async () => {
      ordem.push('foto');
      await new Promise<void>((r) => {
        liberar = r;
      });
      return true;
    });

    const a = solicitarEnvioFila();
    const b = solicitarEnvioFila();
    const c = solicitarEnvioFila();
    await new Promise((r) => setTimeout(r, 0));
    liberar();
    await Promise.all([a, b, c]);

    // 1ª rodada (foto + ações) e UMA rodada extra pelos pedidos que chegaram
    // no meio (sem foto pendente, só ações).
    expect(ordem).toEqual(['foto', 'acoes', 'acoes']);
  });

  it('se o envio de fotos já está rodando por outro caminho, as ações esperam por ele', async () => {
    let liberar: () => void = () => undefined;
    (subirFotoDaFilaOffline as jest.Mock).mockImplementationOnce(async () => {
      await new Promise<void>((r) => {
        liberar = r;
      });
      ordem.push('foto');
      return true;
    });

    const fotosPorFora = processOfflinePhotos();
    await new Promise((r) => setTimeout(r, 0));
    const envio = solicitarEnvioFila();
    await new Promise((r) => setTimeout(r, 0));
    expect(ordem).toEqual([]);
    liberar();
    await Promise.all([fotosPorFora, envio]);

    expect(ordem[0]).toBe('foto');
    expect(ordem).toContain('acoes');
  });

  it('sem rede, não tenta nada', async () => {
    (NetInfo.fetch as jest.Mock).mockResolvedValueOnce({
      isConnected: false,
      isInternetReachable: false,
    });
    await solicitarEnvioFila();
    expect(ordem).toEqual([]);
  });
});

it('ao entrar (SIGNED_IN), adota/sobe as fotos e depois envia as ações de parada', async () => {
  const parar = setupOfflineSync();
  mockOuvintesAuth.at(-1)?.('SIGNED_IN', { user: { id: 'mot-1' } });
  await new Promise((r) => setTimeout(r, 10));

  expect(ordem).toEqual(['foto', 'acoes']);
  parar();
});

// MOT-5: a notificação "Modo Offline" só olhava a fila genérica (que ninguém
// alimenta) e as fotos. Conclusão/pulo guardados sem foto — o caso comum do
// pular — não avisavam. Conta só as ações de quem está no aparelho, como as
// fotos (`getPendingPhotosCount`): as de outra conta não sobem agora.
describe('notificação "Modo Offline" ao perder a rede', () => {
  const { notifyOfflineMode } = jest.requireMock('../notifications') as {
    notifyOfflineMode: jest.Mock;
  };
  const { lerFilaAcoesParada } = jest.requireMock(
    '../motorista/filaAcoesParada',
  ) as { lerFilaAcoesParada: jest.Mock };

  function acaoDe(motoristaId: string) {
    return {
      id: `a-${motoristaId}`,
      tipo: 'pular',
      paradaId: 'p1',
      rotaId: 'rota-1',
      motoristaId,
      em: '2026-10-24T12:00:00.000Z',
    };
  }

  async function perderARede() {
    const AsyncStorage = jest.requireMock(
      '@react-native-async-storage/async-storage',
    );
    AsyncStorage.__mapa.clear(); // sem foto pendente
    notifyOfflineMode.mockClear();
    setupOfflineSync();
    const ouvinte = (NetInfo.addEventListener as jest.Mock).mock.calls.at(
      -1,
    )[0];
    await ouvinte({ isConnected: false, isInternetReachable: false });
  }

  afterEach(() => {
    lerFilaAcoesParada.mockResolvedValue([]);
  });

  it('avisa quando há pulo/conclusão desta conta guardado, mesmo sem foto', async () => {
    lerFilaAcoesParada.mockResolvedValue([acaoDe('mot-1')]);
    await perderARede();
    expect(notifyOfflineMode).toHaveBeenCalledTimes(1);
  });

  it('não avisa por ação deixada por OUTRA conta', async () => {
    lerFilaAcoesParada.mockResolvedValue([acaoDe('mot-2')]);
    await perderARede();
    expect(notifyOfflineMode).not.toHaveBeenCalled();
  });

  it('sem nada guardado, não avisa', async () => {
    await perderARede();
    expect(notifyOfflineMode).not.toHaveBeenCalled();
  });
});
