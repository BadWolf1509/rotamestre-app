/**
 * Tests for useRequireAuth.ts
 * Hook para proteger rotas que requerem autenticação
 */

import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useRequireAuth } from '../useRequireAuth';

// Mocks
const mockReplace = jest.fn();
const mockUseSegments = jest.fn(() => ['gestor']);

jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
  useSegments: () => mockUseSegments(),
}));

// Mock useAuth
let mockUser: any = { id: 'user-1' };
let mockAuthLoading = false;
let mockOffline = false;
let mockUsuarioOfflineId: string | null = null;
const mockRecarregarSessao = jest.fn();

jest.mock('../useAuth', () => ({
  useAuth: () => ({
    user: mockUser,
    loading: mockAuthLoading,
    offline: mockOffline,
    usuarioOfflineId: mockUsuarioOfflineId,
    recarregarSessao: mockRecarregarSessao,
  }),
}));

// Mock useUser
let mockUserData: any = { id: 'user-1', nome: 'Test User', papel: 'gestor' };
let mockUserLoading = false;
let mockPerfilIndisponivel: 'conexao' | 'erro' | null = null;
const mockRefresh = jest.fn();

jest.mock('../useUser', () => ({
  useUser: () => ({
    userData: mockUserData,
    loading: mockUserLoading,
    perfilIndisponivel: mockPerfilIndisponivel,
    refresh: mockRefresh,
  }),
}));

describe('useRequireAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = { id: 'user-1' };
    mockAuthLoading = false;
    mockUserData = { id: 'user-1', nome: 'Test User', papel: 'gestor' };
    mockUserLoading = false;
    mockPerfilIndisponivel = null;
    mockOffline = false;
    mockUsuarioOfflineId = null;
    mockRefresh.mockResolvedValue(undefined);
    mockRecarregarSessao.mockResolvedValue(undefined);
    mockUseSegments.mockReturnValue(['gestor']);
  });

  describe('Usuário autenticado e autorizado', () => {
    it('deve retornar isReady=true e isAuthorized=true para usuário autenticado', async () => {
      const { result } = renderHook(() => useRequireAuth());

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      expect(result.current.isAuthorized).toBe(true);
      expect(result.current.userData).toEqual(mockUserData);
    });

    it('deve retornar isAuthorized=true quando role=any', async () => {
      const { result } = renderHook(() => useRequireAuth({ role: 'any' }));

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      expect(result.current.isAuthorized).toBe(true);
    });

    it('deve retornar isAuthorized=true quando papel corresponde ao role', async () => {
      mockUserData = { papel: 'gestor' };

      const { result } = renderHook(() => useRequireAuth({ role: 'gestor' }));

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      expect(result.current.isAuthorized).toBe(true);
    });
  });

  describe('Usuário não autenticado', () => {
    it('deve redirecionar para login quando não autenticado', async () => {
      mockUser = null;
      mockUserData = null;

      const { result } = renderHook(() => useRequireAuth());

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      expect(result.current.isAuthorized).toBe(false);
      expect(mockReplace).toHaveBeenCalledWith('/auth/login');
    });

    it('deve usar redirectTo customizado', async () => {
      mockUser = null;

      const { result } = renderHook(() =>
        useRequireAuth({ redirectTo: '/custom-login' }),
      );

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      expect(mockReplace).toHaveBeenCalledWith('/custom-login');
    });
  });

  describe('Papel incorreto', () => {
    it('deve redirecionar gestor para área de gestor', async () => {
      mockUserData = { papel: 'gestor' };

      const { result } = renderHook(() =>
        useRequireAuth({ role: 'motorista' }),
      );

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      expect(result.current.isAuthorized).toBe(false);
      expect(mockReplace).toHaveBeenCalledWith('/gestor/inicio');
    });

    it('deve redirecionar motorista para área de motorista', async () => {
      mockUserData = { papel: 'motorista' };

      const { result } = renderHook(() => useRequireAuth({ role: 'gestor' }));

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      expect(result.current.isAuthorized).toBe(false);
      expect(mockReplace).toHaveBeenCalledWith('/motorista');
    });

    it('deve redirecionar para login quando papel desconhecido', async () => {
      mockUserData = { papel: 'admin' };

      const { result } = renderHook(() => useRequireAuth({ role: 'gestor' }));

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      expect(result.current.isAuthorized).toBe(false);
      expect(mockReplace).toHaveBeenCalledWith('/auth/login');
    });
  });

  describe('Rotas de autenticação', () => {
    it('deve permitir acesso a rotas de auth sem verificação', async () => {
      mockUseSegments.mockReturnValue(['auth']);
      mockUser = null;

      const { result } = renderHook(() => useRequireAuth());

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      expect(result.current.isAuthorized).toBe(true);
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it('deve permitir acesso a rotas de onboarding sem verificação', async () => {
      mockUseSegments.mockReturnValue(['onboarding']);
      mockUser = null;

      const { result } = renderHook(() => useRequireAuth());

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      expect(result.current.isAuthorized).toBe(true);
    });
  });

  describe('Estado de carregamento', () => {
    it('deve aguardar quando authLoading é true', async () => {
      mockAuthLoading = true;

      const { result } = renderHook(() => useRequireAuth());

      // Deve retornar isReady=false enquanto carrega
      expect(result.current.isReady).toBe(false);
      expect(result.current.isLoading).toBe(true);
    });

    it('deve aguardar quando userLoading é true', async () => {
      mockUserLoading = true;

      const { result } = renderHook(() => useRequireAuth());

      // isLoading deve ser true
      expect(result.current.isLoading).toBe(true);
    });

    it('deve aguardar quando userData ainda está carregando', async () => {
      mockUserData = null;
      mockUser = { id: 'user-1' };
      mockUserLoading = true; // userData ainda carregando

      const { result } = renderHook(() => useRequireAuth());

      // Não deve marcar como ready enquanto userData está carregando
      expect(result.current.isReady).toBe(false);
      expect(result.current.isLoading).toBe(true);
    });
  });

  describe('Retorno do hook', () => {
    it('deve retornar userData quando disponível', async () => {
      const expectedUserData = { id: 'user-1', nome: 'Test', papel: 'gestor' };
      mockUserData = expectedUserData;

      const { result } = renderHook(() => useRequireAuth());

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      expect(result.current.userData).toEqual(expectedUserData);
    });

    it('deve calcular isLoading corretamente', async () => {
      mockAuthLoading = false;
      mockUserLoading = false;

      const { result } = renderHook(() => useRequireAuth());

      expect(result.current.isLoading).toBe(false);
    });
  });

  // Offline sem perfil para decidir: ir ao login não resolve (a sessão pode
  // ser válida e o login também precisa de rede) e ainda tira a pessoa do app.
  describe('perfil indisponível', () => {
    beforeEach(() => {
      mockUserData = null;
      mockPerfilIndisponivel = 'conexao';
      mockUseSegments.mockReturnValue(['motorista']);
    });

    it('não redireciona e sinaliza o motivo', async () => {
      const { result } = renderHook(() =>
        useRequireAuth({ role: 'motorista' }),
      );

      await waitFor(() => expect(result.current.isReady).toBe(true));
      expect(result.current.isAuthorized).toBe(false);
      expect(result.current.perfilIndisponivel).toBe('conexao');
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it('erro de verdade passa o motivo "erro" adiante, sem redirect', async () => {
      mockPerfilIndisponivel = 'erro';
      const { result } = renderHook(() =>
        useRequireAuth({ role: 'motorista' }),
      );

      await waitFor(() => expect(result.current.isReady).toBe(true));
      expect(result.current.perfilIndisponivel).toBe('erro');
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it('tentarNovamente com sessão refaz a busca e expõe "tentando"', async () => {
      let terminar!: () => void;
      mockRefresh.mockReturnValue(
        new Promise<void>((r) => {
          terminar = r;
        }),
      );
      const { result } = renderHook(() =>
        useRequireAuth({ role: 'motorista' }),
      );
      await waitFor(() => expect(result.current.isReady).toBe(true));

      act(() => {
        void result.current.tentarNovamente();
      });
      await waitFor(() => expect(result.current.tentando).toBe(true));
      expect(mockRefresh).toHaveBeenCalled();

      await act(async () => terminar());
      await waitFor(() => expect(result.current.tentando).toBe(false));
    });

    // M4: o efeito roda a cada mudança de dependência; o aviso é por episódio.
    it('não repete o aviso "Perfil indisponível" a cada execução do efeito', async () => {
      const { logger } = require('../../lib/logger');
      const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});
      const { result, rerender } = renderHook(() =>
        useRequireAuth({ role: 'motorista' }),
      );
      await waitFor(() => expect(result.current.isReady).toBe(true));

      mockUseSegments.mockReturnValue(['motorista', 'outra']);
      rerender({});
      mockUseSegments.mockReturnValue(['motorista']);
      rerender({});

      const avisos = warn.mock.calls.filter((c) =>
        String(c[0]).includes('Perfil indisponível'),
      );
      expect(avisos).toHaveLength(1);
      warn.mockRestore();
    });
  });

  // auth-js: token vencido + refresh sem rede → useAuth sem `user`, mas
  // `offline` com o último usuário do aparelho. Não é "deslogado".
  describe('sessão offline (token vencido sem rede)', () => {
    beforeEach(() => {
      mockUser = null;
      mockOffline = true;
      mockUseSegments.mockReturnValue(['motorista']);
    });

    it('com o perfil conhecido carregado pelo useUser, autoriza sem redirect', async () => {
      mockUsuarioOfflineId = 'm1';
      mockUserData = { id: 'm1', papel: 'motorista' };

      const { result } = renderHook(() =>
        useRequireAuth({ role: 'motorista' }),
      );

      await waitFor(() => expect(result.current.isReady).toBe(true));
      expect(result.current.isAuthorized).toBe(true);
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it('sem último usuário: "Sem conexão", nunca login', async () => {
      mockUsuarioOfflineId = null;
      mockUserData = null;

      const { result } = renderHook(() =>
        useRequireAuth({ role: 'motorista' }),
      );

      await waitFor(() => expect(result.current.isReady).toBe(true));
      expect(result.current.perfilIndisponivel).toBe('conexao');
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it('tentarNovamente sem sessão relê a sessão', async () => {
      mockUsuarioOfflineId = null;
      mockUserData = null;
      const { result } = renderHook(() =>
        useRequireAuth({ role: 'motorista' }),
      );
      await waitFor(() => expect(result.current.isReady).toBe(true));

      await act(async () => {
        await result.current.tentarNovamente();
      });
      expect(mockRecarregarSessao).toHaveBeenCalled();
    });
  });
});
