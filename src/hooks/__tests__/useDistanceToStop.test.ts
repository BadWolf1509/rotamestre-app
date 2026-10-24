/**
 * Tests for useDistanceToStop hook
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';

// Mock OSRM
const mockGetDistance = jest.fn();
const mockEstimateRouteDistance = jest.fn();

jest.mock('@/lib/osrm', () => ({
  getDistance: (...args: unknown[]) => mockGetDistance(...args),
  estimateRouteDistance: (...args: unknown[]) => mockEstimateRouteDistance(...args),
}));

import { useDistanceToStop } from '../useDistanceToStop';

describe('useDistanceToStop', () => {
  const mockUserLocation = { latitude: -23.55, longitude: -46.63 };
  const mockDestination = { latitude: -23.56, longitude: -46.64 };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Default mock response
    mockGetDistance.mockResolvedValue({
      distance: 1500,
      distanceText: '1.5 km',
      duration: 300,
      durationText: '5 min',
    });

    mockEstimateRouteDistance.mockReturnValue({
      distance: 1400,
      distanceText: '1.4 km',
      duration: 280,
      durationText: '4 min',
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('initialization', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => useDistanceToStop(null, null));

      expect(result.current.distanceMeters).toBe(0);
      expect(result.current.distanceKm).toBe('--');
      expect(result.current.durationSeconds).toBe(0);
      expect(result.current.durationText).toBe('--');
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should not fetch when user location is null', async () => {
      renderHook(() => useDistanceToStop(null, mockDestination));

      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      expect(mockGetDistance).not.toHaveBeenCalled();
    });

    it('should not fetch when destination is null', async () => {
      renderHook(() => useDistanceToStop(mockUserLocation, null));

      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      expect(mockGetDistance).not.toHaveBeenCalled();
    });

    it('should not fetch when disabled', async () => {
      renderHook(() =>
        useDistanceToStop(mockUserLocation, mockDestination, { enabled: false })
      );

      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      expect(mockGetDistance).not.toHaveBeenCalled();
    });

    it('should not fetch when userLocation is undefined', async () => {
      renderHook(() => useDistanceToStop(undefined, mockDestination));

      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      expect(mockGetDistance).not.toHaveBeenCalled();
    });

    it('should not fetch when destination is undefined', async () => {
      renderHook(() => useDistanceToStop(mockUserLocation, undefined));

      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      expect(mockGetDistance).not.toHaveBeenCalled();
    });
  });

  describe('fetching distance', () => {
    it('should fetch distance when location and destination are provided', async () => {
      const { result } = renderHook(() =>
        useDistanceToStop(mockUserLocation, mockDestination)
      );

      await act(async () => {
        await jest.advanceTimersByTimeAsync(100);
      });

      await waitFor(() => {
        expect(mockGetDistance).toHaveBeenCalledWith(mockUserLocation, mockDestination);
      });

      await waitFor(() => {
        expect(result.current.distanceMeters).toBe(1500);
        expect(result.current.distanceKm).toBe('1.5 km');
        expect(result.current.durationSeconds).toBe(300);
        expect(result.current.durationText).toBe('5 min');
      });
    });

    it('should use fallback when OSRM fails', async () => {
      mockGetDistance.mockRejectedValueOnce(new Error('OSRM error'));

      const { result } = renderHook(() =>
        useDistanceToStop(mockUserLocation, mockDestination)
      );

      await act(async () => {
        await jest.advanceTimersByTimeAsync(100);
      });

      await waitFor(() => {
        expect(mockEstimateRouteDistance).toHaveBeenCalled();
      });

      expect(result.current.distanceMeters).toBe(1400);
      expect(result.current.distanceKm).toBe('1.4 km');
      expect(result.current.error).toBeNull(); // No error shown on fallback
      expect(result.current.isEstimated).toBe(true);
    });

    it('nao marca isEstimated quando a distancia vem do OSRM', async () => {
      const { result } = renderHook(() =>
        useDistanceToStop(mockUserLocation, mockDestination)
      );

      await act(async () => {
        await jest.advanceTimersByTimeAsync(100);
      });

      await waitFor(() => {
        expect(result.current.distanceMeters).toBe(1500);
      });

      expect(result.current.isEstimated).toBe(false);
    });

    it('marca isEstimated quando o proprio getDistance ja devolveu estimativa', async () => {
      // getDistance trata a falha internamente e devolve o fallback Haversine
      // sem lancar excecao: sem a flag, o hook nao teria como saber.
      mockGetDistance.mockResolvedValueOnce({
        distance: 1400,
        distanceText: '1.4 km',
        duration: 280,
        durationText: '4 min',
        is_estimated: true,
      });

      const { result } = renderHook(() =>
        useDistanceToStop(mockUserLocation, mockDestination)
      );

      await act(async () => {
        await jest.advanceTimersByTimeAsync(100);
      });

      await waitFor(() => {
        expect(result.current.distanceMeters).toBe(1400);
      });

      expect(result.current.isEstimated).toBe(true);
      expect(mockEstimateRouteDistance).not.toHaveBeenCalled();
    });
  });

  describe('rate limiting', () => {
    it('should respect local rate limiting (10s minimum)', async () => {
      const { rerender } = renderHook(
        ({ userLocation, destination }) =>
          useDistanceToStop(userLocation, destination),
        {
          initialProps: {
            userLocation: mockUserLocation,
            destination: mockDestination,
          },
        }
      );

      await act(async () => {
        await jest.advanceTimersByTimeAsync(100);
      });

      expect(mockGetDistance).toHaveBeenCalledTimes(1);

      // Change location within rate limit
      rerender({
        userLocation: { latitude: -23.551, longitude: -46.631 },
        destination: mockDestination,
      });

      await act(async () => {
        await jest.advanceTimersByTimeAsync(5000);
      });

      // Should still be 1 call due to rate limiting
      expect(mockGetDistance).toHaveBeenCalledTimes(1);
    });
  });

  describe('periodic refresh', () => {
    it('should cleanup interval on unmount', async () => {
      const { unmount } = renderHook(() =>
        useDistanceToStop(mockUserLocation, mockDestination, {
          refreshInterval: 30000,
        })
      );

      await act(async () => {
        await jest.advanceTimersByTimeAsync(100);
      });

      expect(mockGetDistance).toHaveBeenCalledTimes(1);

      unmount();

      await act(async () => {
        await jest.advanceTimersByTimeAsync(30000);
      });

      // Should not have been called again after unmount
      expect(mockGetDistance).toHaveBeenCalledTimes(1);
    });
  });

  describe('intervalo e movimento (DP-4)', () => {
    const renderizar = () =>
      renderHook(
        ({ userLocation, destination }) => useDistanceToStop(userLocation, destination),
        { initialProps: { userLocation: mockUserLocation, destination: mockDestination } },
      );

    it('sem movimento, consulta no máximo 1 vez por intervalo, mesmo com posição nova a cada tick do GPS', async () => {
      const { rerender } = renderizar();
      await act(async () => {
        await jest.advanceTimersByTimeAsync(100);
      });
      expect(mockGetDistance).toHaveBeenCalledTimes(1);

      // GPS entrega objeto novo a cada 5 s, com ruído de poucos metros e destino recriado
      for (let t = 5; t < 115; t += 5) {
        rerender({
          userLocation: { latitude: -23.55 + (t % 10) * 1e-6, longitude: -46.63 },
          destination: { ...mockDestination },
        });
        await act(async () => {
          await jest.advanceTimersByTimeAsync(5000);
        });
      }
      expect(mockGetDistance).toHaveBeenCalledTimes(1);

      await act(async () => {
        await jest.advanceTimersByTimeAsync(10000);
      });
      expect(mockGetDistance).toHaveBeenCalledTimes(2);
    });

    it('recalcula quando a posição anda acima do limiar, respeitando o intervalo mínimo', async () => {
      const { rerender } = renderizar();
      await act(async () => {
        await jest.advanceTimersByTimeAsync(100);
      });
      expect(mockGetDistance).toHaveBeenCalledTimes(1);

      // ~1,1 km ao norte, mas só 10 s depois: ainda dentro do intervalo mínimo
      const longe = { latitude: -23.54, longitude: -46.63 };
      await act(async () => {
        await jest.advanceTimersByTimeAsync(10000);
      });
      rerender({ userLocation: longe, destination: mockDestination });
      await act(async () => {
        await jest.advanceTimersByTimeAsync(100);
      });
      expect(mockGetDistance).toHaveBeenCalledTimes(1);

      // ao fim do intervalo mínimo, o movimento já acumulado dispara a consulta
      // sozinho, sem depender de outra posição chegar
      await act(async () => {
        await jest.advanceTimersByTimeAsync(25000);
      });
      expect(mockGetDistance).toHaveBeenCalledTimes(2);
      expect(mockGetDistance).toHaveBeenLastCalledWith(longe, mockDestination);
    });

    it('ao trocar de parada, o valor da anterior some na hora e a nova é consultada', async () => {
      const { result, rerender } = renderizar();
      await act(async () => {
        await jest.advanceTimersByTimeAsync(100);
      });
      expect(result.current.distanceKm).toBe('1.5 km');

      mockGetDistance.mockReturnValueOnce(new Promise(() => {})); // nunca resolve
      const outra = { latitude: -23.6, longitude: -46.7 };
      rerender({ userLocation: mockUserLocation, destination: outra });

      expect(result.current.distanceKm).toBe('--');
      expect(result.current.distanceMeters).toBe(0);
      expect(result.current.durationText).toBe('--');
      expect(mockGetDistance).toHaveBeenCalledTimes(2);
      expect(mockGetDistance).toHaveBeenLastCalledWith(mockUserLocation, outra);
    });

    it('descarta a resposta atrasada da parada anterior', async () => {
      let resolverAntiga: (v: unknown) => void = () => {};
      mockGetDistance.mockReturnValueOnce(
        new Promise((r) => {
          resolverAntiga = r;
        }),
      );
      const { result, rerender } = renderizar();
      await act(async () => {
        await jest.advanceTimersByTimeAsync(100);
      });

      mockGetDistance.mockReturnValueOnce(new Promise(() => {}));
      rerender({ userLocation: mockUserLocation, destination: { latitude: -23.6, longitude: -46.7 } });

      await act(async () => {
        resolverAntiga({ distance: 9999, distanceText: '10 km', duration: 1, durationText: '1 min' });
        await jest.advanceTimersByTimeAsync(100);
      });
      expect(result.current.distanceKm).not.toBe('10 km');
    });
  });
});
