/**
 * Tests for useRequireAuth.ts
 * Hook para proteger rotas que requerem autenticação
 */

import { renderHook, waitFor } from '@testing-library/react-native';

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

jest.mock('../useAuth', () => ({
  useAuth: () => ({
    user: mockUser,
    loading: mockAuthLoading,
  }),
}));

// Mock useUser
let mockUserData: any = { id: 'user-1', nome: 'Test User', papel: 'gestor' };
let mockUserLoading = false;

jest.mock('../useUser', () => ({
  useUser: () => ({
    userData: mockUserData,
    loading: mockUserLoading,
  }),
}));

describe('useRequireAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = { id: 'user-1' };
    mockAuthLoading = false;
    mockUserData = { id: 'user-1', nome: 'Test User', papel: 'gestor' };
    mockUserLoading = false;
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
        useRequireAuth({ redirectTo: '/custom-login' })
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

      const { result } = renderHook(() => useRequireAuth({ role: 'motorista' }));

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

    it('deve aguardar quando userData não está disponível', async () => {
      mockUserData = null;
      mockUser = { id: 'user-1' };

      const { result } = renderHook(() => useRequireAuth());

      // Não deve redirecionar enquanto userData não carregou
      expect(result.current.isReady).toBe(false);
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
});
