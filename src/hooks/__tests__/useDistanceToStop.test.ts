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
});
