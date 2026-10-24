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

  describe('aproximação da parada e limpeza (rodada de correção 1)', () => {
    // 0,001° de latitude ~ 111 m. Destino em -23.56: -23.5573 fica a ~300 m.
    const perto = { latitude: -23.5573, longitude: -46.64 };
    const maisPerto = { latitude: -23.5582, longitude: -46.64 }; // ~200 m: andou ~100 m

    const renderizar = (inicial = perto) =>
      renderHook(
        ({ userLocation, destination }) => useDistanceToStop(userLocation, destination),
        { initialProps: { userLocation: inicial, destination: mockDestination } },
      );

    it('a 300 m da parada, andar 100 m recalcula antes do motorista chegar', async () => {
      const { rerender } = renderizar();
      await act(async () => {
        await jest.advanceTimersByTimeAsync(100);
      });
      expect(mockGetDistance).toHaveBeenCalledTimes(1);

      await act(async () => {
        await jest.advanceTimersByTimeAsync(31000);
      });
      rerender({ userLocation: maisPerto, destination: mockDestination });
      await act(async () => {
        await jest.advanceTimersByTimeAsync(100);
      });
      expect(mockGetDistance).toHaveBeenCalledTimes(2);
    });

    it('perto da parada, ruído de GPS abaixo do piso não consulta', async () => {
      const { rerender } = renderizar();
      await act(async () => {
        await jest.advanceTimersByTimeAsync(100);
      });
      await act(async () => {
        await jest.advanceTimersByTimeAsync(31000);
      });
      rerender({ userLocation: { latitude: -23.5573 - 0.0002, longitude: -46.64 }, destination: mockDestination }); // ~22 m
      await act(async () => {
        await jest.advanceTimersByTimeAsync(100);
      });
      expect(mockGetDistance).toHaveBeenCalledTimes(1);
    });

    it('consulta por movimento reinicia o relógio: a rodada do intervalo logo depois é pulada', async () => {
      const { rerender } = renderizar(mockUserLocation);
      await act(async () => {
        await jest.advanceTimersByTimeAsync(100);
      });
      await act(async () => {
        await jest.advanceTimersByTimeAsync(110000);
      });
      rerender({ userLocation: { latitude: -23.54, longitude: -46.63 }, destination: mockDestination });
      await act(async () => {
        await jest.advanceTimersByTimeAsync(100);
      });
      expect(mockGetDistance).toHaveBeenCalledTimes(2);
      // o intervalo de 2 min cai ~10 s depois da consulta por movimento
      await act(async () => {
        await jest.advanceTimersByTimeAsync(15000);
      });
      expect(mockGetDistance).toHaveBeenCalledTimes(2);
    });

    it('perda momentânea de GPS na mesma parada mantém o valor', async () => {
      const { result, rerender } = renderHook(
        ({ userLocation }: { userLocation: { latitude: number; longitude: number } | null }) =>
          useDistanceToStop(userLocation, mockDestination),
        { initialProps: { userLocation: mockUserLocation as { latitude: number; longitude: number } | null } },
      );
      await act(async () => {
        await jest.advanceTimersByTimeAsync(100);
      });
      expect(result.current.distanceKm).toBe('1.5 km');

      rerender({ userLocation: null });
      expect(result.current.distanceKm).toBe('1.5 km');

      rerender({ userLocation: { ...mockUserLocation } });
      await act(async () => {
        await jest.advanceTimersByTimeAsync(100);
      });
      expect(result.current.distanceKm).toBe('1.5 km');
      expect(mockGetDistance).toHaveBeenCalledTimes(1);
    });

    it('sem posição no início, consulta quando o GPS chega', async () => {
      const { rerender } = renderHook(
        ({ userLocation }: { userLocation: { latitude: number; longitude: number } | null }) =>
          useDistanceToStop(userLocation, mockDestination),
        { initialProps: { userLocation: null as { latitude: number; longitude: number } | null } },
      );
      await act(async () => {
        await jest.advanceTimersByTimeAsync(100);
      });
      expect(mockGetDistance).not.toHaveBeenCalled();
      rerender({ userLocation: mockUserLocation });
      await act(async () => {
        await jest.advanceTimersByTimeAsync(100);
      });
      expect(mockGetDistance).toHaveBeenCalledTimes(1);
    });

    it('desmontar cancela o timeout agendado por movimento e descarta consulta em voo', async () => {
      const { rerender, unmount, result } = renderizar(mockUserLocation);
      await act(async () => {
        await jest.advanceTimersByTimeAsync(100);
      });
      // movimento dentro da janela mínima: fica um timeout agendado
      rerender({ userLocation: { latitude: -23.54, longitude: -46.63 }, destination: mockDestination });
      unmount();
      await act(async () => {
        await jest.advanceTimersByTimeAsync(60000);
      });
      expect(mockGetDistance).toHaveBeenCalledTimes(1);
      expect(result.current.distanceKm).toBe('1.5 km');
    });

    it('trocar de parada cancela o timeout agendado da parada anterior', async () => {
      const { rerender } = renderizar(mockUserLocation);
      await act(async () => {
        await jest.advanceTimersByTimeAsync(100);
      });
      const longe = { latitude: -23.54, longitude: -46.63 };
      rerender({ userLocation: longe, destination: mockDestination }); // agenda timeout (~30 s)
      const outra = { latitude: -23.6, longitude: -46.7 };
      rerender({ userLocation: longe, destination: outra }); // consulta já da nova
      expect(mockGetDistance).toHaveBeenCalledTimes(2);
      await act(async () => {
        await jest.advanceTimersByTimeAsync(31000);
      });
      // o timeout antigo não dispara uma 3ª consulta
      expect(mockGetDistance).toHaveBeenCalledTimes(2);
    });

    it('não faz setState depois de desmontar com consulta em voo', async () => {
      // O React 18 ignora setState em componente desmontado, então o resultado
      // não é observável por `result.current`: conta as chamadas ao setter.
      const React = jest.requireActual('react');
      const original = React.useState;
      let chamadasAoSetter = 0;
      const espiao = jest.spyOn(React, 'useState').mockImplementation(((inicial: unknown) => {
        const [valor, set] = original(inicial);
        const contado = (...args: unknown[]) => {
          chamadasAoSetter++;
          return set(...args);
        };
        return [valor, contado];
      }) as typeof React.useState);
      try {
        let resolver: (v: unknown) => void = () => {};
        mockGetDistance.mockReturnValueOnce(new Promise((r) => { resolver = r; }));
        const { unmount } = renderizar(mockUserLocation);
        await act(async () => {
          await jest.advanceTimersByTimeAsync(100);
        });
        unmount();
        const antes = chamadasAoSetter;
        await act(async () => {
          resolver({ distance: 1, distanceText: '1 m', duration: 1, durationText: '1 min' });
          await jest.advanceTimersByTimeAsync(100);
        });
        expect(chamadasAoSetter).toBe(antes);
      } finally {
        espiao.mockRestore();
      }
    });

    it('perto da parada (~100 m), ruído de 40 m não recalcula (piso de 50 m)', async () => {
      const quase = { latitude: -23.5591, longitude: -46.64 }; // ~100 m
      const { rerender } = renderizar(quase);
      await act(async () => {
        await jest.advanceTimersByTimeAsync(100);
      });
      await act(async () => {
        await jest.advanceTimersByTimeAsync(31000);
      });
      // 0,00036° ~ 40 m: acima de 30% de 100 m (30 m), abaixo do piso (50 m)
      rerender({ userLocation: { latitude: -23.5591 + 0.00036, longitude: -46.64 }, destination: mockDestination });
      await act(async () => {
        await jest.advanceTimersByTimeAsync(100);
      });
      expect(mockGetDistance).toHaveBeenCalledTimes(1);
    });

    it('longe da parada, o teto de 500 m vale: 400 m não recalcula, 600 m sim', async () => {
      // ~11 km do destino: 30% seria 3,3 km, o teto limita a 500 m
      const longe = { latitude: -23.46, longitude: -46.64 };
      const { rerender } = renderizar(longe);
      await act(async () => {
        await jest.advanceTimersByTimeAsync(100);
      });
      await act(async () => {
        await jest.advanceTimersByTimeAsync(31000);
      });
      rerender({ userLocation: { latitude: -23.46 + 0.0036, longitude: -46.64 }, destination: mockDestination }); // ~400 m
      await act(async () => {
        await jest.advanceTimersByTimeAsync(100);
      });
      expect(mockGetDistance).toHaveBeenCalledTimes(1);

      rerender({ userLocation: { latitude: -23.46 + 0.0054, longitude: -46.64 }, destination: mockDestination }); // ~600 m
      await act(async () => {
        await jest.advanceTimersByTimeAsync(100);
      });
      expect(mockGetDistance).toHaveBeenCalledTimes(2);
    });
  });
});
