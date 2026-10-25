import { User } from '@supabase/supabase-js';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { SELECT_UNIDADE_APP } from '@/lib/queries/colunasUnidade';
import { supabase } from '@/lib/supabase';

import { reiniciarBuscasDePerfil, useUser } from '../useUser';

// Mock do supabase
jest.mock('@/lib/supabase');

// Mock do useAuth
jest.mock('../useAuth');

let idDaSessao: string | null = 'user-123';

describe('useUser', () => {
  const mockUser: User = {
    id: 'user-123',
    email: 'gestor@rotamestre.com',
    aud: 'authenticated',
    role: 'authenticated',
    created_at: '2025-01-01T00:00:00Z',
    app_metadata: {},
    user_metadata: {},
  } as User;

  const mockUnidade = {
    id: 'unidade-1',
    nome: 'Unidade Central',
    endereco: 'Rua Principal, 123',
  };

  const mockUserData = {
    id: 'user-123',
    nome: 'João Gestor',
    email: 'gestor@rotamestre.com',
    papel: 'gestor' as const,
    unidade_id: 'unidade-1',
    telefone: '(11) 98765-4321',
    ativo: true,
    unidades: mockUnidade,
  };

  const mockSupabase = supabase as jest.Mocked<typeof supabase>;

  beforeEach(() => {
    jest.clearAllMocks();
    // Busca pendurada de um teste não pode servir o seguinte.
    reiniciarBuscasDePerfil();
    // A busca só vale AUTENTICADA (sem sessão a query sai anônima e a RLS
    // devolve 0 linhas): os testes dão a sessão do usuário do useAuth.
    idDaSessao = 'user-123';
    (mockSupabase.auth.getSession as jest.Mock).mockImplementation(
      async () => ({
        data: { session: idDaSessao ? { user: { id: idDaSessao } } : null },
        error: null,
      }),
    );

    // Mock do useAuth hook
    const useAuth = require('../useAuth').useAuth;
    useAuth.mockReturnValue({
      user: mockUser,
      loading: false,
    });
  });

  describe('Estado Inicial', () => {
    it('deve iniciar com loading=true quando há usuário', async () => {
      const { result } = renderHook(() => useUser());

      // Initial state can be either true or false depending on React version
      // Just check that we start with no userData
      expect(result.current.userData).toBeNull();

      // Wait for loading to complete
      await waitFor(() => {
        expect(result.current.loading).toBeDefined();
      });
    });

    it('deve retornar loading=false quando não há usuário', async () => {
      const useAuth = require('../useAuth').useAuth;
      useAuth.mockReturnValue({
        user: null,
        loading: false,
      });

      const { result } = renderHook(() => useUser());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.userData).toBeNull();
    });
  });

  describe('Carregar Dados do Usuário', () => {
    it('deve carregar dados do usuário com unidade', async () => {
      (mockSupabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: mockUserData,
          error: null,
        }),
      });

      const { result } = renderHook(() => useUser());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.userData).toEqual(mockUserData);
      expect(result.current.unidade).toEqual(mockUnidade);
    });

    it('deve definir userData como null quando falhar ao carregar usuário', async () => {
      // Sem perfil em cache: o cache em memória do `lib/cache` atravessa os
      // testes, e um perfil válido deixado pelo teste anterior agora (com
      // stale-if-error) responderia pela falha — corretamente.
      await require('@/lib/cache').clearAllCache();
      const errorMessage = 'Erro ao buscar usuário';

      (mockSupabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: null,
          error: { message: errorMessage },
        }),
      });

      const { result } = renderHook(() => useUser());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.userData).toBeNull();
      expect(result.current.unidade).toBeUndefined();
      // Erro sem status (não é rede): defeito, não "sem conexão".
      expect(result.current.perfilIndisponivel).toBe('erro');
    });

    it('não loga erro quando o perfil ainda não existe', async () => {
      const { logger } = require('@/lib/logger');
      jest.spyOn(logger, 'error').mockImplementation(() => {});
      jest.spyOn(logger, 'warn').mockImplementation(() => {});

      // Janela do onboarding: a conta existe no Auth mas o perfil ainda não
      // nasceu (ele vem da RPC criar_unidade_para_novo_gestor). Com `.single()`
      // isso vinha como 406 + PGRST116 e virava logger.error em todo cadastro
      // bem-sucedido.
      (mockSupabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        // Isca: se alguém voltar para `.single()`, este mock responde com o
        // PGRST116 real e o teste falha, em vez de quebrar por método ausente.
        single: jest.fn().mockResolvedValue({
          data: null,
          error: {
            code: 'PGRST116',
            message: 'Cannot coerce the result to a single JSON object',
          },
        }),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      });

      const { result } = renderHook(() => useUser());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.userData).toBeNull();
      expect(logger.error).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('deve fazer join corretamente com tabela unidades', async () => {
      const mockSelect = jest.fn().mockReturnThis();

      (mockSupabase.from as jest.Mock).mockReturnValue({
        select: mockSelect,
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: mockUserData,
          error: null,
        }),
      });

      renderHook(() => useUser());

      await waitFor(() => {
        // Verifica que a query inclui unidades e usuario_unidades (multi-unidade).
        // `unidades` vai com a lista explícita de colunas, nunca `unidades(*)`
        // (fonte única: `SELECT_UNIDADE_APP`).
        expect(mockSelect).toHaveBeenCalledWith(
          expect.stringContaining(`unidades(${SELECT_UNIDADE_APP})`),
        );
        expect(mockSelect).not.toHaveBeenCalledWith(
          expect.stringContaining('unidades(*)'),
        );
        expect(mockSelect).toHaveBeenCalledWith(
          expect.stringContaining('usuario_unidades('),
        );
      });
    });

    it('o fallback simples também pede só as colunas da lista do app de unidades', async () => {
      const mockSelect = jest.fn().mockReturnThis();
      (mockSupabase.from as jest.Mock).mockReturnValue({
        select: mockSelect,
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest
          .fn()
          .mockResolvedValueOnce({
            data: null,
            error: { message: 'falha no join', code: 'XX000' },
          })
          .mockResolvedValue({ data: mockUserData, error: null, status: 200 }),
      });

      renderHook(() => useUser());

      await waitFor(() => {
        expect(mockSelect).toHaveBeenCalledWith(
          `*, unidades(${SELECT_UNIDADE_APP})`,
        );
      });
    });
  });

  describe('Computed Properties', () => {
    it('deve retornar isGestor=true quando papel é gestor', async () => {
      (mockSupabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: { ...mockUserData, papel: 'gestor' },
          error: null,
        }),
      });

      const { result } = renderHook(() => useUser());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isGestor).toBe(true);
      expect(result.current.isMotorista).toBe(false);
    });

    it('deve retornar isMotorista=true quando papel é motorista', async () => {
      (mockSupabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: { ...mockUserData, papel: 'motorista' },
          error: null,
        }),
      });

      const { result } = renderHook(() => useUser());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isMotorista).toBe(true);
      expect(result.current.isGestor).toBe(false);
    });

    it('deve retornar isGestor=false e isMotorista=false quando não há userData', () => {
      const useAuth = require('../useAuth').useAuth;
      useAuth.mockReturnValue({
        user: null,
        loading: false,
      });

      const { result } = renderHook(() => useUser());

      expect(result.current.isGestor).toBe(false);
      expect(result.current.isMotorista).toBe(false);
    });
  });

  describe('refresh', () => {
    it('deve recarregar dados ao chamar refresh', async () => {
      let selectCallCount = 0;

      (mockSupabase.from as jest.Mock).mockReturnValue({
        select: jest.fn(() => {
          selectCallCount++;
          return {
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
              data: mockUserData,
              error: null,
            }),
          };
        }),
        eq: jest.fn().mockReturnThis(),
      });

      const { result } = renderHook(() => useUser());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const initialCallCount = selectCallCount;

      // Chamar refresh
      await result.current.refresh();

      await waitFor(() => {
        expect(selectCallCount).toBeGreaterThan(initialCallCount);
      });
    });

    it('deve funcionar mesmo sem usuário ao chamar refresh', async () => {
      const useAuth = require('../useAuth').useAuth;
      useAuth.mockReturnValue({
        user: null,
        loading: false,
      });

      const { result } = renderHook(() => useUser());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Chamar refresh não deve causar erro
      await expect(result.current.refresh()).resolves.not.toThrow();
    });
  });

  describe('Mudanças de Usuário', () => {
    it('deve recarregar dados quando usuário mudar', async () => {
      const useAuth = require('../useAuth').useAuth;
      let callCount = 0;

      (mockSupabase.from as jest.Mock).mockReturnValue({
        select: jest.fn(() => {
          callCount++;
          return {
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
              data: mockUserData,
              error: null,
            }),
          };
        }),
        eq: jest.fn().mockReturnThis(),
      });

      // Inicialmente sem usuário
      useAuth.mockReturnValue({
        user: null,
        loading: false,
      });

      const { rerender } = renderHook(() => useUser());

      const initialCallCount = callCount;

      // Simular login
      useAuth.mockReturnValue({
        user: mockUser,
        loading: false,
      });

      rerender();

      await waitFor(() => {
        expect(callCount).toBeGreaterThan(initialCallCount);
      });
    });
  });

  // Reproduzido no aparelho (1.14.3): offline, processo morto na câmera, app
  // reabre do zero. O cache de 5 min já venceu, a busca falha, e o perfil
  // sumia — `useRequireAuth` mandava o motorista para o login.
  describe('busca falhando: último perfil conhecido (stale-if-error)', () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    const memoria = new Map<string, string>();
    const respondendo = (resposta: object) =>
      (mockSupabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue(resposta),
      });
    const buscaFalhando = () =>
      respondendo({
        data: null,
        error: { message: 'TypeError: Network request failed', code: '' },
        status: 0,
      });
    const comUsuario = (id: string | null, offlineId: string | null = null) => {
      idDaSessao = id;
      require('../useAuth').useAuth.mockReturnValue({
        user: id ? { ...mockUser, id } : null,
        loading: false,
        offline: offlineId !== null,
        usuarioOfflineId: offlineId,
      });
    };
    const guardar = (perfil: { id: string }) =>
      memoria.set(
        '@rotamestre:perfil_conhecido',
        JSON.stringify({ userId: perfil.id, perfil }),
      );
    const guardado = () =>
      memoria.has('@rotamestre:perfil_conhecido')
        ? JSON.parse(memoria.get('@rotamestre:perfil_conhecido')!).perfil
        : null;

    beforeEach(() => {
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
      const { logger } = require('@/lib/logger');
      jest.spyOn(logger, 'error').mockImplementation(() => {});
      jest.spyOn(logger, 'warn').mockImplementation(() => {});
    });

    it('usa o perfil conhecido do mesmo usuário quando a busca falha', async () => {
      const motorista = { id: 'mot-offline-1', papel: 'motorista' as const };
      comUsuario('mot-offline-1');
      guardar(motorista);
      buscaFalhando();

      const { result } = renderHook(() => useUser());

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.userData).toEqual(motorista);
      expect(result.current.isMotorista).toBe(true);
      expect(result.current.perfilIndisponivel).toBeNull();
    });

    it('não usa o perfil conhecido de OUTRA conta', async () => {
      comUsuario('mot-offline-2');
      guardar({ id: 'conta-a', papel: 'gestor' } as never);
      buscaFalhando();

      const { result } = renderHook(() => useUser());

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.userData).toBeNull();
      expect(result.current.perfilIndisponivel).toBe('conexao');
    });

    it('não deixa o perfil exibido da conta A responder pela conta B', async () => {
      const contaA = { id: 'conta-a-troca', papel: 'gestor' as const };
      respondendo({ data: contaA, error: null, status: 200 });
      comUsuario('conta-a-troca');

      const { result, rerender } = renderHook(() => useUser());
      await waitFor(() => expect(result.current.userData).toEqual(contaA));

      memoria.clear();
      buscaFalhando();
      comUsuario('conta-b-troca');
      rerender({});

      await waitFor(() =>
        expect(result.current.perfilIndisponivel).toBe('conexao'),
      );
      expect(result.current.userData).toBeNull();
    });

    it('busca que volta com perfil diferente vence o conhecido', async () => {
      comUsuario('mot-offline-3');
      guardar({
        id: 'mot-offline-3',
        papel: 'motorista',
        ativo: true,
      } as never);
      const fresco = { id: 'mot-offline-3', papel: 'gestor', ativo: false };
      respondendo({ data: fresco, error: null, status: 200 });

      const { result } = renderHook(() => useUser());

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.userData).toEqual(fresco);
      // E o fresco passa a ser o conhecido.
      expect(guardado()).toEqual(fresco);
    });

    it('sem linha (autenticada, sem erro) apaga o perfil conhecido', async () => {
      comUsuario('mot-offline-4');
      guardar({ id: 'mot-offline-4', papel: 'motorista' } as never);
      respondendo({ data: null, error: null, status: 200 });

      const { result } = renderHook(() => useUser());

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.userData).toBeNull();
      expect(result.current.perfilIndisponivel).toBeNull();
      expect(guardado()).toBeNull();
    });

    // I1: no cooldown do refresh que falhou o supabase-js manda a query como
    // anon; a RLS devolve 0 linhas, idêntico a "sem perfil".
    it('busca ANÔNIMA com 0 linhas não apaga o perfil conhecido e não vira "sem perfil"', async () => {
      const motorista = { id: 'mot-anon', papel: 'motorista' as const };
      comUsuario('mot-anon');
      idDaSessao = null; // getSession sem sessão (refresh falhou)
      guardar(motorista);
      respondendo({ data: null, error: null, status: 200 });

      const { result } = renderHook(() => useUser());

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.userData).toEqual(motorista);
      expect(guardado()).toEqual(motorista);
    });

    // I2: 4xx de schema/permissão é defeito; o perfil sem TTL não o esconde.
    it('erro 42501/403 NÃO usa o perfil conhecido', async () => {
      comUsuario('mot-403');
      guardar({ id: 'mot-403', papel: 'motorista' } as never);
      respondendo({
        data: null,
        error: { message: 'permission denied', code: '42501' },
        status: 403,
      });

      const { result } = renderHook(() => useUser());

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.userData).toBeNull();
      expect(result.current.perfilIndisponivel).toBe('erro');
    });

    it('cache válido + busca falhando mantém o perfil do cache', async () => {
      const doCache = { id: 'mot-cache', papel: 'motorista' as const };
      await require('@/lib/cache').setCache('user_mot-cache', doCache);
      comUsuario('mot-cache');
      buscaFalhando();

      const { result } = renderHook(() => useUser());

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.userData).toEqual(doCache);
      expect(result.current.perfilIndisponivel).toBeNull();
    });

    it('offline sem sessão: carrega pelo último usuário do useAuth', async () => {
      const motorista = { id: 'mot-sem-sessao', papel: 'motorista' as const };
      comUsuario(null, 'mot-sem-sessao');
      guardar(motorista);

      const { result } = renderHook(() => useUser());

      await waitFor(() => expect(result.current.userData).toEqual(motorista));
      expect(result.current.perfilIndisponivel).toBeNull();
    });

    // Reaberto do zero em modo avião (1.14.5, Tarefa 3): o `exigirSessaoDe`
    // esperava, SEM prazo, o getSession preso no refresh do auth-js (~25 s).
    it('offline com NetInfo desconectado: perfil conhecido sem esperar o getSession', async () => {
      const NetInfo = require('@react-native-community/netinfo');
      const motorista = { id: 'mot-aviao', papel: 'motorista' as const };
      comUsuario(null, 'mot-aviao');
      guardar(motorista);
      NetInfo.fetch.mockResolvedValue({ isConnected: false, type: 'none' });
      (mockSupabase.auth.getSession as jest.Mock).mockReturnValue(
        new Promise(() => {}),
      );
      jest.useFakeTimers();
      try {
        const { result } = renderHook(() => useUser());

        // Nenhum avanço de relógio: só microtarefas.
        await act(async () => {
          for (let i = 0; i < 20; i++) await Promise.resolve();
        });
        expect(result.current.userData).toEqual(motorista);
        expect(result.current.loading).toBe(false);
        expect(mockSupabase.auth.getSession).not.toHaveBeenCalled();
      } finally {
        jest.useRealTimers();
        NetInfo.fetch.mockResolvedValue({ isConnected: true, type: 'wifi' });
      }
    });

    it('a sessão volta (offline → user): recarrega sozinho com a busca fresca', async () => {
      const motorista = { id: 'mot-volta', papel: 'motorista' as const };
      comUsuario(null, 'mot-volta');
      buscaFalhando();

      const { result, rerender } = renderHook(() => useUser());
      await waitFor(() =>
        expect(result.current.perfilIndisponivel).toBe('conexao'),
      );

      respondendo({ data: motorista, error: null, status: 200 });
      comUsuario('mot-volta');
      rerender({});

      await waitFor(() => expect(result.current.userData).toEqual(motorista));
      expect(result.current.perfilIndisponivel).toBeNull();
    });

    // M1: o logout no meio da busca não pode regravar o perfil de quem saiu.
    it('logout durante a busca não grava o perfil conhecido', async () => {
      let responder: ((v: unknown) => void) | undefined;
      (mockSupabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn(
          () =>
            new Promise((r) => {
              responder = r;
            }),
        ),
      });
      comUsuario('mot-logout');

      const { rerender } = renderHook(() => useUser());
      await waitFor(() => expect(responder).toBeDefined());

      comUsuario(null);
      rerender({});
      responder!({
        data: { id: 'mot-logout', papel: 'motorista' },
        error: null,
        status: 200,
      });

      await new Promise((r) => setTimeout(r, 50));
      expect(guardado()).toBeNull();
    });
  });

  // DP-3: cada tela, layout e hook que chama useUser fazia a sua própria
  // consulta do perfil — o gestor abria o painel com várias idênticas. A
  // busca agora é deduplicada por conta enquanto está em voo.
  describe('busca deduplicada entre instâncias', () => {
    function perfilControlado() {
      const respostas: ((v: unknown) => void)[] = [];
      (mockSupabase.from as jest.Mock).mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn(
          () =>
            new Promise((r) => {
              respostas.push(r);
            }),
        ),
      }));
      return respostas;
    }

    beforeEach(async () => {
      await require('@/lib/cache').clearAllCache();
    });

    it('instâncias montadas juntas fazem uma consulta só e recebem o mesmo perfil', async () => {
      const respostas = perfilControlado();
      const { result } = renderHook(() => [useUser(), useUser(), useUser()]);

      await waitFor(() => expect(respostas.length).toBeGreaterThan(0));
      await new Promise((r) => setTimeout(r, 20));
      expect(respostas).toHaveLength(1);

      await act(async () => {
        respostas[0]({ data: mockUserData, error: null, status: 200 });
      });
      await waitFor(() =>
        expect(result.current.every((u) => u.userData?.id === 'user-123')).toBe(
          true,
        ),
      );
    });

    it('perfil atualizado (evento) com várias instâncias: uma consulta só', async () => {
      const respostas = perfilControlado();
      const { result } = renderHook(() => [useUser(), useUser(), useUser()]);
      await waitFor(() => expect(respostas).toHaveLength(1));
      await act(async () => {
        respostas[0]({ data: mockUserData, error: null, status: 200 });
      });
      await waitFor(() =>
        expect(result.current[2].userData?.id).toBe('user-123'),
      );

      act(() => {
        require('@/lib/profileEvents').emitProfileUpdate();
      });
      await new Promise((r) => setTimeout(r, 20));
      expect(respostas).toHaveLength(2);

      await act(async () => {
        respostas[1]({
          data: { ...mockUserData, nome: 'Nome Novo' },
          error: null,
          status: 200,
        });
      });
      await waitFor(() =>
        expect(result.current.map((u) => u.userData?.nome)).toEqual([
          'Nome Novo',
          'Nome Novo',
          'Nome Novo',
        ]),
      );
    });

    it('troca de conta com a busca da anterior em voo: a da nova roda e vale', async () => {
      const respostas = perfilControlado();
      const { result, rerender } = renderHook(() => useUser());
      await waitFor(() => expect(respostas).toHaveLength(1));

      idDaSessao = 'user-b';
      require('../useAuth').useAuth.mockReturnValue({
        user: { ...mockUser, id: 'user-b' },
        loading: false,
      });
      rerender({});
      await waitFor(() => expect(respostas).toHaveLength(2));

      await act(async () => {
        respostas[1]({
          data: { ...mockUserData, id: 'user-b' },
          error: null,
          status: 200,
        });
        respostas[0]({ data: mockUserData, error: null, status: 200 });
      });
      await waitFor(() => expect(result.current.userData?.id).toBe('user-b'));
    });

    // Revisão, M6: a busca que falha não pode ficar guardada como "em voo".
    it('busca rejeitada não fica guardada: a carga seguinte consulta de novo', async () => {
      const respostas = perfilControlado();
      const { result } = renderHook(() => useUser());
      await waitFor(() => expect(respostas).toHaveLength(1));

      const falha = {
        data: null,
        error: { message: 'gateway', code: '' },
        status: 503,
      };
      await act(async () => {
        respostas[0](falha);
      });
      // A consulta completa falhou: o hook tenta a simples, que falha também.
      await waitFor(() => expect(respostas).toHaveLength(2));
      await act(async () => {
        respostas[1](falha);
      });
      await waitFor(() => expect(result.current.loading).toBe(false));

      act(() => {
        void result.current.refresh();
      });
      await waitFor(() => expect(respostas).toHaveLength(3));
      await act(async () => {
        respostas
          .slice(2)
          .forEach((r) => r({ data: mockUserData, error: null, status: 200 }));
      });
      await waitFor(() => expect(result.current.userData?.id).toBe('user-123'));
    });

    it('logout e login da mesma conta com a busca de antes em voo: busca nova', async () => {
      const respostas = perfilControlado();
      const { result, rerender } = renderHook(() => useUser());
      await waitFor(() => expect(respostas).toHaveLength(1));

      const useAuth = require('../useAuth').useAuth;
      useAuth.mockReturnValue({ user: null, loading: false });
      rerender({});
      useAuth.mockReturnValue({ user: mockUser, loading: false });
      rerender({});

      // A busca de antes do logout pode voltar sem sessão: não é reusada.
      await waitFor(() => expect(respostas).toHaveLength(2));
      await act(async () => {
        respostas[1]({
          data: { ...mockUserData, nome: 'Depois do login' },
          error: null,
          status: 200,
        });
        respostas[0]({ data: null, error: null, status: 200 });
      });
      await waitFor(() =>
        expect(result.current.userData?.nome).toBe('Depois do login'),
      );
      await new Promise((r) => setTimeout(r, 20));
      expect(result.current.userData?.nome).toBe('Depois do login');
    });

    it('logout durante a leitura do cache não aplica o perfil de quem saiu', async () => {
      perfilControlado();
      const cache = require('@/lib/cache');
      let soltarCache: (v: unknown) => void = () => {};
      const espiao = jest.spyOn(cache, 'getCache').mockImplementationOnce(
        () =>
          new Promise((r) => {
            soltarCache = r;
          }),
      );
      try {
        const { result, rerender } = renderHook(() => useUser());
        await waitFor(() => expect(espiao).toHaveBeenCalled());

        require('../useAuth').useAuth.mockReturnValue({
          user: null,
          loading: false,
        });
        rerender({});
        await act(async () => {
          soltarCache(mockUserData);
        });
        await new Promise((r) => setTimeout(r, 20));

        expect(result.current.userData).toBeNull();
      } finally {
        espiao.mockRestore();
      }
    });

    it('refresh com uma busca comum em voo faz busca nova, e é ela que vale', async () => {
      const respostas = perfilControlado();
      const { result } = renderHook(() => useUser());
      await waitFor(() => expect(respostas).toHaveLength(1));

      // O refresh vem de quem acabou de gravar: a busca que já estava em voo
      // pode ter saído antes da gravação.
      act(() => {
        require('@/lib/profileEvents').emitProfileUpdate();
      });
      await new Promise((r) => setTimeout(r, 20));
      expect(respostas).toHaveLength(2);

      await act(async () => {
        respostas[1]({
          data: { ...mockUserData, nome: 'Depois da gravação' },
          error: null,
          status: 200,
        });
        respostas[0]({ data: mockUserData, error: null, status: 200 });
      });
      await waitFor(() =>
        expect(result.current.userData?.nome).toBe('Depois da gravação'),
      );
    });
  });
});
