import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { lerUltimoUsuario } from '../../lib/auth/ultimoUsuario';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../useAuth';

jest.mock('../../lib/auth/ultimoUsuario', () => ({
  lerUltimoUsuario: jest.fn(),
}));

// Mock do supabase
jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
      signOut: jest.fn(),
    },
    realtime: {
      setAuth: jest.fn(),
    },
  },
  isSupabaseConfigured: true,
}));

describe('useAuth', () => {
  const mockSession = {
    access_token: 'mock-token',
    refresh_token: 'mock-refresh',
    user: {
      id: 'user-123',
      email: 'test@rotamestre.com',
      aud: 'authenticated',
      role: 'authenticated',
      created_at: '2025-01-01T00:00:00Z',
    },
  };

  const mockSubscription = {
    unsubscribe: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock padrão do onAuthStateChange
    (supabase.auth.onAuthStateChange as jest.Mock).mockReturnValue({
      data: { subscription: mockSubscription },
    });
  });

  describe('Estado Inicial', () => {
    it('deve iniciar com loading=true e session=null', () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.loading).toBe(true);
      expect(result.current.session).toBeNull();
      expect(result.current.user).toBeNull();
    });

    it('deve chamar getSession ao montar', () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
      });

      renderHook(() => useAuth());

      expect(supabase.auth.getSession).toHaveBeenCalledTimes(1);
    });

    it('deve registrar listener de mudança de auth', () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
      });

      renderHook(() => useAuth());

      expect(supabase.auth.onAuthStateChange).toHaveBeenCalledTimes(1);
      expect(supabase.auth.onAuthStateChange).toHaveBeenCalledWith(
        expect.any(Function),
      );
    });
  });

  describe('Sessão Ativa', () => {
    it('deve carregar sessão existente', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: mockSession },
      });

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.session).toEqual(mockSession);
      expect(result.current.user).toEqual(mockSession.user);
    });

    it('deve atualizar quando não há sessão', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
      });

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.session).toBeNull();
      expect(result.current.user).toBeNull();
    });
  });

  describe('Mudanças de Autenticação', () => {
    it('deve atualizar quando auth state mudar', async () => {
      let authCallback: any;
      (supabase.auth.onAuthStateChange as jest.Mock).mockImplementation(
        (cb) => {
          authCallback = cb;
          return { data: { subscription: mockSubscription } };
        },
      );

      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
      });

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Simular login
      authCallback('SIGNED_IN', mockSession);

      await waitFor(() => {
        expect(result.current.session).toEqual(mockSession);
        expect(result.current.user).toEqual(mockSession.user);
      });
    });

    it('deve atualizar quando usuário fizer logout', async () => {
      let authCallback: any;
      (supabase.auth.onAuthStateChange as jest.Mock).mockImplementation(
        (cb) => {
          authCallback = cb;
          return { data: { subscription: mockSubscription } };
        },
      );

      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: mockSession },
      });

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.session).toEqual(mockSession);
      });

      // Simular logout
      authCallback('SIGNED_OUT', null);

      await waitFor(() => {
        expect(result.current.session).toBeNull();
        expect(result.current.user).toBeNull();
      });
    });
  });

  describe('Cleanup', () => {
    it('deve cancelar inscrição ao desmontar', () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
      });

      const { unmount } = renderHook(() => useAuth());

      unmount();

      expect(mockSubscription.unsubscribe).toHaveBeenCalledTimes(1);
    });
  });

  // auth-js: token vencido + refresh sem rede devolve session null COM
  // AuthRetryableFetchError e mantém a sessão no storage. Ler isso como
  // "deslogado" mandava o motorista ao login no meio da rota.
  describe('sessão offline (refresh sem rede)', () => {
    let authCallback: (evento: string, sessao: unknown) => void;

    beforeEach(() => {
      (supabase.auth.onAuthStateChange as jest.Mock).mockImplementation(
        (cb) => {
          authCallback = cb;
          return { data: { subscription: mockSubscription } };
        },
      );
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
        error: new AuthRetryableFetchError('Failed to fetch', 0),
      });
      (lerUltimoUsuario as jest.Mock).mockResolvedValue('m1');
    });

    it('expõe offline e o último usuário, sem user', async () => {
      const { result } = renderHook(() => useAuth());

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.user).toBeNull();
      expect(result.current.offline).toBe(true);
      expect(result.current.usuarioOfflineId).toBe('m1');
    });

    it('o INITIAL_SESSION null (mesma falha) não apaga o modo offline', async () => {
      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        authCallback('INITIAL_SESSION', null);
      });

      expect(result.current.usuarioOfflineId).toBe('m1');
      expect(result.current.offline).toBe(true);
    });

    it('a rede volta (TOKEN_REFRESHED com sessão): fluxo normal assume', async () => {
      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.loading).toBe(false));

      authCallback('TOKEN_REFRESHED', mockSession);

      await waitFor(() =>
        expect(result.current.user).toEqual(mockSession.user),
      );
      expect(result.current.offline).toBe(false);
      expect(result.current.usuarioOfflineId).toBeNull();
    });

    it('SIGNED_OUT (sessão revogada) sai do modo offline', async () => {
      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.loading).toBe(false));

      authCallback('SIGNED_OUT', null);

      await waitFor(() => expect(result.current.offline).toBe(false));
      expect(result.current.usuarioOfflineId).toBeNull();
    });

    it('erro NÃO retryable (refresh token inválido) é deslogado, não offline', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
        error: new AuthApiError(
          'Invalid Refresh Token',
          400,
          'refresh_token_not_found',
        ),
      });

      const { result } = renderHook(() => useAuth());

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.offline).toBe(false);
      expect(result.current.usuarioOfflineId).toBeNull();
    });

    it('recarregarSessao: a rede voltou, a sessão é lida de novo', async () => {
      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.loading).toBe(false));

      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });
      await result.current.recarregarSessao();

      await waitFor(() =>
        expect(result.current.user).toEqual(mockSession.user),
      );
      expect(result.current.offline).toBe(false);
    });
  });
});
