import { renderHook } from '@testing-library/react-native';

import { useRouteDirections } from '@/hooks/useRouteDirections';

import { useRouteShape } from '../useRouteShape';

jest.mock('@/hooks/useRouteDirections', () => ({
  useRouteDirections: jest.fn(),
}));

jest.mock('@/lib/maplibre', () => ({
  toLineString: jest.fn((coords) => ({
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: coords },
  })),
}));

describe('useRouteShape', () => {
  it('returns null routeShape when less than 2 coordinates', () => {
    (useRouteDirections as jest.Mock).mockReturnValue({
      routeCoordinates: [{ latitude: -23.55, longitude: -46.63 }],
      routeInfo: undefined,
      isLoading: false,
    });

    const { result } = renderHook(() => useRouteShape([] as any));
    expect(result.current.routeShape).toBeNull();
    expect(result.current.isLoadingRoute).toBe(false);
  });

  it('returns routeShape when 2+ coordinates', () => {
    const coords = [
      { latitude: -23.55, longitude: -46.63 },
      { latitude: -23.56, longitude: -46.64 },
    ];
    (useRouteDirections as jest.Mock).mockReturnValue({
      routeCoordinates: coords,
      routeInfo: { distanceMeters: 1000, durationSeconds: 120 },
      isLoading: false,
    });

    const { result } = renderHook(() => useRouteShape([] as any));
    expect(result.current.routeShape).not.toBeNull();
    expect(result.current.routeInfo).toEqual({
      distanceMeters: 1000,
      durationSeconds: 120,
    });
  });

  it('passes isLoading through', () => {
    (useRouteDirections as jest.Mock).mockReturnValue({
      routeCoordinates: [],
      routeInfo: undefined,
      isLoading: true,
    });

    const { result } = renderHook(() => useRouteShape([] as any));
    expect(result.current.isLoadingRoute).toBe(true);
  });

  it('forwards persisted route options and retry/error state', () => {
    const refetch = jest.fn();
    (useRouteDirections as jest.Mock).mockReturnValue({
      routeCoordinates: [],
      routeInfo: null,
      isLoading: false,
      error: 'Trajeto viário indisponível',
      refetch,
      source: null,
      isStale: false,
    });
    const options = {
      encodedPolyline: 'encoded-road-geometry',
      storedRouteInfo: { distanceMeters: 1000, durationSeconds: 120 },
    };

    const { result } = renderHook(() => useRouteShape([] as any, options));

    expect(useRouteDirections).toHaveBeenCalledWith([], options);
    expect(result.current.routeError).toBe('Trajeto viário indisponível');
    expect(result.current.refetchRoute).toBe(refetch);
  });
});
