import { User } from '@supabase/supabase-js';
import { renderHook, waitFor, act } from '@testing-library/react-native';

import { supabase } from '@/lib/supabase';

import { useProfile } from '../useProfile';

// Mock do supabase
jest.mock('@/lib/supabase');

describe('useProfile', () => {
  const mockUser: User = {
    id: 'user-123',
    email: 'gestor@rotamestre.com',
    aud: 'authenticated',
    role: 'authenticated',
    created_at: '2025-01-01T00:00:00Z',
    app_metadata: {},
    user_metadata: {},
  } as User;

  const mockProfile = {
    id: 'user-123',
    nome: 'Gestor Teste',
    email: 'gestor@rotamestre.com',
    papel: 'gestor' as const,
    unidade_id: 'unidade-1',
    telefone: '(11) 98765-4321',
    ativo: true,
    is_gestor_principal: true,
    primeira_senha: false,
    foto_url: null,
    ultimo_login: '2025-01-01T10:00:00Z',
  };

  const mockSupabase = supabase as jest.Mocked<typeof supabase>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Estado Inicial', () => {
    it('deve iniciar com loading=true quando há usuário', () => {
      const { result } = renderHook(() => useProfile(mockUser));

      expect(result.current.loading).toBe(true);
      expect(result.current.profile).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('deve definir loading=false quando não há usuário', async () => {
      const { result } = renderHook(() => useProfile(null));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.profile).toBeNull();
    });
  });

  describe('Carregar Perfil', () => {
    it('deve carregar perfil do usuário com sucesso', async () => {
      (mockSupabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockProfile,
          error: null,
        }),
        update: jest.fn().mockReturnThis(),
      });

      const { result } = renderHook(() => useProfile(mockUser));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.profile).toEqual(mockProfile);
      expect(result.current.error).toBeNull();
      expect(result.current.isGestorPrincipal).toBe(true);
    });

    it('deve atualizar ultimo_login ao carregar perfil', async () => {
      const mockUpdate = jest.fn().mockReturnThis();

      (mockSupabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockProfile,
          error: null,
        }),
        update: mockUpdate,
      });

      renderHook(() => useProfile(mockUser));

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledWith({
          ultimo_login: expect.any(String),
        });
      });
    });

    it('deve definir erro quando falhar ao carregar perfil', async () => {
      const errorMessage = 'Erro ao buscar perfil';

      (mockSupabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: errorMessage },
        }),
        update: jest.fn().mockReturnThis(),
      });

      const { result } = renderHook(() => useProfile(mockUser));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe(errorMessage);
      expect(result.current.profile).toBeNull();
    });
  });

  describe('updateProfile', () => {
    it('deve atualizar perfil com sucesso', async () => {
      const mockUpdateFn = jest.fn().mockReturnThis();

      (mockSupabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockProfile,
          error: null,
        }),
        update: mockUpdateFn,
      });

      const { result } = renderHook(() => useProfile(mockUser));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const updateData = { nome: 'Novo Nome', telefone: '(11) 99999-9999' };

      await act(async () => {
        await result.current.updateProfile(updateData);
      });

      expect(mockUpdateFn).toHaveBeenCalledWith(updateData);
    });

    it('deve lançar erro quando usuário não autenticado', async () => {
      const { result } = renderHook(() => useProfile(null));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await expect(
        result.current.updateProfile({ nome: 'Novo Nome' })
      ).rejects.toThrow('Usuário não autenticado');
    });

    it('deve recarregar perfil após atualização bem-sucedida', async () => {
      let selectCallCount = 0;

      (mockSupabase.from as jest.Mock).mockReturnValue({
        select: jest.fn(() => {
          selectCallCount++;
          return {
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: mockProfile,
              error: null,
            }),
          };
        }),
        eq: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
      });

      const { result } = renderHook(() => useProfile(mockUser));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const initialCallCount = selectCallCount;

      await act(async () => {
        await result.current.updateProfile({ nome: 'Novo Nome' });
      });

      // Deve ter chamado select novamente para recarregar
      expect(selectCallCount).toBeGreaterThan(initialCallCount);
    });
  });

  describe('changePassword', () => {
    it('deve trocar senha com sucesso', async () => {
      (mockSupabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockProfile,
          error: null,
        }),
        update: jest.fn().mockReturnThis(),
      });

      (mockSupabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        error: null,
      });

      (mockSupabase.auth.updateUser as jest.Mock).mockResolvedValue({
        error: null,
      });

      const { result } = renderHook(() => useProfile(mockUser));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.changePassword('senhaAtual123', 'novaSenha123');
      });

      expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: mockUser.email,
        password: 'senhaAtual123',
      });

      expect(mockSupabase.auth.updateUser).toHaveBeenCalledWith({
        password: 'novaSenha123',
      });
    });

    it('deve lançar erro quando senha atual incorreta', async () => {
      (mockSupabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockProfile,
          error: null,
        }),
        update: jest.fn().mockReturnThis(),
      });

      (mockSupabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        error: { message: 'Invalid credentials' },
      });

      const { result } = renderHook(() => useProfile(mockUser));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await expect(
        result.current.changePassword('senhaErrada', 'novaSenha123')
      ).rejects.toThrow('Senha atual incorreta');
    });

    it('deve marcar primeira_senha como false após trocar senha', async () => {
      const mockUpdateFn = jest.fn().mockReturnThis();

      (mockSupabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { ...mockProfile, primeira_senha: true },
          error: null,
        }),
        update: mockUpdateFn,
      });

      (mockSupabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        error: null,
      });

      (mockSupabase.auth.updateUser as jest.Mock).mockResolvedValue({
        error: null,
      });

      const { result } = renderHook(() => useProfile(mockUser));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.changePassword('senhaAtual', 'novaSenha');
      });

      expect(mockUpdateFn).toHaveBeenCalledWith({
        primeira_senha: false,
      });
    });
  });

  describe('refreshProfile', () => {
    it('deve recarregar perfil quando chamado', async () => {
      let selectCallCount = 0;

      (mockSupabase.from as jest.Mock).mockReturnValue({
        select: jest.fn(() => {
          selectCallCount++;
          return {
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: mockProfile,
              error: null,
            }),
          };
        }),
        eq: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
      });

      const { result } = renderHook(() => useProfile(mockUser));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const initialCallCount = selectCallCount;

      await act(async () => {
        await result.current.refreshProfile();
      });

      expect(selectCallCount).toBeGreaterThan(initialCallCount);
    });
  });
});
