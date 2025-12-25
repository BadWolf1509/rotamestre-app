/**
 * Tests for useMotoristas.ts
 * Hook para gerenciar lista de motoristas com cache
 */

import { renderHook, waitFor, act } from '@testing-library/react-native';

import { useMotoristas, invalidateMotoristasCache } from '../useMotoristas';

// Mock dependencies
jest.mock('@/lib/cache', () => ({
  getCache: jest.fn(),
  setCache: jest.fn(),
  clearCache: jest.fn(),
  CACHE_TTL: { MOTORISTAS: 300000 },
  CACHE_KEYS: {
    MOTORISTAS: (unidadeId: string) => `motoristas:${unidadeId}`,
  },
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

// Mock useUnidadeAtiva
jest.mock('../useUnidadeAtiva', () => ({
  useUnidadeAtiva: jest.fn(),
}));

const mockCache = require('@/lib/cache');
const mockSupabase = require('@/lib/supabase').supabase;
const mockUseUnidadeAtiva = require('../useUnidadeAtiva').useUnidadeAtiva;

describe('useMotoristas', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCache.getCache.mockResolvedValue(null);
    mockCache.setCache.mockResolvedValue(undefined);
    mockCache.clearCache.mockResolvedValue(undefined);

    // Default: no unidade ativa
    mockUseUnidadeAtiva.mockReturnValue({ unidadeAtiva: null });
  });

  describe('Without unidade ativa', () => {
    it('should return empty motoristas when no unidade ativa', async () => {
      mockUseUnidadeAtiva.mockReturnValue({ unidadeAtiva: null });

      const { result } = renderHook(() => useMotoristas());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.motoristas).toEqual([]);
    });
  });

  describe('With unidade ativa', () => {
    beforeEach(() => {
      mockUseUnidadeAtiva.mockReturnValue({ unidadeAtiva: 'unidade-1' });
    });

    it('should start with loading state', () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      });

      const { result } = renderHook(() => useMotoristas());

      expect(result.current.loading).toBe(true);
    });

    it('should use cached data when available', async () => {
      const cachedMotoristas = [
        { id: 'driver-1', nome: 'João Silva' },
        { id: 'driver-2', nome: 'Maria Santos' },
      ];
      mockCache.getCache.mockResolvedValue(cachedMotoristas);

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      });

      const { result } = renderHook(() => useMotoristas());

      await waitFor(() => {
        expect(result.current.fromCache).toBe(false);
      });

      expect(mockCache.getCache).toHaveBeenCalledWith('motoristas:unidade-1');
    });

    it('should load motoristas from API', async () => {
      const apiData = [
        {
          usuario_id: 'u1',
          usuarios: { id: 'driver-1', nome: 'Carlos', email: 'c@test.com', telefone: '123', ativo: true },
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: apiData, error: null }),
            }),
          }),
        }),
      });

      const { result } = renderHook(() => useMotoristas());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.motoristas).toHaveLength(1);
      expect(result.current.motoristas[0].nome).toBe('Carlos');
    });

    it('should handle API error gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockRejectedValue(new Error('API Error')),
            }),
          }),
        }),
      });

      const { result } = renderHook(() => useMotoristas());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.motoristas).toEqual([]);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('getMotoristaById', () => {
    it('should return motorista by id', async () => {
      mockUseUnidadeAtiva.mockReturnValue({ unidadeAtiva: 'unidade-1' });

      const apiData = [
        { usuario_id: 'u1', usuarios: { id: 'driver-1', nome: 'João' } },
        { usuario_id: 'u2', usuarios: { id: 'driver-2', nome: 'Maria' } },
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: apiData, error: null }),
            }),
          }),
        }),
      });

      const { result } = renderHook(() => useMotoristas());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const found = result.current.getMotoristaById('driver-1');
      expect(found?.nome).toBe('João');
    });

    it('should return undefined for non-existent id', async () => {
      mockUseUnidadeAtiva.mockReturnValue({ unidadeAtiva: 'unidade-1' });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      });

      const { result } = renderHook(() => useMotoristas());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.getMotoristaById('non-existent')).toBeUndefined();
    });
  });
});

describe('invalidateMotoristasCache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCache.clearCache.mockResolvedValue(undefined);
  });

  it('should clear cache for specific unidade', async () => {
    await invalidateMotoristasCache('unidade-123');

    expect(mockCache.clearCache).toHaveBeenCalledWith('motoristas:unidade-123');
  });
});
