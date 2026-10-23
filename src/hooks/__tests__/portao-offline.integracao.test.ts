/**
 * Integração do portão protegido: `useRequireAuth` + `useUser` + `useAuth`
 * REAIS, só o cliente Supabase (e o armazenamento) simulados. Os testes de
 * unidade de cada hook mockam os outros e não pegam um elo que não conversa
 * com o seguinte — foi assim que o motorista offline caía no login.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthRetryableFetchError } from '@supabase/supabase-js';
import { renderHook, waitFor } from '@testing-library/react-native';

import { supabase } from '@/lib/supabase';

import { useRequireAuth } from '../useRequireAuth';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSegments: () => ['motorista'],
}));

const mockSupabase = supabase as jest.Mocked<typeof supabase>;
const memoria = new Map<string, string>();
const motorista = { id: 'm1', papel: 'motorista', primeira_senha: false };

const guardarPerfilConhecido = () =>
  memoria.set(
    '@rotamestre:perfil_conhecido',
    JSON.stringify({ userId: 'm1', perfil: motorista }),
  );
const buscaDoPerfilFalhando = () =>
  (mockSupabase.from as jest.Mock).mockReturnValue({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({
      data: null,
      error: { message: 'TypeError: Network request failed', code: '' },
      status: 0,
    }),
  });

beforeEach(() => {
  jest.clearAllMocks();
  memoria.clear();
  (AsyncStorage.getItem as jest.Mock).mockImplementation(
    async (k: string) => memoria.get(k) ?? null,
  );
  (AsyncStorage.setItem as jest.Mock).mockImplementation(
    async (k: string, v: string) => {
      memoria.set(k, v);
    },
  );
  (AsyncStorage.removeItem as jest.Mock).mockImplementation(
    async (k: string) => {
      memoria.delete(k);
    },
  );
  const { logger } = require('@/lib/logger');
  jest.spyOn(logger, 'error').mockImplementation(() => {});
  jest.spyOn(logger, 'warn').mockImplementation(() => {});
  buscaDoPerfilFalhando();
});

describe('portão protegido com a rede caída (hooks reais)', () => {
  describe('token vencido + refresh sem rede (getSession com AuthRetryableFetchError)', () => {
    beforeEach(() => {
      (mockSupabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
        error: new AuthRetryableFetchError('Failed to fetch', 0),
      });
      memoria.set('@rotamestre:ultimo_usuario', 'm1');
    });

    it('com perfil conhecido do último usuário, entra sem redirect', async () => {
      guardarPerfilConhecido();

      const { result } = renderHook(() =>
        useRequireAuth({ role: 'motorista' }),
      );

      await waitFor(() => expect(result.current.isAuthorized).toBe(true));
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it('sem perfil conhecido, "Sem conexão" sem redirect', async () => {
      const { result } = renderHook(() =>
        useRequireAuth({ role: 'motorista' }),
      );

      await waitFor(() =>
        expect(result.current.perfilIndisponivel).toBe('conexao'),
      );
      expect(result.current.isAuthorized).toBe(false);
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });

  it('sessão válida + busca do perfil falhando + perfil conhecido: entra', async () => {
    (mockSupabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: { user: { id: 'm1' } } },
      error: null,
    });
    guardarPerfilConhecido();

    const { result } = renderHook(() => useRequireAuth({ role: 'motorista' }));

    await waitFor(() => expect(result.current.isAuthorized).toBe(true));
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('sessão revogada (deslogado de verdade) continua indo ao login', async () => {
    (mockSupabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: null },
      error: null,
    });
    memoria.set('@rotamestre:ultimo_usuario', 'm1');
    guardarPerfilConhecido();

    renderHook(() => useRequireAuth({ role: 'motorista' }));

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith('/auth/login'),
    );
  });
});
