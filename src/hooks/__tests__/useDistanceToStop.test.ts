/**
 * Tests for useDistanceToStop.ts
 * Hook para calcular distância e tempo até uma parada
 */

import { renderHook } from '@testing-library/react-native';

import { useDistanceToStop, calculateHaversineDistance } from '../useDistanceToStop';

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

describe('calculateHaversineDistance', () => {
  it('deve calcular distância entre dois pontos próximos', () => {
    const from = { latitude: -23.55, longitude: -46.63 };
    const to = { latitude: -23.56, longitude: -46.64 };

    const result = calculateHaversineDistance(from, to);

    // Distância deve ser aproximadamente 1.4km
    expect(result.meters).toBeGreaterThan(1000);
    expect(result.meters).toBeLessThan(2000);
    expect(result.km).toContain('km');
  });

  it('deve formatar distância em metros quando < 1km', () => {
    const from = { latitude: -23.55, longitude: -46.63 };
    const to = { latitude: -23.551, longitude: -46.631 }; // Muito próximo

    const result = calculateHaversineDistance(from, to);

    expect(result.meters).toBeLessThan(1000);
    expect(result.km).toContain('m');
    expect(result.km).not.toContain('km');
  });

  it('deve retornar 0 para mesmos pontos', () => {
    const point = { latitude: -23.55, longitude: -46.63 };

    const result = calculateHaversineDistance(point, point);

    expect(result.meters).toBe(0);
    expect(result.km).toBe('0m');
  });

  it('deve calcular distância para pontos distantes', () => {
    // São Paulo para Rio de Janeiro (~360km)
    const sp = { latitude: -23.55, longitude: -46.63 };
    const rj = { latitude: -22.90, longitude: -43.17 };

    const result = calculateHaversineDistance(sp, rj);

    expect(result.meters).toBeGreaterThan(350000);
    expect(result.meters).toBeLessThan(400000);
    expect(result.km).toContain('km');
  });
});
