/**
 * Abertura sem rede: a consulta completa do perfil falha por REDE e o hook
 * não pode gastar uma 2ª consulta (a "simples") nem esperar o retry do
 * postgrest-js (~20 s). A 2ª consulta existe para falha de RLS em join, não
 * para rede. Com erro de RLS ela continua valendo.
 */
import { User } from '@supabase/supabase-js';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { _resetRedeObservada, registrarFalhaDeRede } from '@/lib/redeObservada';
import { supabase } from '@/lib/supabase';

import { reiniciarBuscasDePerfil, useUser } from '../useUser';

jest.mock('@/lib/supabase');
jest.mock('../useAuth');

const mockUser = {
  id: 'user-123',
  email: 'motorista@rotamestre.com',
  aud: 'authenticated',
  role: 'authenticated',
  created_at: '2025-01-01T00:00:00Z',
  app_metadata: {},
  user_metadata: {},
} as User;

const perfilConhecido = {
  id: 'user-123',
  nome: 'Motorista Conhecido',
  email: 'motorista@rotamestre.com',
  papel: 'motorista' as const,
  unidade_id: 'unidade-1',
  ativo: true,
};

const mockSupabase = supabase as jest.Mocked<typeof supabase>;
const AsyncStorage = require('@react-native-async-storage/async-storage');
const memoria = new Map<string, string>();

const builderCom = (resposta: object, retry = jest.fn()) => {
  const builder: Record<string, jest.Mock> = {};
  builder.select = jest.fn(() => builder);
  builder.eq = jest.fn(() => builder);
  builder.retry = retry.mockImplementation(() => builder);
  builder.maybeSingle = jest.fn().mockResolvedValue(resposta);
  return builder;
};

beforeEach(async () => {
  jest.clearAllMocks();
  reiniciarBuscasDePerfil();
  _resetRedeObservada();
  await require('@/lib/cache').clearAllCache();
  memoria.clear();
  AsyncStorage.getItem.mockImplementation(
    async (k: string) => memoria.get(k) ?? null,
  );
  AsyncStorage.setItem.mockImplementation(async (k: string, v: string) => {
    memoria.set(k, v);
  });
  AsyncStorage.removeItem.mockImplementation(async (k: string) => {
    memoria.delete(k);
  });
  memoria.set(
    '@rotamestre:perfil_conhecido',
    JSON.stringify({ userId: 'user-123', perfil: perfilConhecido }),
  );
  const { logger } = require('@/lib/logger');
  jest.spyOn(logger, 'error').mockImplementation(() => {});
  jest.spyOn(logger, 'warn').mockImplementation(() => {});

  (mockSupabase.auth.getSession as jest.Mock).mockImplementation(async () => ({
    data: { session: { user: { id: 'user-123' } } },
    error: null,
  }));
  require('../useAuth').useAuth.mockReturnValue({
    user: mockUser,
    loading: false,
  });
});

describe('useUser: perfil da abertura sem esperar o retry', () => {
  it('erro de rede na consulta completa não tenta a consulta simples', async () => {
    const builder = builderCom({
      data: null,
      error: { message: 'Network request failed', code: '' },
      status: 0,
    });
    (mockSupabase.from as jest.Mock).mockReturnValue(builder);

    const { result } = renderHook(() => useUser());

    await waitFor(() => {
      expect(result.current.userData).toEqual(perfilConhecido);
    });
    const chamadasAUsuarios = (
      mockSupabase.from as jest.Mock
    ).mock.calls.filter(([tabela]) => tabela === 'usuarios');
    expect(chamadasAUsuarios).toHaveLength(1);
  });

  it('erro de RLS no join ainda tenta a simples', async () => {
    const builder = builderCom({
      data: null,
      error: { message: 'permission denied', code: '42501' },
      status: 403,
    });
    (mockSupabase.from as jest.Mock).mockReturnValue(builder);

    renderHook(() => useUser());

    await waitFor(() => {
      const chamadasAUsuarios = (
        mockSupabase.from as jest.Mock
      ).mock.calls.filter(([tabela]) => tabela === 'usuarios');
      expect(chamadasAUsuarios).toHaveLength(2);
    });
  });

  it('a consulta completa do perfil roda com retry(false)', async () => {
    const retry = jest.fn();
    const builder = builderCom(
      { data: { ...perfilConhecido, unidades: null }, error: null },
      retry,
    );
    (mockSupabase.from as jest.Mock).mockReturnValue(builder);

    renderHook(() => useUser());

    await waitFor(() => {
      expect(builder.maybeSingle).toHaveBeenCalled();
    });
    expect(retry).toHaveBeenCalledWith(false);
  });
});

/**
 * Wi-Fi sem internet com o token válido (moto g15, 1.14.8): o index já buscou
 * o perfil e esperou o DNS do Android desistir (4,4–7,8 s); depois, o useUser
 * do layout buscava de novo e esperava o MESMO DNS — a rota em cache só
 * aparecia em ~12 s. Com a queda já observada, a carga comum do perfil não vai
 * à rede: cai direto no perfil conhecido. O refresh (botão "Tentar novamente")
 * continua indo à rede: só uma resposta limpa o sinal.
 */
describe('useUser: queda de rede já observada', () => {
  const chamadasAUsuarios = () =>
    (mockSupabase.from as jest.Mock).mock.calls.filter(
      ([tabela]) => tabela === 'usuarios',
    );

  it('carga comum não consulta o perfil e usa o perfil conhecido', async () => {
    registrarFalhaDeRede();
    const builder = builderCom({
      data: null,
      error: { message: 'Network request failed', code: '' },
      status: 0,
    });
    (mockSupabase.from as jest.Mock).mockReturnValue(builder);

    const { result } = renderHook(() => useUser());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.userData).toEqual(perfilConhecido);
    expect(result.current.perfilIndisponivel).toBeNull();
    expect(chamadasAUsuarios()).toHaveLength(0);
  });

  it('o refresh (Tentar novamente) vai à rede mesmo com a queda observada', async () => {
    registrarFalhaDeRede();
    const perfilFresco = { ...perfilConhecido, nome: 'Motorista Fresco' };
    const builder = builderCom({ data: perfilFresco, error: null });
    (mockSupabase.from as jest.Mock).mockReturnValue(builder);

    const { result } = renderHook(() => useUser());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(chamadasAUsuarios()).toHaveLength(0);

    await act(async () => {
      await result.current.refresh();
    });

    expect(chamadasAUsuarios()).toHaveLength(1);
    expect(result.current.userData).toEqual(perfilFresco);
  });

  it('sem queda observada, a carga comum consulta o perfil', async () => {
    const perfilFresco = { ...perfilConhecido, nome: 'Motorista Fresco' };
    const builder = builderCom({ data: perfilFresco, error: null });
    (mockSupabase.from as jest.Mock).mockReturnValue(builder);

    const { result } = renderHook(() => useUser());

    await waitFor(() => {
      expect(result.current.userData).toEqual(perfilFresco);
    });
    expect(chamadasAUsuarios()).toHaveLength(1);
  });
});
