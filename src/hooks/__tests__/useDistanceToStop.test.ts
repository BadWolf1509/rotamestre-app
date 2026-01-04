/**
 * Tests for useDistanceToStop.ts
 * Hook para calcular distância e tempo até uma parada
 */

import { renderHook } from '@testing-library/react-native';

import { useDistanceToStop } from '../useDistanceToStop';

// Mock Supabase
const mockInvoke = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

describe('useDistanceToStop', () => {
  const userLocation = { latitude: -23.55, longitude: -46.63 };
  const destination = { latitude: -23.56, longitude: -46.64 };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Estado Inicial', () => {
    it('deve retornar valores iniciais quando sem coordenadas', () => {
      const { result } = renderHook(() =>
        useDistanceToStop(null, null)
      );

      expect(result.current.distanceKm).toBe('--');
      expect(result.current.durationText).toBe('--');
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('deve retornar valores iniciais quando desabilitado', () => {
      const { result } = renderHook(() =>
        useDistanceToStop(userLocation, destination, { enabled: false })
      );

      expect(result.current.distanceKm).toBe('--');
      expect(result.current.isLoading).toBe(false);
    });

    it('deve retornar valores iniciais quando userLocation é undefined', () => {
      const { result } = renderHook(() =>
        useDistanceToStop(undefined, destination)
      );

      expect(result.current.distanceKm).toBe('--');
      expect(result.current.error).toBeNull();
    });

    it('deve retornar valores iniciais quando destination é undefined', () => {
      const { result } = renderHook(() =>
        useDistanceToStop(userLocation, undefined)
      );

      expect(result.current.distanceKm).toBe('--');
      expect(result.current.error).toBeNull();
    });

    it('deve ter distanceMeters inicial como 0', () => {
      const { result } = renderHook(() =>
        useDistanceToStop(null, null)
      );

      expect(result.current.distanceMeters).toBe(0);
      expect(result.current.durationSeconds).toBe(0);
    });
  });
});
