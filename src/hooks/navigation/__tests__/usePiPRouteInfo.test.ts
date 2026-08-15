/**
 * Tests for usePiPRouteInfo hook and calculateDistanceKm utility
 */

import { renderHook, waitFor } from '@testing-library/react-native';

// Mock OSRM module before importing
jest.mock('@/lib/osrm', () => ({
  getRoute: jest.fn(),
  decodePolyline: jest.fn((polyline: string) => {
    // Simple mock that returns 3 points for any non-empty polyline
    if (!polyline) return [];
    return [
      { latitude: -23.55, longitude: -46.63 },
      { latitude: -23.555, longitude: -46.635 },
      { latitude: -23.56, longitude: -46.64 },
    ];
  }),
}));

import { getRoute } from '@/lib/osrm';

import { calculateDistanceKm, usePiPRouteInfo } from '../pip/usePiPRouteInfo';

const mockGetRoute = getRoute as jest.MockedFunction<typeof getRoute>;

describe('calculateDistanceKm', () => {
  it('should return 0 for same coordinates', () => {
    expect(calculateDistanceKm(-23.55, -46.63, -23.55, -46.63)).toBe(0);
  });

  it('should calculate distance between two points', () => {
    // São Paulo (-23.55, -46.63) to Rio de Janeiro (-22.91, -43.17)
    // Approximate distance: ~360 km
    const distance = calculateDistanceKm(-23.55, -46.63, -22.91, -43.17);
    expect(distance).toBeGreaterThan(350);
    expect(distance).toBeLessThan(400);
  });

  it('should calculate short distances accurately', () => {
    // Two points ~1km apart in São Paulo
    const distance = calculateDistanceKm(-23.55, -46.63, -23.559, -46.63);
    expect(distance).toBeGreaterThan(0.9);
    expect(distance).toBeLessThan(1.1);
  });

  it('should handle negative and positive coordinates', () => {
    // NY to London
    const distance = calculateDistanceKm(40.71, -74.01, 51.51, -0.13);
    expect(distance).toBeGreaterThan(5500);
    expect(distance).toBeLessThan(5600);
  });

  it('should be symmetric (same distance both ways)', () => {
    const d1 = calculateDistanceKm(-23.55, -46.63, -22.91, -43.17);
    const d2 = calculateDistanceKm(-22.91, -43.17, -23.55, -46.63);
    expect(Math.abs(d1 - d2)).toBeLessThan(0.001);
  });
});

describe('usePiPRouteInfo', () => {
  const mockDestination = {
    latitude: -23.56,
    longitude: -46.64,
  };

  const mockUserLocation = {
    latitude: -23.55,
    longitude: -46.63,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetRoute.mockReset();
  });

  describe('when not visible', () => {
    it('should still calculate routeInfo using Haversine but not fetch OSRM', async () => {
      const { result } = renderHook(() =>
        usePiPRouteInfo({
          visible: false,
          userLocation: mockUserLocation,
          destination: mockDestination,
        }),
      );

      // routeInfo is calculated regardless of visibility (uses Haversine)
      expect(result.current.routeInfo).not.toBeNull();
      expect(result.current.routeInfo?.distanceKm).toBeGreaterThan(0);

      // But OSRM should NOT be fetched when not visible
      expect(result.current.isLoadingRoute).toBe(false);
      expect(result.current.routePath).toEqual([]);
      expect(mockGetRoute).not.toHaveBeenCalled();
    });
  });

  describe('when visible without user location', () => {
    it('should not calculate route info without user location', async () => {
      const { result } = renderHook(() =>
        usePiPRouteInfo({
          visible: true,
          userLocation: null,
          destination: mockDestination,
        }),
      );

      expect(result.current.routeInfo).toBeNull();
      expect(mockGetRoute).not.toHaveBeenCalled();
    });

    it('should not calculate route info without destination', async () => {
      const { result } = renderHook(() =>
        usePiPRouteInfo({
          visible: true,
          userLocation: mockUserLocation,
          destination: null,
        }),
      );

      expect(result.current.routeInfo).toBeNull();
      expect(mockGetRoute).not.toHaveBeenCalled();
    });
  });

  describe('when visible with user location and destination', () => {
    it('should calculate route info using Haversine formula', async () => {
      mockGetRoute.mockResolvedValueOnce({
        distance: 5000,
        duration: 600,
        polyline: 'encoded_polyline',
        steps: [],
      });

      const { result } = renderHook(() =>
        usePiPRouteInfo({
          visible: true,
          userLocation: mockUserLocation,
          destination: mockDestination,
        }),
      );

      // routeInfo uses Haversine, not OSRM
      expect(result.current.routeInfo).not.toBeNull();
      // Distance should be small (both points are close in São Paulo)
      expect(result.current.routeInfo?.distanceKm).toBeLessThan(5);
      expect(result.current.routeInfo?.distanceKm).toBeGreaterThan(0);

      // ETA is estimated using AVERAGE_URBAN_SPEED_KMH (30 km/h)
      expect(result.current.routeInfo?.estimatedMinutes).toBeGreaterThan(0);
    });

    it('should fetch OSRM route for routePath when visible', async () => {
      mockGetRoute.mockResolvedValueOnce({
        distance: 5000,
        duration: 600,
        polyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@',
        steps: [],
      });

      const { result } = renderHook(() =>
        usePiPRouteInfo({
          visible: true,
          userLocation: mockUserLocation,
          destination: mockDestination,
        }),
      );

      await waitFor(() => {
        expect(result.current.isLoadingRoute).toBe(false);
      });

      // OSRM should have been called
      expect(mockGetRoute).toHaveBeenCalledWith(
        {
          latitude: mockUserLocation.latitude,
          longitude: mockUserLocation.longitude,
        },
        {
          latitude: mockDestination.latitude,
          longitude: mockDestination.longitude,
        },
      );

      // routePath should be populated from decoded polyline
      expect(result.current.routePath.length).toBeGreaterThan(0);
    });

    it('should not draw a misleading line when OSRM fails', async () => {
      mockGetRoute.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() =>
        usePiPRouteInfo({
          visible: true,
          userLocation: mockUserLocation,
          destination: mockDestination,
        }),
      );

      await waitFor(() => {
        expect(result.current.isLoadingRoute).toBe(false);
      });

      // routeInfo should still work (uses Haversine, not OSRM)
      expect(result.current.routeInfo).not.toBeNull();

      expect(result.current.routePath).toEqual([]);
    });

    it('should keep route empty when OSRM returns null', async () => {
      mockGetRoute.mockResolvedValueOnce(null);

      const { result } = renderHook(() =>
        usePiPRouteInfo({
          visible: true,
          userLocation: mockUserLocation,
          destination: mockDestination,
        }),
      );

      await waitFor(() => {
        expect(result.current.isLoadingRoute).toBe(false);
      });

      expect(result.current.routePath).toEqual([]);
    });
  });

  describe('isNearDestination', () => {
    it('should be true when distance < 0.1km (100m)', async () => {
      // Very close destination (< 100m)
      const closeDestination = {
        latitude: -23.5501,
        longitude: -46.6301,
      };

      const { result } = renderHook(() =>
        usePiPRouteInfo({
          visible: true,
          userLocation: mockUserLocation,
          destination: closeDestination,
        }),
      );

      // Distance is calculated via Haversine
      expect(result.current.routeInfo?.distanceKm).toBeLessThan(0.1);
      expect(result.current.isNearDestination).toBe(true);
    });

    it('should be false when distance >= 0.1km', async () => {
      // mockDestination is > 100m away
      const { result } = renderHook(() =>
        usePiPRouteInfo({
          visible: true,
          userLocation: mockUserLocation,
          destination: mockDestination,
        }),
      );

      // Distance should be >= 0.1km
      expect(result.current.routeInfo?.distanceKm).toBeGreaterThanOrEqual(0.1);
      expect(result.current.isNearDestination).toBe(false);
    });
  });

  describe('routeInfo formatting', () => {
    it('should format distance in meters when < 1km', () => {
      const closeDestination = {
        latitude: -23.555,
        longitude: -46.635,
      };

      const { result } = renderHook(() =>
        usePiPRouteInfo({
          visible: true,
          userLocation: mockUserLocation,
          destination: closeDestination,
        }),
      );

      // Should be formatted as meters
      expect(result.current.routeInfo?.distanceText).toMatch(/\d+ m$/);
    });

    it('should format distance in km when >= 1km', () => {
      // Destination ~5km away
      const farDestination = {
        latitude: -23.6,
        longitude: -46.68,
      };

      const { result } = renderHook(() =>
        usePiPRouteInfo({
          visible: true,
          userLocation: mockUserLocation,
          destination: farDestination,
        }),
      );

      // Should be formatted as km
      expect(result.current.routeInfo?.distanceText).toMatch(/\d+,\d km$/);
    });

    it('should format time in minutes when < 60min', () => {
      const { result } = renderHook(() =>
        usePiPRouteInfo({
          visible: true,
          userLocation: mockUserLocation,
          destination: mockDestination,
        }),
      );

      // Short distance should have short time
      expect(result.current.routeInfo?.timeText).toMatch(/\d+ min$/);
    });
  });
});
