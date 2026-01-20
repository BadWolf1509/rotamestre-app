/**
 * Tests for useMotoristaSelection hook
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';

// Mock supabase
const mockSelect = jest.fn();
const mockFrom = jest.fn(() => ({
  select: mockSelect,
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => mockFrom(table),
  },
}));

// Mock useUnidadeAtiva
let mockUnidadeAtiva: string | null = 'unidade-123';
jest.mock('@/hooks/useUnidadeAtiva', () => ({
  useUnidadeAtiva: () => ({
    unidadeAtiva: mockUnidadeAtiva,
  }),
}));

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

import { useMotoristaSelection } from '../useMotoristaSelection';

// Helper to setup supabase chain
const setupSupabaseChain = (finalResult: any) => {
  const chain: any = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    then: (resolve: any) => Promise.resolve(finalResult).then(resolve),
  };
  mockSelect.mockImplementation(() => chain);
  return chain;
};

describe('useMotoristaSelection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUnidadeAtiva = 'unidade-123';
  });

  describe('initialization', () => {
    it('should initialize with empty motoristas', async () => {
      setupSupabaseChain({ data: [], error: null });

      const { result } = renderHook(() => useMotoristaSelection());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.motoristas).toEqual([]);
    });

    it('should initialize motoristaSelecionado as empty string', () => {
      setupSupabaseChain({ data: [], error: null });

      const { result } = renderHook(() => useMotoristaSelection());

      expect(result.current.motoristaSelecionado).toBe('');
    });

    it('should provide setMotoristaSelecionado function', () => {
      setupSupabaseChain({ data: [], error: null });

      const { result } = renderHook(() => useMotoristaSelection());

      expect(typeof result.current.setMotoristaSelecionado).toBe('function');
    });

    it('should provide reload function', () => {
      setupSupabaseChain({ data: [], error: null });

      const { result } = renderHook(() => useMotoristaSelection());

      expect(typeof result.current.reload).toBe('function');
    });
  });

  describe('loading motoristas', () => {
    it('should load motoristas from unidade', async () => {
      const mockMotoristas = [
        { usuario_id: 'user-1', usuarios: { id: 'user-1', nome: 'Carlos', email: 'carlos@test.com', ativo: true } },
        { usuario_id: 'user-2', usuarios: { id: 'user-2', nome: 'Ana', email: 'ana@test.com', ativo: true } },
      ];

      setupSupabaseChain({ data: mockMotoristas, error: null });

      const { result } = renderHook(() => useMotoristaSelection());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.motoristas).toHaveLength(2);
      // Should be sorted by name
      expect(result.current.motoristas[0].nome).toBe('Ana');
      expect(result.current.motoristas[1].nome).toBe('Carlos');
    });

    it('should filter out inactive motoristas', async () => {
      const mockMotoristas = [
        { usuario_id: 'user-1', usuarios: { id: 'user-1', nome: 'Carlos', email: 'carlos@test.com', ativo: true } },
        { usuario_id: 'user-2', usuarios: { id: 'user-2', nome: 'Ana', email: 'ana@test.com', ativo: false } },
      ];

      setupSupabaseChain({ data: mockMotoristas, error: null });

      const { result } = renderHook(() => useMotoristaSelection());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.motoristas).toHaveLength(1);
      expect(result.current.motoristas[0].nome).toBe('Carlos');
    });

    it('should filter out null usuarios', async () => {
      const mockMotoristas = [
        { usuario_id: 'user-1', usuarios: { id: 'user-1', nome: 'Carlos', email: 'carlos@test.com', ativo: true } },
        { usuario_id: 'user-2', usuarios: null },
      ];

      setupSupabaseChain({ data: mockMotoristas, error: null });

      const { result } = renderHook(() => useMotoristaSelection());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.motoristas).toHaveLength(1);
    });

    it('should not load when unidadeAtiva is null', async () => {
      mockUnidadeAtiva = null;

      const { result } = renderHook(() => useMotoristaSelection());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockFrom).not.toHaveBeenCalled();
      expect(result.current.motoristas).toEqual([]);
    });

    it('should handle database error', async () => {
      const mockOnError = jest.fn();
      setupSupabaseChain({ data: null, error: new Error('Database error') });

      const { result } = renderHook(() => useMotoristaSelection(mockOnError));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockOnError).toHaveBeenCalledWith('Não foi possível carregar os motoristas');
    });

    it('should set isLoading to true while loading', async () => {
      let resolvePromise: (value: any) => void;
      const controlledPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      const chain: any = {
        select: jest.fn(() => chain),
        eq: jest.fn(() => chain),
        then: (resolve: any) => controlledPromise.then(resolve),
      };
      mockSelect.mockImplementation(() => chain);

      const { result } = renderHook(() => useMotoristaSelection());

      // isLoading should be true
      expect(result.current.isLoading).toBe(true);

      // Resolve the promise
      await act(async () => {
        resolvePromise!({ data: [], error: null });
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe('setMotoristaSelecionado', () => {
    it('should update motoristaSelecionado', async () => {
      setupSupabaseChain({ data: [], error: null });

      const { result } = renderHook(() => useMotoristaSelection());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.setMotoristaSelecionado('motorista-123');
      });

      expect(result.current.motoristaSelecionado).toBe('motorista-123');
    });
  });

  describe('reload', () => {
    it('should reload motoristas', async () => {
      setupSupabaseChain({ data: [], error: null });

      const { result } = renderHook(() => useMotoristaSelection());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Clear mock to check reload
      mockFrom.mockClear();

      // Setup new data
      const newMotoristas = [
        { usuario_id: 'user-1', usuarios: { id: 'user-1', nome: 'Novo', email: 'novo@test.com', ativo: true } },
      ];
      setupSupabaseChain({ data: newMotoristas, error: null });

      await act(async () => {
        await result.current.reload();
      });

      expect(mockFrom).toHaveBeenCalledWith('usuario_unidades');
    });
  });
});
