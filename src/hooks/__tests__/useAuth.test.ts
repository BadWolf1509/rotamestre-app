import { renderHook, waitFor } from '@testing-library/react-native';

import { supabase } from '../../lib/supabase';
import { useAuth } from '../useAuth';

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
  updateRealtimeAuth: jest.fn(),
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
        expect.any(Function)
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
      (supabase.auth.onAuthStateChange as jest.Mock).mockImplementation((cb) => {
        authCallback = cb;
        return { data: { subscription: mockSubscription } };
      });

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
      (supabase.auth.onAuthStateChange as jest.Mock).mockImplementation((cb) => {
        authCallback = cb;
        return { data: { subscription: mockSubscription } };
      });

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

  describe('signOut', () => {
    it('deve chamar supabase.auth.signOut', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: mockSession },
      });

      (supabase.auth.signOut as jest.Mock).mockResolvedValue({});

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.session).toEqual(mockSession);
      });

      await result.current.signOut();

      expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
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
});
