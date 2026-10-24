/**
 * Excluir a conta: depois da confirmação do servidor, o aparelho é limpo,
 * mas as pendências de OUTRAS contas (ações, avisos, fotos) ficam — e as
 * fotos de quem sai são apagadas de verdade (arquivo, não só o índice).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

import { authService } from '../auth';
import { ExclusaoRecusadaError } from '../auth/exclusaoRecusada';
import { supabase } from '../supabase';

jest.mock('../logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));
jest.mock('expo-constants', () => ({
  expoConfig: { extra: { baseUrl: 'https://app.rotamestre.tec.br' } },
}));
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: '/docs/',
  deleteAsync: jest.fn(async () => undefined),
}));

const mockSupabase = supabase as jest.Mocked<typeof supabase>;
const disco = new Map<string, string>();

const acao = (paradaId: string, motoristaId: string) => ({
  id: `a-${paradaId}`,
  tipo: 'concluir',
  paradaId,
  rotaId: 'r1',
  motoristaId,
  em: '2026-10-23T12:00:00.000Z',
  tentativas: 0,
});
const foto = (paradaId: string, dono: Record<string, unknown>) => ({
  localPath: `/docs/offline_photos/${paradaId}.jpg`,
  unidadeId: 'u1',
  rotaId: 'r1',
  paradaId,
  originalUri: 'file://x',
  savedAt: '2026-10-23T12:00:00Z',
  ...dono,
});
const ler = (k: string) => JSON.parse(disco.get(k) ?? '[]');

beforeEach(() => {
  jest.clearAllMocks();
  disco.clear();
  disco.set('@rotamestre:theme_preference', 'dark');
  disco.set(
    '@rotamestre:fila_acoes_parada',
    JSON.stringify([acao('p1', 'quem-sai'), acao('p2', 'outra-conta')]),
  );
  disco.set(
    '@rotamestre:offline_photos_index',
    JSON.stringify([
      foto('p1', { userId: 'quem-sai' }),
      foto('p2', { userId: 'outra-conta' }),
      foto('p3', {}), // legada: sem dono gravado
    ]),
  );
  (AsyncStorage.getItem as jest.Mock).mockImplementation(
    async (k: string) => disco.get(k) ?? null,
  );
  (AsyncStorage.setItem as jest.Mock).mockImplementation(
    async (k: string, v: string) => {
      disco.set(k, v);
    },
  );
  (AsyncStorage.clear as jest.Mock).mockImplementation(async () => {
    disco.clear();
  });
  (mockSupabase.auth.getSession as jest.Mock).mockResolvedValue({
    data: { session: { user: { id: 'quem-sai' } } },
    error: null,
  });
  (mockSupabase.auth.signOut as jest.Mock).mockResolvedValue({ error: null });
  (mockSupabase as unknown as { functions: { invoke: jest.Mock } }).functions =
    {
      invoke: jest.fn().mockResolvedValue({
        data: { success: true, deletedAt: 'x', retainedData: [] },
        error: null,
      }),
    };
});

describe('authService.deleteAccount', () => {
  it('limpa o aparelho e guarda só as pendências de outras contas', async () => {
    await authService.deleteAccount();

    expect(disco.has('@rotamestre:theme_preference')).toBe(false);
    expect(
      ler('@rotamestre:fila_acoes_parada').map(
        (a: { paradaId: string }) => a.paradaId,
      ),
    ).toEqual(['p2']);
    expect(
      ler('@rotamestre:offline_photos_index').map(
        (f: { paradaId: string }) => f.paradaId,
      ),
    ).toEqual(['p2', 'p3']);
  });

  it('apaga o ARQUIVO das fotos de quem sai, e só delas', async () => {
    await authService.deleteAccount();

    expect(FileSystem.deleteAsync).toHaveBeenCalledTimes(1);
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
      '/docs/offline_photos/p1.jpg',
      { idempotent: true },
    );
  });

  it('sessão que não responde: não trava e não apaga pendência de ninguém', async () => {
    jest.useFakeTimers();
    try {
      (mockSupabase.auth.getSession as jest.Mock).mockReturnValue(
        new Promise(() => undefined),
      );
      const exclusao = authService.deleteAccount();
      await jest.advanceTimersByTimeAsync(10_000);
      await exclusao;
    } finally {
      jest.useRealTimers();
    }

    expect(ler('@rotamestre:fila_acoes_parada')).toHaveLength(2);
    expect(ler('@rotamestre:offline_photos_index')).toHaveLength(3);
    expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
    expect(disco.has('@rotamestre:theme_preference')).toBe(false);
  });

  it('servidor recusou: nada do aparelho é apagado', async () => {
    (
      mockSupabase as unknown as { functions: { invoke: jest.Mock } }
    ).functions.invoke.mockResolvedValue({
      data: null,
      error: new Error('falhou'),
    });

    await expect(authService.deleteAccount()).rejects.toThrow('falhou');
    expect(disco.has('@rotamestre:theme_preference')).toBe(true);
    expect(AsyncStorage.clear).not.toHaveBeenCalled();
  });
});

describe('authService.deleteAccount: recusa do servidor', () => {
  it('guarda recusou (409): lança a recusa com a mensagem do servidor e não limpa o aparelho', async () => {
    (
      mockSupabase as unknown as { functions: { invoke: jest.Mock } }
    ).functions.invoke.mockResolvedValue({
      data: null,
      error: Object.assign(new Error('non-2xx'), {
        context: new Response(
          JSON.stringify({
            error: 'Você é o único gestor ativo da loja X.',
            code: 'ULTIMO_GESTOR',
          }),
          { status: 409 },
        ),
      }),
    });

    const falha = await authService.deleteAccount().catch((e) => e);

    expect(falha).toBeInstanceOf(ExclusaoRecusadaError);
    expect(falha.codigo).toBe('ULTIMO_GESTOR');
    expect(falha.message).toBe('Você é o único gestor ativo da loja X.');
    expect(disco.has('@rotamestre:theme_preference')).toBe(true);
    expect(mockSupabase.auth.signOut).not.toHaveBeenCalled();
  });
});
