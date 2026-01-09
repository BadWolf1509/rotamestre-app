/**
 * Tests for useUnidadeAtiva.ts
 * Hook para gerenciar a unidade ativa do usuário
 */

import { renderHook, waitFor, act } from '@testing-library/react-native';

import { useUnidadeAtiva } from '../useUnidadeAtiva';

// Mock AsyncStorage
const mockGetItem = jest.fn();
const mockSetItem = jest.fn();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: (...args: unknown[]) => mockGetItem(...args),
  setItem: (...args: unknown[]) => mockSetItem(...args),
}));

// Mock useUser
const mockUserData = {
  id: 'user-123',
  unidade_id: 'unidade-default',
  papel: 'gestor',
};
const mockRefreshUser = jest.fn();

jest.mock('../useUser', () => ({
  useUser: () => ({
    userData: mockUserData,
    refresh: mockRefreshUser,
  }),
}));

// Mock Supabase
const mockFrom = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
  isSupabaseConfigured: true,
}));

describe('useUnidadeAtiva', () => {
  const mockVinculacoes = [
    {
      id: 'vinc-1',
      usuario_id: 'user-123',
      unidade_id: 'unidade-1',
      papel: 'gestor',
      is_principal: true,
      ativo: true,
      created_at: '2025-01-01',
      unidades: {
        id: 'unidade-1',
        nome: 'Unidade Principal',
        cidade: 'São Paulo',
        cnpj: '12.345.678/0001-90',
      },
    },
    {
      id: 'vinc-2',
      usuario_id: 'user-123',
      unidade_id: 'unidade-2',
      papel: 'motorista',
      is_principal: false,
      ativo: true,
      created_at: '2025-01-02',
      unidades: {
        id: 'unidade-2',
        nome: 'Unidade Secundária',
        cidade: 'Rio de Janeiro',
        cnpj: '98.765.432/0001-10',
      },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetItem.mockResolvedValue(null);
    mockSetItem.mockResolvedValue(undefined);
  });

  describe('Carregamento Inicial', () => {
    it('deve carregar vinculações do usuário', async () => {
      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockOrder = jest.fn().mockReturnThis();
      const mockReturns = jest.fn().mockResolvedValue({
        data: mockVinculacoes,
        error: null,
      });

      mockFrom.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        order: mockOrder,
        returns: mockReturns,
      });

      const { result } = renderHook(() => useUnidadeAtiva());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.vinculacoes).toHaveLength(2);
      expect(mockFrom).toHaveBeenCalledWith('usuario_unidades');
    });

    it('deve usar unidade do AsyncStorage se válida', async () => {
      mockGetItem.mockResolvedValue('unidade-2');

      const mockReturns = jest.fn().mockResolvedValue({
        data: mockVinculacoes,
        error: null,
      });

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        returns: mockReturns,
      });

      const { result } = renderHook(() => useUnidadeAtiva());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.unidadeAtiva).toBe('unidade-2');
    });

    it('deve usar unidade principal quando AsyncStorage inválido', async () => {
      mockGetItem.mockResolvedValue('unidade-inexistente');

      const mockReturns = jest.fn().mockResolvedValue({
        data: mockVinculacoes,
        error: null,
      });

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        returns: mockReturns,
      });

      const { result } = renderHook(() => useUnidadeAtiva());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Deve usar a unidade principal (is_principal: true)
      expect(result.current.unidadeAtiva).toBe('unidade-1');
      expect(mockSetItem).toHaveBeenCalledWith('@rotamestre:unidade_ativa', 'unidade-1');
    });
  });

  describe('Derivações', () => {
    it('deve calcular temMultiplasUnidades corretamente', async () => {
      const mockReturns = jest.fn().mockResolvedValue({
        data: mockVinculacoes,
        error: null,
      });

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        returns: mockReturns,
      });

      const { result } = renderHook(() => useUnidadeAtiva());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.temMultiplasUnidades).toBe(true);
    });

    it('deve retornar temMultiplasUnidades false para unidade única', async () => {
      const mockReturns = jest.fn().mockResolvedValue({
        data: [mockVinculacoes[0]],
        error: null,
      });

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        returns: mockReturns,
      });

      const { result } = renderHook(() => useUnidadeAtiva());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.temMultiplasUnidades).toBe(false);
    });
  });

  describe('Troca de Unidade', () => {
    it('deve trocar de unidade com sucesso', async () => {
      mockGetItem.mockResolvedValue('unidade-1');

      const mockReturns = jest.fn().mockResolvedValue({
        data: mockVinculacoes,
        error: null,
      });

      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      });

      mockFrom.mockImplementation((table) => {
        if (table === 'usuarios') {
          return { update: mockUpdate };
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          returns: mockReturns,
        };
      });

      const { result } = renderHook(() => useUnidadeAtiva());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.trocarUnidade('unidade-2');
      });

      expect(mockSetItem).toHaveBeenCalledWith('@rotamestre:unidade_ativa', 'unidade-2');
      expect(result.current.unidadeAtiva).toBe('unidade-2');
      expect(mockRefreshUser).toHaveBeenCalled();
    });

    it('não deve trocar para unidade sem acesso', async () => {
      mockGetItem.mockResolvedValue('unidade-1');

      const mockReturns = jest.fn().mockResolvedValue({
        data: mockVinculacoes,
        error: null,
      });

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        returns: mockReturns,
      });

      const { result } = renderHook(() => useUnidadeAtiva());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.trocarUnidade('unidade-inexistente');
      });

      // Não deve ter chamado setItem para unidade inválida
      expect(result.current.unidadeAtiva).toBe('unidade-1');
    });
  });

  describe('Tratamento de Erros', () => {
    it('deve usar fallback quando query falha', async () => {
      const mockReturns = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Query failed' },
      });

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        returns: mockReturns,
      });

      const { result } = renderHook(() => useUnidadeAtiva());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Deve usar unidade_id do userData como fallback
      expect(result.current.unidadeAtiva).toBe('unidade-default');
    });

    it('deve tratar exceção durante carregamento', async () => {
      mockFrom.mockImplementation(() => {
        throw new Error('Database error');
      });

      const { result } = renderHook(() => useUnidadeAtiva());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Deve usar fallback
      expect(result.current.unidadeAtiva).toBe('unidade-default');
    });
  });

  describe('Função refresh', () => {
    it('deve recarregar vinculações', async () => {
      const mockReturns = jest.fn().mockResolvedValue({
        data: mockVinculacoes,
        error: null,
      });

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        returns: mockReturns,
      });

      const { result } = renderHook(() => useUnidadeAtiva());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Chamar refresh
      await act(async () => {
        await result.current.refresh();
      });

      // Deve ter chamado from duas vezes (inicial + refresh)
      expect(mockFrom).toHaveBeenCalledTimes(2);
    });
  });
});
