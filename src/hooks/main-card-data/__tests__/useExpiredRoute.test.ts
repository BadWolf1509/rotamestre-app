/**
 * Tests for useExpiredRoute hook
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';

// Mock supabase
const mockFrom = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => mockFrom(table),
  },
}));

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

import { criarCadeia } from '@/__tests__/helpers/cadeiaSupabase';

import { useExpiredRoute } from '../useExpiredRoute';

describe('useExpiredRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with null expiredRoute', () => {
      const { result } = renderHook(() => useExpiredRoute('motorista-123'));

      expect(result.current.expiredRoute).toBeNull();
      expect(result.current.expiredRouteDismissed).toBe(false);
    });

    it('should provide loadExpiredRoute and dismissExpiredRoute functions', () => {
      const { result } = renderHook(() => useExpiredRoute('motorista-123'));

      expect(typeof result.current.loadExpiredRoute).toBe('function');
      expect(typeof result.current.dismissExpiredRoute).toBe('function');
    });
  });

  describe('loadExpiredRoute', () => {
    it('should return early if no motoristaId', async () => {
      const { result } = renderHook(() => useExpiredRoute(undefined));

      await act(async () => {
        await result.current.loadExpiredRoute();
      });

      expect(mockFrom).not.toHaveBeenCalled();
      expect(result.current.expiredRoute).toBeNull();
    });

    it('should set expiredRoute to null if no expired route found', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'rotas') {
          return criarCadeia({ data: null, error: null });
        }
        return criarCadeia({ data: [], error: null });
      });

      const { result } = renderHook(() => useExpiredRoute('motorista-123'));

      await act(async () => {
        await result.current.loadExpiredRoute();
      });

      expect(result.current.expiredRoute).toBeNull();
    });

    it('should set expiredRoute to null on rotas error', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'rotas') {
          return criarCadeia({
            data: null,
            error: { message: 'Error' },
          });
        }
        return criarCadeia({ data: [], error: null });
      });

      const { result } = renderHook(() => useExpiredRoute('motorista-123'));

      await act(async () => {
        await result.current.loadExpiredRoute();
      });

      expect(result.current.expiredRoute).toBeNull();
    });

    it('should load expired route with paradas data', async () => {
      const mockRota = {
        id: 'rota-expired',
        data: '2024-01-01',
        updated_at: '2024-01-01T10:00:00Z',
      };

      const mockParadas = [
        { status: 'concluida', is_checkpoint: true },
        { status: 'pendente', is_checkpoint: true },
        { status: 'pendente', is_checkpoint: true },
      ];

      mockFrom.mockImplementation((table: string) => {
        if (table === 'rotas') {
          return criarCadeia({ data: mockRota, error: null });
        }
        if (table === 'paradas') {
          return criarCadeia({ data: mockParadas, error: null });
        }
        return criarCadeia({ data: [], error: null });
      });

      const { result } = renderHook(() => useExpiredRoute('motorista-123'));

      await act(async () => {
        await result.current.loadExpiredRoute();
      });

      await waitFor(() => {
        expect(result.current.expiredRoute).not.toBeNull();
      });

      expect(result.current.expiredRoute?.rota_id).toBe('rota-expired');
      expect(result.current.expiredRoute?.total_paradas).toBe(3);
      expect(result.current.expiredRoute?.paradas_concluidas).toBe(1);
      expect(result.current.expiredRoute?.paradas_pendentes).toBe(2);
    });

    it('should expose updated_at as expirada_em so the card can show the real time', async () => {
      // A rota só chega aqui enquanto está em `nao_executada`, e a transição
      // PARA esse status é a própria expiração — então `updated_at` é a hora
      // dela. Sem isto o card volta a inventar um horário fixo.
      const mockRota = {
        id: 'rota-expired',
        data: '2024-01-01',
        updated_at: '2024-01-01T10:00:00Z',
      };

      mockFrom.mockImplementation((table: string) => {
        if (table === 'rotas') {
          return criarCadeia({ data: mockRota, error: null });
        }
        if (table === 'paradas') {
          return criarCadeia({
            data: [{ status: 'pendente', is_checkpoint: true }],
            error: null,
          });
        }
        return criarCadeia({ data: [], error: null });
      });

      const { result } = renderHook(() => useExpiredRoute('motorista-123'));

      await act(async () => {
        await result.current.loadExpiredRoute();
      });

      await waitFor(() => {
        expect(result.current.expiredRoute).not.toBeNull();
      });

      expect(result.current.expiredRoute?.expirada_em).toBe(
        '2024-01-01T10:00:00Z',
      );
    });

    it('should set expiredRoute to null on paradas error', async () => {
      const mockRota = {
        id: 'rota-expired',
        data: '2024-01-01',
        updated_at: '2024-01-01T10:00:00Z',
      };

      mockFrom.mockImplementation((table: string) => {
        if (table === 'rotas') {
          return criarCadeia({ data: mockRota, error: null });
        }
        if (table === 'paradas') {
          return criarCadeia({ data: null, error: { message: 'Error' } });
        }
        return criarCadeia({ data: [], error: null });
      });

      const { result } = renderHook(() => useExpiredRoute('motorista-123'));

      await act(async () => {
        await result.current.loadExpiredRoute();
      });

      expect(result.current.expiredRoute).toBeNull();
    });

    it('should handle exception during load', async () => {
      mockFrom.mockImplementation(() => {
        throw new Error('Network error');
      });

      const { result } = renderHook(() => useExpiredRoute('motorista-123'));

      await act(async () => {
        await result.current.loadExpiredRoute();
      });

      expect(result.current.expiredRoute).toBeNull();
    });
  });

  describe('dismissExpiredRoute', () => {
    it('should set expiredRouteDismissed to true', () => {
      const { result } = renderHook(() => useExpiredRoute('motorista-123'));

      expect(result.current.expiredRouteDismissed).toBe(false);

      act(() => {
        result.current.dismissExpiredRoute();
      });

      expect(result.current.expiredRouteDismissed).toBe(true);
    });
  });
});
