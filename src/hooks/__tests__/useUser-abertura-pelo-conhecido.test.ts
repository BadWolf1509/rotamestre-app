/**
 * Wi-Fi sem internet com o token válido (moto g15, 1.14.10): o `app/index`
 * estoura o prazo de 3 s e segue pelo perfil guardado — mas a busca dele só
 * foi ABANDONADA, não falhou, então nenhuma queda de rede foi observada ainda.
 * O `useUser` do layout fazia a sua busca e esperava o mesmo DNS: ≈ 11 s até a
 * rota. Quando a abertura seguiu pelo perfil guardado, a 1ª carga usa esse
 * perfil na hora e revalida pela rede em segundo plano.
 */
import { User } from '@supabase/supabase-js';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import {
  _reiniciarAberturaPeloPerfilConhecido,
  marcarAberturaPeloPerfilConhecido,
  perfilDaAberturaPara,
} from '@/lib/auth/aberturaPeloPerfilConhecido';
import { _resetRedeObservada } from '@/lib/redeObservada';
import { supabase } from '@/lib/supabase';
import type { Usuario } from '@/types/usuario';

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

const perfilGuardado = {
  id: 'user-123',
  nome: 'Motorista Guardado',
  email: 'motorista@rotamestre.com',
  papel: 'motorista' as const,
  unidade_id: 'unidade-1',
  ativo: true,
} as unknown as Usuario;

const mockSupabase = supabase as jest.Mocked<typeof supabase>;
const AsyncStorage = require('@react-native-async-storage/async-storage');
const memoria = new Map<string, string>();

type Resposta = { data: unknown; error: unknown; status?: number };

/** Cada consulta a `usuarios` fica pendente até o teste responder. */
const respostas: Array<(r: Resposta) => void> = [];
function builderPendente() {
  const builder: Record<string, jest.Mock> = {};
  builder.select = jest.fn(() => builder);
  builder.eq = jest.fn(() => builder);
  builder.retry = jest.fn(() => builder);
  builder.maybeSingle = jest.fn(
    () =>
      new Promise<Resposta>((resolve) => {
        respostas.push(resolve);
      }),
  );
  return builder;
}

const chamadasAUsuarios = () =>
  (mockSupabase.from as jest.Mock).mock.calls.filter(
    ([tabela]) => tabela === 'usuarios',
  );

beforeEach(async () => {
  jest.clearAllMocks();
  respostas.length = 0;
  reiniciarBuscasDePerfil();
  _resetRedeObservada();
  _reiniciarAberturaPeloPerfilConhecido();
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
    JSON.stringify({ userId: 'user-123', perfil: perfilGuardado }),
  );
  const { logger } = require('@/lib/logger');
  jest.spyOn(logger, 'error').mockImplementation(() => {});
  jest.spyOn(logger, 'warn').mockImplementation(() => {});

  (mockSupabase.auth.getSession as jest.Mock).mockImplementation(async () => ({
    data: { session: { user: { id: 'user-123' } } },
    error: null,
  }));
  (mockSupabase.from as jest.Mock).mockImplementation(() => builderPendente());
  require('../useAuth').useAuth.mockReturnValue({
    user: mockUser,
    loading: false,
  });
});

describe('useUser: abertura que seguiu pelo perfil guardado', () => {
  it('usa o perfil guardado na hora, sem esperar a rede', async () => {
    marcarAberturaPeloPerfilConhecido(perfilGuardado);

    const { result } = renderHook(() => useUser());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.userData).toEqual(perfilGuardado);
    expect(result.current.perfilIndisponivel).toBeNull();
    expect(result.current.fromCache).toBe(true);
    // E revalida em segundo plano: a consulta saiu e segue pendente.
    await waitFor(() => expect(chamadasAUsuarios()).toHaveLength(1));
  });

  it('a revalidação substitui pelo perfil fresco quando chega', async () => {
    marcarAberturaPeloPerfilConhecido(perfilGuardado);
    const { result } = renderHook(() => useUser());
    await waitFor(() => expect(respostas).toHaveLength(1));

    const fresco = { ...perfilGuardado, nome: 'Motorista Fresco' };
    await act(async () => {
      respostas[0]({ data: fresco, error: null });
    });

    await waitFor(() => expect(result.current.userData).toEqual(fresco));
    expect(result.current.fromCache).toBe(false);
    // Resposta fresca encerra a abertura pelo guardado.
    expect(perfilDaAberturaPara('user-123')).toBeNull();
  });

  it('revalidação que falha por rede não desloga nem limpa o perfil', async () => {
    marcarAberturaPeloPerfilConhecido(perfilGuardado);
    const { result } = renderHook(() => useUser());
    await waitFor(() => expect(respostas).toHaveLength(1));

    await act(async () => {
      respostas[0]({
        data: null,
        error: { message: 'Network request failed', code: '' },
        status: 0,
      });
    });

    await waitFor(() => expect(chamadasAUsuarios()).toHaveLength(1));
    expect(result.current.userData).toEqual(perfilGuardado);
    expect(result.current.perfilIndisponivel).toBeNull();
    expect(result.current.loading).toBe(false);
    // A outra instância que montar depois também não espera.
    expect(perfilDaAberturaPara('user-123')).toEqual(perfilGuardado);
  });

  it('revalidação com papel diferente substitui (vale o comportamento atual)', async () => {
    marcarAberturaPeloPerfilConhecido(perfilGuardado);
    const { result } = renderHook(() => useUser());
    await waitFor(() => expect(respostas).toHaveLength(1));

    const virouGestor = { ...perfilGuardado, papel: 'gestor' as const };
    await act(async () => {
      respostas[0]({ data: virouGestor, error: null });
    });

    await waitFor(() => expect(result.current.isGestor).toBe(true));
    expect(result.current.isMotorista).toBe(false);
  });

  it('revalidação sem linha (perfil sumiu) reflete o estado real, como hoje', async () => {
    marcarAberturaPeloPerfilConhecido(perfilGuardado);
    const { result } = renderHook(() => useUser());
    await waitFor(() => expect(respostas).toHaveLength(1));

    await act(async () => {
      respostas[0]({ data: null, error: null });
    });

    await waitFor(() => expect(result.current.userData).toBeNull());
    expect(result.current.loading).toBe(false);
  });

  it('perfil marcado de OUTRA conta nunca é usado', async () => {
    marcarAberturaPeloPerfilConhecido({
      ...perfilGuardado,
      id: 'outra-conta',
    } as Usuario);

    const { result } = renderHook(() => useUser());

    await waitFor(() => expect(respostas).toHaveLength(1));
    // Segue esperando a rede, como sem a marca.
    expect(result.current.loading).toBe(true);
    expect(result.current.userData).toBeNull();
  });

  it('sem a marca da abertura, a 1ª carga espera a rede como antes', async () => {
    const { result } = renderHook(() => useUser());

    await waitFor(() => expect(respostas).toHaveLength(1));
    expect(result.current.loading).toBe(true);
    expect(result.current.userData).toBeNull();
  });

  it('a revalidação velha não sobrescreve um refresh mais novo', async () => {
    marcarAberturaPeloPerfilConhecido(perfilGuardado);
    const { result } = renderHook(() => useUser());
    await waitFor(() => expect(respostas).toHaveLength(1));

    const doRefresh = { ...perfilGuardado, nome: 'Do refresh' };
    let refrescando: Promise<void> | undefined;
    act(() => {
      refrescando = result.current.refresh();
    });
    await waitFor(() => expect(respostas).toHaveLength(2));
    await act(async () => {
      respostas[1]({ data: doRefresh, error: null });
      await refrescando;
    });
    await waitFor(() => expect(result.current.userData).toEqual(doRefresh));

    // A revalidação da abertura chega depois, com o perfil velho.
    await act(async () => {
      respostas[0]({
        data: { ...perfilGuardado, nome: 'Velho' },
        error: null,
      });
    });
    expect(result.current.userData).toEqual(doRefresh);
  });
});
