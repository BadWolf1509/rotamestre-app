/**
 * A fila de fotos offline é do APARELHO e sobrevive ao logout (comprovante de
 * entrega que ainda não subiu não pode sumir), mas cada foto é de quem a
 * tirou: só sobe com a sessão dessa pessoa. Se outra conta entrar no mesmo
 * aparelho, as fotos da primeira ficam paradas até ela voltar — não sobem
 * com a sessão errada.
 */
jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest
    .fn()
    .mockResolvedValue({ isConnected: true, isInternetReachable: true }),
  addEventListener: jest.fn(() => jest.fn()),
}));

let mockDisco: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (k: string) => mockDisco[k] ?? null),
  setItem: jest.fn(async (k: string, v: string) => {
    mockDisco[k] = v;
  }),
  removeItem: jest.fn(async (k: string) => {
    delete mockDisco[k];
  }),
}));

let mockUsuarioDaSessao: string | null = 'B';
const mockOuvintesAuth: Array<(evento: string, sessao: unknown) => unknown> =
  [];
jest.mock('../supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: jest.fn(
        (cb: (evento: string, sessao: unknown) => unknown) => {
          mockOuvintesAuth.push(cb);
          return { data: { subscription: { unsubscribe: jest.fn() } } };
        },
      ),
      getSession: jest.fn(async () => ({
        data: {
          session: mockUsuarioDaSessao
            ? { user: { id: mockUsuarioDaSessao } }
            : null,
        },
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

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: '/docs/',
  getInfoAsync: jest.fn(async () => ({ exists: true })),
  makeDirectoryAsync: jest.fn(),
  copyAsync: jest.fn(),
  deleteAsync: jest.fn(),
}));

jest.mock('../storage', () => ({
  uploadELinkFotoParada: jest.fn(async () => true),
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
  getOfflinePhotosIndex,
  getPendingPhotosCount,
  processOfflinePhotos,
  queuePhotoUpload,
  setupOfflineSync,
} from '../offline';
import { uploadELinkFotoParada } from '../storage';

const INDICE = '@rotamestre:offline_photos_index';
const CHAVE_ULTIMO = '@rotamestre:ultimo_usuario';

function foto(paradaId: string, userId?: string) {
  return {
    localPath: `/docs/offline_photos/${paradaId}.jpg`,
    unidadeId: 'un1',
    rotaId: 'r1',
    paradaId,
    originalUri: 'file:///x.jpg',
    savedAt: '2026-10-22T12:00:00.000Z',
    ...(userId ? { userId } : {}),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  _resetProcessingLocks();
  mockDisco = {};
  mockUsuarioDaSessao = 'B';
  mockOuvintesAuth.length = 0;
  Object.defineProperty(Platform, 'OS', { value: 'android', writable: true });
});

describe('fila de fotos offline por usuário', () => {
  it('guarda quem tirou a foto', async () => {
    await queuePhotoUpload('un1', 'r1', 'p1', 'file:///foto.jpg');

    const [salva] = await getOfflinePhotosIndex();
    expect(salva?.userId).toBe('B');
  });

  it('só sobe as fotos de quem está logado; as de outro ficam na fila', async () => {
    mockDisco[INDICE] = JSON.stringify([foto('pA', 'A'), foto('pB', 'B')]);

    const r = await processOfflinePhotos();

    expect(r).toEqual({ success: 1, failed: 0 });
    expect(uploadELinkFotoParada).toHaveBeenCalledTimes(1);
    expect(uploadELinkFotoParada).toHaveBeenCalledWith(
      'un1',
      'r1',
      'pB',
      '/docs/offline_photos/pB.jpg',
    );
    expect((await getOfflinePhotosIndex()).map((f) => f.paradaId)).toEqual([
      'pA',
    ]);
  });

  it('sem sessão não sobe nada e não perde nada', async () => {
    mockUsuarioDaSessao = null;
    mockDisco[INDICE] = JSON.stringify([foto('pA', 'A')]);

    const r = await processOfflinePhotos();

    expect(r).toEqual({ success: 0, failed: 0 });
    expect(uploadELinkFotoParada).not.toHaveBeenCalled();
    expect(await getOfflinePhotosIndex()).toHaveLength(1);
  });

  it('foto de versão antiga (sem dono) sobe com a sessão atual, como antes', async () => {
    mockDisco[INDICE] = JSON.stringify([foto('pLegada')]);

    const r = await processOfflinePhotos();

    expect(r).toEqual({ success: 1, failed: 0 });
  });

  it('sessão vencida offline (getSession null): o dono vem do último usuário logado', async () => {
    mockDisco[CHAVE_ULTIMO] = 'A';
    mockUsuarioDaSessao = null;

    await queuePhotoUpload('un1', 'r1', 'p1', 'file:///foto.jpg');

    const [salva] = await getOfflinePhotosIndex();
    expect(salva?.userId).toBe('A');
  });

  it('foto nova sem dono conhecido NÃO sobe com a sessão de outra pessoa', async () => {
    mockUsuarioDaSessao = null;
    await queuePhotoUpload('un1', 'r1', 'p1', 'file:///foto.jpg');

    mockUsuarioDaSessao = 'B';
    const r = await processOfflinePhotos();

    expect(r).toEqual({ success: 0, failed: 0 });
    expect(uploadELinkFotoParada).not.toHaveBeenCalled();
    expect(await getOfflinePhotosIndex()).toHaveLength(1);
  });

  it('pendentes conta só as fotos de quem está no aparelho (e as antigas sem dono)', async () => {
    mockDisco[INDICE] = JSON.stringify([
      foto('pA', 'A'),
      foto('pB', 'B'),
      foto('pLegada'),
    ]);

    await expect(getPendingPhotosCount()).resolves.toBe(2);
  });
});

describe('fila de fotos e login', () => {
  it('ao entrar (SIGNED_IN) sobe as fotos pendentes da pessoa e guarda quem é', async () => {
    mockDisco[INDICE] = JSON.stringify([foto('pB', 'B')]);
    const parar = setupOfflineSync();

    await mockOuvintesAuth[0]?.('SIGNED_IN', { user: { id: 'B' } });
    await new Promise((r) => setTimeout(r, 0));

    expect(uploadELinkFotoParada).toHaveBeenCalledTimes(1);
    expect(mockDisco[CHAVE_ULTIMO]).toBe('B');
    parar();
  });
});
