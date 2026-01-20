/**
 * Tests for useRouteCreation hook
 */

import { renderHook, act } from '@testing-library/react-native';

import type { Parada, EnderecoUnidade, RotaOtimizadaState } from '@/components/gestor/nova-entrega/types';

// Mock dependencies
jest.mock('@/lib/google', () => ({
  googleMapsService: {
    getDirections: jest.fn(),
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

// Mock supabase
const mockSupabaseInsert = jest.fn();
const mockSupabaseSelect = jest.fn();
const mockSupabaseSingle = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      insert: mockSupabaseInsert,
      select: mockSupabaseSelect,
    })),
  },
}));

mockSupabaseInsert.mockReturnValue({
  select: mockSupabaseSelect,
});

mockSupabaseSelect.mockReturnValue({
  single: mockSupabaseSingle,
  then: (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve),
});

// Mock helpers
jest.mock('../../useNovaEntrega.helpers', () => ({
  prepararParadasParaInserir: jest.fn(() => []),
  atualizarVinculosParadas: jest.fn().mockResolvedValue(undefined),
}));

import { useRouteCreation } from '../useRouteCreation';

describe('useRouteCreation', () => {
  const mockParadas: Parada[] = [
    {
      id: 'parada-1',
      tipo: 'entrega',
      endereco: 'Rua A, 123',
      destinatario: 'João',
      telefone: '11999999999',
      observacoes: '',
      latitude: -23.55,
      longitude: -46.65,
      ordem: 1,
    },
  ];

  const mockEnderecoUnidade: EnderecoUnidade = {
    endereco: 'Av. Paulista, 1000',
    latitude: -23.5,
    longitude: -46.6,
  };

  const mockRotaOtimizada: RotaOtimizadaState = {
    distancia_total_metros: 10000,
    duracao_total_segundos: 600,
    legs: [],
    polyline: 'encoded',
  };

  const defaultOptions = {
    paradas: mockParadas,
    enderecoUnidade: mockEnderecoUnidade,
    rotaOtimizada: mockRotaOtimizada,
    ordemManual: false,
    motoristaSelecionado: 'motorista-123',
    unidadeAtiva: 'unidade-123',
    unidadeNome: 'Unidade Teste',
    userId: 'user-123',
    isLoading: false,
    setIsLoading: jest.fn(),
    showToast: jest.fn(),
    onSuccess: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('gerarRota validation', () => {
    it('should show toast if no paradas', async () => {
      const options = { ...defaultOptions, paradas: [] };
      const { result } = renderHook(() => useRouteCreation(options));

      let success: boolean = false;
      await act(async () => {
        success = await result.current.gerarRota();
      });

      expect(success).toBe(false);
      expect(options.showToast).toHaveBeenCalledWith(
        'Adicione pelo menos uma parada antes de gerar a rota',
        'info'
      );
    });

    it('should show toast if no motorista selected', async () => {
      const options = { ...defaultOptions, motoristaSelecionado: '' };
      const { result } = renderHook(() => useRouteCreation(options));

      let success: boolean = false;
      await act(async () => {
        success = await result.current.gerarRota();
      });

      expect(success).toBe(false);
      expect(options.showToast).toHaveBeenCalledWith(
        'Selecione um motorista para a rota',
        'info'
      );
    });

    it('should return false if already loading', async () => {
      const options = { ...defaultOptions, isLoading: true };
      const { result } = renderHook(() => useRouteCreation(options));

      let success: boolean = false;
      await act(async () => {
        success = await result.current.gerarRota();
      });

      expect(success).toBe(false);
      expect(options.setIsLoading).not.toHaveBeenCalled();
    });
  });

  describe('gerarRota execution', () => {
    it('should call setIsLoading true at start', async () => {
      const setIsLoading = jest.fn();
      const options = { ...defaultOptions, setIsLoading };

      mockSupabaseSingle.mockResolvedValueOnce({
        data: { id: 'rota-123' },
        error: null,
      });

      const { result } = renderHook(() => useRouteCreation(options));

      await act(async () => {
        await result.current.gerarRota();
      });

      expect(setIsLoading).toHaveBeenCalledWith(true);
    });

    it('should call setIsLoading false in finally block', async () => {
      const setIsLoading = jest.fn();
      const options = { ...defaultOptions, setIsLoading };

      mockSupabaseSingle.mockResolvedValueOnce({
        data: { id: 'rota-123' },
        error: null,
      });

      const { result } = renderHook(() => useRouteCreation(options));

      await act(async () => {
        await result.current.gerarRota();
      });

      expect(setIsLoading).toHaveBeenCalledWith(false);
    });

    it('should show error toast on database error', async () => {
      const options = { ...defaultOptions };

      mockSupabaseSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error' },
      });

      const { result } = renderHook(() => useRouteCreation(options));

      let success: boolean = true;
      await act(async () => {
        success = await result.current.gerarRota();
      });

      expect(success).toBe(false);
      expect(options.showToast).toHaveBeenCalledWith(
        'Não foi possível criar a rota. Tente novamente.',
        'error',
        5000
      );
    });

    it('should show success toast on successful creation', async () => {
      const options = { ...defaultOptions };

      mockSupabaseSingle.mockResolvedValueOnce({
        data: { id: 'rota-123' },
        error: null,
      });

      const { result } = renderHook(() => useRouteCreation(options));

      let success: boolean = false;
      await act(async () => {
        success = await result.current.gerarRota();
      });

      expect(success).toBe(true);
      expect(options.showToast).toHaveBeenCalledWith(
        expect.stringContaining('Rota circular criada com sucesso!'),
        'success',
        4000
      );
    });

    it('should call onSuccess after timeout', async () => {
      const onSuccess = jest.fn();
      const options = { ...defaultOptions, onSuccess };

      mockSupabaseSingle.mockResolvedValueOnce({
        data: { id: 'rota-123' },
        error: null,
      });

      const { result } = renderHook(() => useRouteCreation(options));

      await act(async () => {
        await result.current.gerarRota();
      });

      expect(onSuccess).not.toHaveBeenCalled();

      // Advance timers
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(onSuccess).toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should clear timeout on unmount', async () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

      mockSupabaseSingle.mockResolvedValueOnce({
        data: { id: 'rota-123' },
        error: null,
      });

      const { result, unmount } = renderHook(() => useRouteCreation(defaultOptions));

      await act(async () => {
        await result.current.gerarRota();
      });

      unmount();

      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });
  });
});
