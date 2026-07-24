/**
 * Tests for useDistanceCalculation hook (with auto-calculation and debounce)
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';

// Mock google maps service
const mockGetDirections = jest.fn();
jest.mock('@/lib/google', () => ({
  googleMapsService: {
    getDirections: (...args: unknown[]) => mockGetDirections(...args),
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

import { useDistanceCalculation } from '../useDistanceCalculation';

// Use fake timers for debounce testing
jest.useFakeTimers();

describe('useDistanceCalculation', () => {
  const mockEnderecoUnidade = {
    latitude: -23.54,
    longitude: -46.63,
    endereco: 'Unidade Base',
  };

  const mockRotaOtimizada = {
    distancia_total_metros: 10000,
    duracao_total_segundos: 600,
    legs: [],
    polyline: 'encoded_polyline',
  };

  const mockParadas = [
    {
      id: '1',
      ordem: 1,
      endereco: 'Parada A',
      tipo: 'entrega' as const,
      destinatario: 'Cliente A',
      telefone: '11999999999',
      latitude: -23.55,
      longitude: -46.64,
    },
    {
      id: '2',
      ordem: 2,
      endereco: 'Parada B',
      tipo: 'entrega' as const,
      destinatario: 'Cliente B',
      telefone: '11888888888',
      latitude: -23.56,
      longitude: -46.65,
    },
  ];

  const defaultOptions = {
    paradas: [],
    enderecoUnidade: null,
    rotaOtimizada: null,
    ordemManual: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    mockGetDirections.mockResolvedValue(null);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
  });

  describe('initialization', () => {
    it('should initialize with null distanciaManualReal', () => {
      const { result } = renderHook(() =>
        useDistanceCalculation(defaultOptions),
      );

      expect(result.current.distanciaManualReal).toBeNull();
    });

    it('should initialize isCalculandoReal as false', () => {
      const { result } = renderHook(() =>
        useDistanceCalculation(defaultOptions),
      );

      expect(result.current.isCalculandoReal).toBe(false);
      expect(result.current.calculationError).toBeNull();
    });

    it('should provide resetDistanciaReal function', () => {
      const { result } = renderHook(() =>
        useDistanceCalculation(defaultOptions),
      );

      expect(typeof result.current.resetDistanciaReal).toBe('function');
    });
  });

  describe('auto-calculation with debounce', () => {
    it('should not auto-calculate when ordemManual is false', async () => {
      renderHook(() =>
        useDistanceCalculation({
          ...defaultOptions,
          paradas: mockParadas,
          enderecoUnidade: mockEnderecoUnidade,
          rotaOtimizada: mockRotaOtimizada,
          ordemManual: false,
        }),
      );

      // Advance timers past debounce delay
      act(() => {
        jest.advanceTimersByTime(1500);
      });

      expect(mockGetDirections).not.toHaveBeenCalled();
    });

    it('should calculate the route in registration order when there is no optimization', async () => {
      mockGetDirections.mockResolvedValue({
        distancia_total_metros: 12000,
        duracao_total_segundos: 720,
      });
      const { result } = renderHook(() =>
        useDistanceCalculation({
          ...defaultOptions,
          paradas: mockParadas,
          enderecoUnidade: mockEnderecoUnidade,
          rotaOtimizada: null,
          ordemManual: true,
        }),
      );

      expect(result.current.isCalculandoReal).toBe(true);
      await act(async () => {
        jest.advanceTimersByTime(1500);
        await Promise.resolve();
      });

      expect(mockGetDirections).toHaveBeenCalled();
      expect(result.current.distanciaManualReal?.metros).toBe(12000);
    });

    it('should not auto-calculate when enderecoUnidade is null', async () => {
      renderHook(() =>
        useDistanceCalculation({
          ...defaultOptions,
          paradas: mockParadas,
          enderecoUnidade: null,
          rotaOtimizada: mockRotaOtimizada,
          ordemManual: true,
        }),
      );

      act(() => {
        jest.advanceTimersByTime(1500);
      });

      expect(mockGetDirections).not.toHaveBeenCalled();
    });

    it('should not auto-calculate when paradas is empty', async () => {
      renderHook(() =>
        useDistanceCalculation({
          ...defaultOptions,
          paradas: [],
          enderecoUnidade: mockEnderecoUnidade,
          rotaOtimizada: mockRotaOtimizada,
          ordemManual: true,
        }),
      );

      act(() => {
        jest.advanceTimersByTime(1500);
      });

      expect(mockGetDirections).not.toHaveBeenCalled();
    });

    it('should auto-calculate after debounce delay when ordemManual is true', async () => {
      mockGetDirections.mockResolvedValue({
        distancia_total_metros: 15000,
        duracao_total_segundos: 900,
      });

      const { result } = renderHook(() =>
        useDistanceCalculation({
          ...defaultOptions,
          paradas: mockParadas,
          enderecoUnidade: mockEnderecoUnidade,
          rotaOtimizada: mockRotaOtimizada,
          ordemManual: true,
        }),
      );

      // Should not call immediately
      expect(mockGetDirections).not.toHaveBeenCalled();

      // Advance timers past debounce delay (1000ms)
      await act(async () => {
        jest.advanceTimersByTime(1100);
        await Promise.resolve();
      });

      expect(mockGetDirections).toHaveBeenCalledWith(
        {
          latitude: mockEnderecoUnidade.latitude,
          longitude: mockEnderecoUnidade.longitude,
        },
        {
          latitude: mockEnderecoUnidade.latitude,
          longitude: mockEnderecoUnidade.longitude,
        },
        expect.arrayContaining([
          { latitude: -23.55, longitude: -46.64 },
          { latitude: -23.56, longitude: -46.65 },
        ]),
        false, // optimize = false for manual order
      );

      await waitFor(() => {
        expect(result.current.distanciaManualReal).toEqual({
          metros: 15000,
          segundos: 900,
          isEstimated: false,
          polyline: undefined,
        });
      });
    });

    it('should debounce multiple rapid changes', async () => {
      mockGetDirections.mockResolvedValue({
        distancia_total_metros: 15000,
        duracao_total_segundos: 900,
      });

      const { rerender } = renderHook(
        (props) => useDistanceCalculation(props),
        {
          initialProps: {
            paradas: mockParadas,
            enderecoUnidade: mockEnderecoUnidade,
            rotaOtimizada: mockRotaOtimizada,
            ordemManual: true,
          },
        },
      );

      // First change
      act(() => {
        jest.advanceTimersByTime(500);
      });

      // Second change (before debounce completes)
      rerender({
        paradas: [
          ...mockParadas,
          {
            id: '3',
            ordem: 3,
            endereco: 'Parada C',
            tipo: 'entrega' as const,
            destinatario: 'Cliente C',
            telefone: '11777777777',
            latitude: -23.57,
            longitude: -46.66,
          },
        ],
        enderecoUnidade: mockEnderecoUnidade,
        rotaOtimizada: mockRotaOtimizada,
        ordemManual: true,
      });

      // Should still not have called (debounce restarted)
      expect(mockGetDirections).not.toHaveBeenCalled();

      // Advance past debounce
      await act(async () => {
        jest.advanceTimersByTime(1100);
        await Promise.resolve();
      });

      // Should only have been called once (debounced)
      expect(mockGetDirections).toHaveBeenCalledTimes(1);
    });

    it('should set isCalculandoReal during calculation', async () => {
      let resolvePromise: (value: unknown) => void;
      const controlledPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockGetDirections.mockReturnValue(controlledPromise);

      const { result } = renderHook(() =>
        useDistanceCalculation({
          ...defaultOptions,
          paradas: mockParadas,
          enderecoUnidade: mockEnderecoUnidade,
          rotaOtimizada: mockRotaOtimizada,
          ordemManual: true,
        }),
      );

      // Trigger auto-calculation
      await act(async () => {
        jest.advanceTimersByTime(1100);
      });

      expect(result.current.isCalculandoReal).toBe(true);

      // Resolve the promise
      await act(async () => {
        resolvePromise({
          distancia_total_metros: 1000,
          duracao_total_segundos: 60,
        });
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(result.current.isCalculandoReal).toBe(false);
      });
    });

    it('should filter paradas without coordinates', async () => {
      mockGetDirections.mockResolvedValue({
        distancia_total_metros: 1000,
        duracao_total_segundos: 60,
      });

      const paradasWithMissingCoords = [
        {
          id: '1',
          ordem: 1,
          endereco: 'A',
          tipo: 'entrega' as const,
          destinatario: 'A',
          telefone: '1',
          latitude: -23.55,
          longitude: -46.64,
        },
        {
          id: '2',
          ordem: 2,
          endereco: 'B',
          tipo: 'entrega' as const,
          destinatario: 'B',
          telefone: '2',
          latitude: null,
          longitude: null,
        },
        {
          id: '3',
          ordem: 3,
          endereco: 'C',
          tipo: 'entrega' as const,
          destinatario: 'C',
          telefone: '3',
          latitude: -23.56,
          longitude: -46.65,
        },
      ];

      renderHook(() =>
        useDistanceCalculation({
          ...defaultOptions,
          paradas: paradasWithMissingCoords,
          enderecoUnidade: mockEnderecoUnidade,
          rotaOtimizada: mockRotaOtimizada,
          ordemManual: true,
        }),
      );

      await act(async () => {
        jest.advanceTimersByTime(1100);
        await Promise.resolve();
      });

      // Should only pass 2 waypoints (without null coordinates)
      expect(mockGetDirections).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        [
          { latitude: -23.55, longitude: -46.64 },
          { latitude: -23.56, longitude: -46.65 },
        ],
        false,
      );
    });
  });

  describe('resetDistanciaReal', () => {
    it('should reset distanciaManualReal to null', async () => {
      mockGetDirections.mockResolvedValue({
        distancia_total_metros: 1000,
        duracao_total_segundos: 60,
      });

      const { result } = renderHook(() =>
        useDistanceCalculation({
          ...defaultOptions,
          paradas: mockParadas,
          enderecoUnidade: mockEnderecoUnidade,
          rotaOtimizada: mockRotaOtimizada,
          ordemManual: true,
        }),
      );

      // Wait for auto-calculation
      await act(async () => {
        jest.advanceTimersByTime(1100);
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(result.current.distanciaManualReal).not.toBeNull();
      });

      // Reset
      act(() => {
        result.current.resetDistanciaReal();
      });

      expect(result.current.distanciaManualReal).toBeNull();
      expect(result.current.isCalculandoReal).toBe(false);
      expect(result.current.calculationError).toBeNull();
    });

    it('should cancel pending requests on reset', async () => {
      let resolvePromise: (value: unknown) => void;
      mockGetDirections.mockReturnValue(
        new Promise((resolve) => {
          resolvePromise = resolve;
        }),
      );

      const { result } = renderHook(() =>
        useDistanceCalculation({
          ...defaultOptions,
          paradas: mockParadas,
          enderecoUnidade: mockEnderecoUnidade,
          rotaOtimizada: mockRotaOtimizada,
          ordemManual: true,
        }),
      );

      // Trigger auto-calculation
      await act(async () => {
        jest.advanceTimersByTime(1100);
      });

      expect(result.current.isCalculandoReal).toBe(true);

      // Reset while calculating
      act(() => {
        result.current.resetDistanciaReal();
      });

      expect(result.current.isCalculandoReal).toBe(false);
      expect(result.current.distanciaManualReal).toBeNull();

      // Resolve the old promise - should be ignored
      await act(async () => {
        resolvePromise!({
          distancia_total_metros: 9999,
          duracao_total_segundos: 999,
        });
        await Promise.resolve();
      });

      // Should still be null (request was cancelled)
      expect(result.current.distanciaManualReal).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should handle API errors gracefully', async () => {
      mockGetDirections.mockRejectedValue(new Error('API error'));

      const { result } = renderHook(() =>
        useDistanceCalculation({
          ...defaultOptions,
          paradas: mockParadas,
          enderecoUnidade: mockEnderecoUnidade,
          rotaOtimizada: mockRotaOtimizada,
          ordemManual: true,
        }),
      );

      await act(async () => {
        jest.advanceTimersByTime(1100);
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(result.current.isCalculandoReal).toBe(false);
      });

      // Should not crash, just leave distanciaManualReal as null
      expect(result.current.distanciaManualReal).toBeNull();
      expect(result.current.calculationError).toContain(
        'Não foi possível calcular',
      );
    });

    it('should handle null response from API', async () => {
      mockGetDirections.mockResolvedValue(null);

      const { result } = renderHook(() =>
        useDistanceCalculation({
          ...defaultOptions,
          paradas: mockParadas,
          enderecoUnidade: mockEnderecoUnidade,
          rotaOtimizada: mockRotaOtimizada,
          ordemManual: true,
        }),
      );

      await act(async () => {
        jest.advanceTimersByTime(1100);
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(result.current.isCalculandoReal).toBe(false);
      });

      expect(result.current.distanciaManualReal).toBeNull();
      expect(result.current.calculationError).toContain(
        'Não foi possível calcular',
      );
    });
  });
});
