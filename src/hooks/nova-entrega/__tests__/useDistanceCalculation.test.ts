/**
 * Tests for useDistanceCalculation hook
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';

// Mock google maps service
const mockGetDirections = jest.fn();
jest.mock('@/lib/google', () => ({
  googleMapsService: {
    getDirections: (...args: any[]) => mockGetDirections(...args),
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

// Mock distanceInMeters helper
jest.mock('../../useNovaEntrega.helpers', () => ({
  distanceInMeters: (point1: any, point2: any) => {
    // Simple mock implementation
    if (!point1.latitude || !point1.longitude || !point2.latitude || !point2.longitude) {
      return Number.POSITIVE_INFINITY;
    }
    const lat1 = point1.latitude;
    const lon1 = point1.longitude;
    const lat2 = point2.latitude;
    const lon2 = point2.longitude;
    // Simplified distance calculation
    const latDiff = Math.abs(lat1 - lat2);
    const lonDiff = Math.abs(lon1 - lon2);
    return (latDiff + lonDiff) * 111000; // ~111km per degree
  },
}));

import { useDistanceCalculation } from '../useDistanceCalculation';

describe('useDistanceCalculation', () => {
  const mockShowToast = jest.fn();

  const defaultOptions = {
    paradas: [],
    enderecoUnidade: null,
    rotaOtimizada: null,
    ordemManual: false,
    showToast: mockShowToast,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDirections.mockResolvedValue(null);
  });

  describe('initialization', () => {
    it('should initialize with null distanciaManualReal', () => {
      const { result } = renderHook(() =>
        useDistanceCalculation(defaultOptions)
      );

      expect(result.current.distanciaManualReal).toBeNull();
    });

    it('should initialize with null distanciaManualAproximada when ordemManual is false', () => {
      const { result } = renderHook(() =>
        useDistanceCalculation(defaultOptions)
      );

      expect(result.current.distanciaManualAproximada).toBeNull();
    });

    it('should initialize isCalculandoReal as false', () => {
      const { result } = renderHook(() =>
        useDistanceCalculation(defaultOptions)
      );

      expect(result.current.isCalculandoReal).toBe(false);
    });

    it('should provide calcularDistanciaReal function', () => {
      const { result } = renderHook(() =>
        useDistanceCalculation(defaultOptions)
      );

      expect(typeof result.current.calcularDistanciaReal).toBe('function');
    });

    it('should provide resetDistanciaReal function', () => {
      const { result } = renderHook(() =>
        useDistanceCalculation(defaultOptions)
      );

      expect(typeof result.current.resetDistanciaReal).toBe('function');
    });
  });

  describe('distanciaManualAproximada', () => {
    it('should return null when ordemManual is false', () => {
      const { result } = renderHook(() =>
        useDistanceCalculation({
          ...defaultOptions,
          ordemManual: false,
          rotaOtimizada: {
            distancia_total_metros: 10000,
            duracao_total_segundos: 600,
            ordem_otimizada: [0, 1],
            polyline: '',
          },
        })
      );

      expect(result.current.distanciaManualAproximada).toBeNull();
    });

    it('should return null when rotaOtimizada is null', () => {
      const { result } = renderHook(() =>
        useDistanceCalculation({
          ...defaultOptions,
          ordemManual: true,
          rotaOtimizada: null,
        })
      );

      expect(result.current.distanciaManualAproximada).toBeNull();
    });

    it('should calculate aproximada distance with urban correction factor', () => {
      const paradas = [
        { id: '1', ordem: 1, endereco: 'A', latitude: -23.55, longitude: -46.64 },
        { id: '2', ordem: 2, endereco: 'B', latitude: -23.56, longitude: -46.65 },
      ];

      const { result } = renderHook(() =>
        useDistanceCalculation({
          ...defaultOptions,
          paradas,
          enderecoUnidade: {
            latitude: -23.54,
            longitude: -46.63,
            endereco_formatado: 'Unidade',
          },
          rotaOtimizada: {
            distancia_total_metros: 5000,
            duracao_total_segundos: 300,
            ordem_otimizada: [0, 1],
            polyline: '',
          },
          ordemManual: true,
        })
      );

      expect(result.current.distanciaManualAproximada).not.toBeNull();
      expect(result.current.distanciaManualAproximada!.metros).toBeGreaterThan(0);
    });

    it('should handle zero base distance', () => {
      const paradas = [
        { id: '1', ordem: 1, endereco: 'A', latitude: -23.55, longitude: -46.64 },
      ];

      const { result } = renderHook(() =>
        useDistanceCalculation({
          ...defaultOptions,
          paradas,
          enderecoUnidade: {
            latitude: -23.54,
            longitude: -46.63,
            endereco_formatado: 'Unidade',
          },
          rotaOtimizada: {
            distancia_total_metros: 0,
            duracao_total_segundos: 0,
            ordem_otimizada: [0],
            polyline: '',
          },
          ordemManual: true,
        })
      );

      expect(result.current.distanciaManualAproximada).not.toBeNull();
      expect(result.current.distanciaManualAproximada!.percentual).toBe(0);
    });
  });

  describe('calcularDistanciaReal', () => {
    it('should not calculate when enderecoUnidade is null', async () => {
      const { result } = renderHook(() =>
        useDistanceCalculation({
          ...defaultOptions,
          enderecoUnidade: null,
          paradas: [{ id: '1', ordem: 1, endereco: 'A', latitude: -23.55, longitude: -46.64 }],
        })
      );

      await act(async () => {
        await result.current.calcularDistanciaReal();
      });

      expect(mockGetDirections).not.toHaveBeenCalled();
    });

    it('should not calculate when paradas is empty', async () => {
      const { result } = renderHook(() =>
        useDistanceCalculation({
          ...defaultOptions,
          enderecoUnidade: { latitude: -23.54, longitude: -46.63, endereco_formatado: 'Unidade' },
          paradas: [],
        })
      );

      await act(async () => {
        await result.current.calcularDistanciaReal();
      });

      expect(mockGetDirections).not.toHaveBeenCalled();
    });

    it('should call getDirections with correct parameters', async () => {
      mockGetDirections.mockResolvedValue({
        distancia_total_metros: 15000,
        duracao_total_segundos: 900,
      });

      const paradas = [
        { id: '1', ordem: 1, endereco: 'A', latitude: -23.55, longitude: -46.64 },
        { id: '2', ordem: 2, endereco: 'B', latitude: -23.56, longitude: -46.65 },
      ];

      const enderecoUnidade = {
        latitude: -23.54,
        longitude: -46.63,
        endereco_formatado: 'Unidade',
      };

      const { result } = renderHook(() =>
        useDistanceCalculation({
          ...defaultOptions,
          enderecoUnidade,
          paradas,
        })
      );

      await act(async () => {
        await result.current.calcularDistanciaReal();
      });

      expect(mockGetDirections).toHaveBeenCalledWith(
        { latitude: -23.54, longitude: -46.63 },
        { latitude: -23.54, longitude: -46.63 },
        expect.arrayContaining([
          { latitude: -23.55, longitude: -46.64 },
          { latitude: -23.56, longitude: -46.65 },
        ]),
        false
      );
    });

    it('should update distanciaManualReal on success', async () => {
      mockGetDirections.mockResolvedValue({
        distancia_total_metros: 15000,
        duracao_total_segundos: 900,
      });

      const paradas = [
        { id: '1', ordem: 1, endereco: 'A', latitude: -23.55, longitude: -46.64 },
      ];

      const { result } = renderHook(() =>
        useDistanceCalculation({
          ...defaultOptions,
          enderecoUnidade: { latitude: -23.54, longitude: -46.63, endereco_formatado: 'Unidade' },
          paradas,
        })
      );

      await act(async () => {
        await result.current.calcularDistanciaReal();
      });

      expect(result.current.distanciaManualReal).toEqual({
        metros: 15000,
        segundos: 900,
      });
      expect(mockShowToast).toHaveBeenCalledWith('Distância real calculada!', 'success');
    });

    it('should show error toast when getDirections returns null', async () => {
      mockGetDirections.mockResolvedValue(null);

      const paradas = [
        { id: '1', ordem: 1, endereco: 'A', latitude: -23.55, longitude: -46.64 },
      ];

      const { result } = renderHook(() =>
        useDistanceCalculation({
          ...defaultOptions,
          enderecoUnidade: { latitude: -23.54, longitude: -46.63, endereco_formatado: 'Unidade' },
          paradas,
        })
      );

      await act(async () => {
        await result.current.calcularDistanciaReal();
      });

      expect(mockShowToast).toHaveBeenCalledWith('Não foi possível calcular a distância real', 'error');
    });

    it('should show error toast on exception', async () => {
      mockGetDirections.mockRejectedValue(new Error('API error'));

      const paradas = [
        { id: '1', ordem: 1, endereco: 'A', latitude: -23.55, longitude: -46.64 },
      ];

      const { result } = renderHook(() =>
        useDistanceCalculation({
          ...defaultOptions,
          enderecoUnidade: { latitude: -23.54, longitude: -46.63, endereco_formatado: 'Unidade' },
          paradas,
        })
      );

      await act(async () => {
        await result.current.calcularDistanciaReal();
      });

      expect(mockShowToast).toHaveBeenCalledWith('Erro ao calcular distância', 'error');
    });

    it('should set isCalculandoReal during calculation', async () => {
      let resolvePromise: (value: any) => void;
      const controlledPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockGetDirections.mockReturnValue(controlledPromise);

      const paradas = [
        { id: '1', ordem: 1, endereco: 'A', latitude: -23.55, longitude: -46.64 },
      ];

      const { result } = renderHook(() =>
        useDistanceCalculation({
          ...defaultOptions,
          enderecoUnidade: { latitude: -23.54, longitude: -46.63, endereco_formatado: 'Unidade' },
          paradas,
        })
      );

      // Start calculation
      act(() => {
        result.current.calcularDistanciaReal();
      });

      expect(result.current.isCalculandoReal).toBe(true);

      // Resolve
      await act(async () => {
        resolvePromise!({ distancia_total_metros: 1000, duracao_total_segundos: 60 });
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

      const paradas = [
        { id: '1', ordem: 1, endereco: 'A', latitude: -23.55, longitude: -46.64 },
        { id: '2', ordem: 2, endereco: 'B', latitude: null, longitude: null },
        { id: '3', ordem: 3, endereco: 'C', latitude: -23.56, longitude: -46.65 },
      ];

      const { result } = renderHook(() =>
        useDistanceCalculation({
          ...defaultOptions,
          enderecoUnidade: { latitude: -23.54, longitude: -46.63, endereco_formatado: 'Unidade' },
          paradas,
        })
      );

      await act(async () => {
        await result.current.calcularDistanciaReal();
      });

      // Should only pass 2 waypoints (without null coordinates)
      expect(mockGetDirections).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        expect.arrayContaining([
          { latitude: -23.55, longitude: -46.64 },
          { latitude: -23.56, longitude: -46.65 },
        ]),
        false
      );
    });
  });

  describe('resetDistanciaReal', () => {
    it('should reset distanciaManualReal to null', async () => {
      mockGetDirections.mockResolvedValue({
        distancia_total_metros: 1000,
        duracao_total_segundos: 60,
      });

      const paradas = [
        { id: '1', ordem: 1, endereco: 'A', latitude: -23.55, longitude: -46.64 },
      ];

      const { result } = renderHook(() =>
        useDistanceCalculation({
          ...defaultOptions,
          enderecoUnidade: { latitude: -23.54, longitude: -46.63, endereco_formatado: 'Unidade' },
          paradas,
        })
      );

      // First calculate
      await act(async () => {
        await result.current.calcularDistanciaReal();
      });

      expect(result.current.distanciaManualReal).not.toBeNull();

      // Then reset
      act(() => {
        result.current.resetDistanciaReal();
      });

      expect(result.current.distanciaManualReal).toBeNull();
    });
  });
});
