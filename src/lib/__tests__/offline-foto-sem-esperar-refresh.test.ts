/**
 * Guardar a foto offline não pode esperar o refresh preso do auth-js.
 *
 * Teste no aparelho (25/10/2026): sem rede, "Enviar Foto" ficou ~20 s em
 * "Enviando foto... 0%". O caminho offline (`queuePhotoUpload`) lia o dono da
 * foto com `supabase.auth.getSession()` cru — que, com o token vencido e sem
 * rede, só responde depois do recuo exponencial do refresh (~25 s). O dono
 * agora vem de `lerSessao()`: modo avião responde na hora, e o prazo é o
 * compartilhado de `PRAZO_LEITURA_SESSAO_MS`, nunca o do auth-js.
 */
let mockConectado = true;
jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(async () => ({
    isConnected: mockConectado,
    isInternetReachable: mockConectado ? null : false,
  })),
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

// getSession preso: o refresh do token vencido nunca termina.
const mockGetSession = jest.fn(() => new Promise(() => undefined));
jest.mock('../supabase', () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
    },
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
  subirFotoDaFilaOffline: jest.fn(async () => true),
}));

jest.mock('../logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

jest.mock('../notifications', () => ({
  notifySyncComplete: jest.fn(),
  notifyOfflineMode: jest.fn(),
}));

import { Platform } from 'react-native';

import { descartarLeituraEmCurso, PRAZO_LEITURA_SESSAO_MS } from '../auth/sessao';
import { getOfflinePhotosIndex, queuePhotoUpload } from '../offline';

const CHAVE_ULTIMO = '@rotamestre:ultimo_usuario';

/** Deixa as microtarefas andarem sem avançar o relógio. */
async function escoar() {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  descartarLeituraEmCurso();
  mockDisco = { [CHAVE_ULTIMO]: 'motorista-1' };
  mockConectado = true;
  Object.defineProperty(Platform, 'OS', { value: 'android', writable: true });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('foto offline com o refresh do token preso', () => {
  it('sem rede confirmada, guarda na hora sem perguntar ao auth-js', async () => {
    mockConectado = false;
    let pronto = false;
    void queuePhotoUpload('un1', 'r1', 'p1', 'file:///foto.jpg').then(() => {
      pronto = true;
    });

    await escoar();

    expect(pronto).toBe(true);
    expect(mockGetSession).not.toHaveBeenCalled();
    const [salva] = await getOfflinePhotosIndex();
    expect(salva?.userId).toBe('motorista-1');
  });

  it('"conectado" sem resposta: guarda no prazo da leitura de sessão, com o último dono', async () => {
    let pronto = false;
    void queuePhotoUpload('un1', 'r1', 'p1', 'file:///foto.jpg').then(() => {
      pronto = true;
    });

    await escoar();
    expect(pronto).toBe(false);

    await jest.advanceTimersByTimeAsync(PRAZO_LEITURA_SESSAO_MS);
    await escoar();

    expect(pronto).toBe(true);
    const [salva] = await getOfflinePhotosIndex();
    expect(salva?.userId).toBe('motorista-1');
  });
});
