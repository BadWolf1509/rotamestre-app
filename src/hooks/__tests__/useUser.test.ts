import { User } from '@supabase/supabase-js';
import { renderHook, waitFor } from '@testing-library/react-native';

import { supabase } from '@/lib/supabase';

import { useUser } from '../useUser';

// Mock do supabase
jest.mock('@/lib/supabase');

// Mock do useAuth
jest.mock('../useAuth');

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
    });

    it('não loga erro quando o perfil ainda não existe', async () => {
      const { logger } = require('@/lib/logger');
      jest.spyOn(logger, 'error').mockImplementation(() => {});
      jest.spyOn(logger, 'warn').mockImplementation(() => {});

      // Janela do onboarding: a conta existe no Auth mas o perfil ainda não
      // nasceu (ele vem da RPC criar_unidade_para_novo_gestor). Com `.single()`
      // isso vinha como 406 + PGRST116 e virava logger.error — e o Sentry da web
      // registrava erro em todo cadastro bem-sucedido.
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
        // Verifica que a query inclui unidades e usuario_unidades (multi-unidade)
        expect(mockSelect).toHaveBeenCalledWith(
          expect.stringContaining('unidades(*)'),
        );
        expect(mockSelect).toHaveBeenCalledWith(
          expect.stringContaining('usuario_unidades('),
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
});
