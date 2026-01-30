/**
 * Tests for OSRM module
 * Focus: Route optimization and waypoint ordering
 */

import {
  calculateHaversineDistance,
  estimateRouteDistance,
  formatDistance,
  formatDuration,
  decodePolyline,
  clearCache,
  getCacheStats,
  getOptimizedDirections,
} from '../osrm';

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('OSRM module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearCache();
  });

  describe('Haversine distance calculations', () => {
    it('should calculate distance between two points', () => {
      // São Paulo to Rio de Janeiro (~360km)
      const distance = calculateHaversineDistance(
        -23.5505, -46.6333,  // São Paulo
        -22.9068, -43.1729   // Rio de Janeiro
      );

      // Should be approximately 358-362 km
      expect(distance).toBeGreaterThan(355000);
      expect(distance).toBeLessThan(365000);
    });

    it('should return 0 for same point', () => {
      const distance = calculateHaversineDistance(
        -23.5505, -46.6333,
        -23.5505, -46.6333
      );

      expect(distance).toBe(0);
    });

    it('should handle negative coordinates', () => {
      const distance = calculateHaversineDistance(
        -7.1195, -34.8450,
        -7.2200, -34.8800
      );

      expect(distance).toBeGreaterThan(0);
    });
  });

  describe('Route distance estimation', () => {
    it('should estimate route distance with urban correction', () => {
      const result = estimateRouteDistance(
        { latitude: -23.5505, longitude: -46.6333 },
        { latitude: -23.5605, longitude: -46.6433 }
      );

      expect(result.distance).toBeGreaterThan(0);
      expect(result.duration).toBeGreaterThan(0);
      // Urban correction factor is 1.3x
      const haversine = calculateHaversineDistance(
        -23.5505, -46.6333,
        -23.5605, -46.6433
      );
      expect(result.distance).toBeGreaterThanOrEqual(Math.round(haversine * 1.3));
    });
  });

  describe('Distance formatting', () => {
    it('should format meters correctly', () => {
      expect(formatDistance(500)).toBe('500m');
      expect(formatDistance(999)).toBe('999m');
    });

    it('should format kilometers correctly', () => {
      expect(formatDistance(1000)).toBe('1.0km');
      expect(formatDistance(1500)).toBe('1.5km');
      expect(formatDistance(10000)).toBe('10.0km');
    });
  });

  describe('Duration formatting', () => {
    it('should format short durations correctly', () => {
      expect(formatDuration(30)).toBe('menos de 1 min');
      expect(formatDuration(59)).toBe('menos de 1 min');
    });

    it('should format minutes correctly', () => {
      expect(formatDuration(60)).toBe('1 min');
      expect(formatDuration(120)).toBe('2 min');
      expect(formatDuration(90)).toBe('2 min'); // Rounds to 2 min
    });

    it('should format hours correctly', () => {
      expect(formatDuration(3600)).toBe('1h');
      expect(formatDuration(3660)).toBe('1h 1min');
      expect(formatDuration(7200)).toBe('2h');
      expect(formatDuration(5400)).toBe('1h 30min');
    });
  });

  describe('Polyline decoding', () => {
    it('should decode a valid polyline', () => {
      // Simple test polyline
      const encoded = '_p~iF~ps|U_ulLnnqC_mqNvxq`@';
      const decoded = decodePolyline(encoded);

      expect(decoded.length).toBeGreaterThan(0);
      decoded.forEach(point => {
        expect(point).toHaveProperty('latitude');
        expect(point).toHaveProperty('longitude');
        expect(typeof point.latitude).toBe('number');
        expect(typeof point.longitude).toBe('number');
      });
    });

    it('should handle empty polyline', () => {
      const decoded = decodePolyline('');
      expect(decoded).toEqual([]);
    });
  });

  describe('Cache operations', () => {
    it('should start with empty cache', () => {
      const stats = getCacheStats();
      expect(stats.size).toBe(0);
      expect(stats.oldestEntry).toBeNull();
    });

    it('should clear cache', () => {
      clearCache();
      const stats = getCacheStats();
      expect(stats.size).toBe(0);
    });
  });

  describe('Route optimization (Trip API)', () => {
    it('should extract correct waypoint order from Trip API response', async () => {
      // Mock OSRM Trip API response
      // Scenario: Input order is [origin, A, B, C], optimized order is [origin, B, A, C]
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          code: 'Ok',
          trips: [{
            geometry: 'encoded_polyline',
            distance: 10000,
            duration: 1200,
            legs: [
              { distance: 2000, duration: 300 },
              { distance: 3000, duration: 400 },
              { distance: 2500, duration: 250 },
              { distance: 2500, duration: 250 }, // Return to origin
            ],
          }],
          waypoints: [
            { location: [0, 0], waypoint_index: 0 },  // Origin: visited 1st
            { location: [1, 1], waypoint_index: 2 },  // A: visited 3rd
            { location: [2, 2], waypoint_index: 1 },  // B: visited 2nd
            { location: [3, 3], waypoint_index: 3 },  // C: visited 4th
          ],
        }),
      });

      const result = await getOptimizedDirections(
        { latitude: 0, longitude: 0 },  // Origin
        { latitude: 0, longitude: 0 },  // Destination = Origin (circular)
        [
          { latitude: 1, longitude: 1 },  // A
          { latitude: 2, longitude: 2 },  // B
          { latitude: 3, longitude: 3 },  // C
        ],
        true  // optimize
      );

      expect(result).not.toBeNull();
      // The optimized order should be [1, 0, 2] (B first, then A, then C)
      // Because B has waypoint_index=1, A has waypoint_index=2, C has waypoint_index=3
      expect(result?.ordem_otimizada).toEqual([1, 0, 2]);
    });

    it('should use Haversine fallback when OSRM fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          code: 'NoRoute',
          trips: [],
        }),
      });

      const result = await getOptimizedDirections(
        { latitude: 0, longitude: 0 },
        { latitude: 1, longitude: 1 },
        [],
        false
      );

      // Should return Haversine fallback
      expect(result).not.toBeNull();
      expect(result?.distancia_total_metros).toBeGreaterThan(0);
    });

    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await getOptimizedDirections(
        { latitude: 0, longitude: 0 },
        { latitude: 1, longitude: 1 },
        [],
        false
      );

      // Should return Haversine fallback
      expect(result).not.toBeNull();
    });

    it('should use Route API for non-circular routes', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          code: 'Ok',
          routes: [{
            geometry: 'encoded_polyline',
            distance: 5000,
            duration: 600,
            legs: [
              { distance: 2500, duration: 300 },
              { distance: 2500, duration: 300 },
            ],
          }],
          waypoints: [
            { location: [0, 0], waypoint_index: 0 },
            { location: [1, 1], waypoint_index: 1 },
            { location: [2, 2], waypoint_index: 2 },
          ],
        }),
      });

      const result = await getOptimizedDirections(
        { latitude: 0, longitude: 0 },  // Origin
        { latitude: 2, longitude: 2 },  // Destination (different from origin)
        [
          { latitude: 1, longitude: 1 },  // Waypoint
        ],
        false  // no optimization
      );

      expect(result).not.toBeNull();
      expect(result?.distancia_total_metros).toBe(5000);
      expect(result?.duracao_total_segundos).toBe(600);
      expect(result?.legs).toHaveLength(2);

      // Should have used Route API
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/route/v1/driving'),
        expect.any(Object)
      );
    });

    it('should maintain waypoint order for non-optimized routes', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          code: 'Ok',
          routes: [{
            geometry: 'encoded_polyline',
            distance: 9000,
            duration: 1200,
            legs: [
              { distance: 3000, duration: 400 },
              { distance: 3000, duration: 400 },
              { distance: 3000, duration: 400 },
            ],
          }],
          waypoints: [
            { location: [0, 0], waypoint_index: 0 },
            { location: [1, 1], waypoint_index: 1 },
            { location: [2, 2], waypoint_index: 2 },
            { location: [3, 3], waypoint_index: 3 },
          ],
        }),
      });

      const result = await getOptimizedDirections(
        { latitude: 0, longitude: 0 },
        { latitude: 3, longitude: 3 },
        [
          { latitude: 1, longitude: 1 },
          { latitude: 2, longitude: 2 },
        ],
        false  // no optimization - maintain order
      );

      expect(result).not.toBeNull();
      // Order should be preserved: [0, 1] (first waypoint, then second)
      expect(result?.ordem_otimizada).toEqual([0, 1]);
    });
  });

  describe('Edge cases', () => {
    it('should handle single waypoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          code: 'Ok',
          routes: [{
            geometry: 'encoded_polyline',
            distance: 5000,
            duration: 600,
            legs: [
              { distance: 2500, duration: 300 },
              { distance: 2500, duration: 300 },
            ],
          }],
          waypoints: [
            { location: [0, 0], waypoint_index: 0 },
            { location: [1, 1], waypoint_index: 1 },
            { location: [2, 2], waypoint_index: 2 },
          ],
        }),
      });

      const result = await getOptimizedDirections(
        { latitude: 0, longitude: 0 },
        { latitude: 2, longitude: 2 },
        [{ latitude: 1, longitude: 1 }],
        false
      );

      expect(result).not.toBeNull();
      expect(result?.ordem_otimizada).toEqual([0]);
    });

    it('should handle no waypoints', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          code: 'Ok',
          routes: [{
            geometry: 'encoded_polyline',
            distance: 5000,
            duration: 600,
            legs: [
              { distance: 5000, duration: 600 },
            ],
          }],
          waypoints: [
            { location: [0, 0], waypoint_index: 0 },
            { location: [1, 1], waypoint_index: 1 },
          ],
        }),
      });

      const result = await getOptimizedDirections(
        { latitude: 0, longitude: 0 },
        { latitude: 1, longitude: 1 },
        [],
        false
      );

      expect(result).not.toBeNull();
      expect(result?.ordem_otimizada).toEqual([]);
    });

    it('should handle undefined waypoints', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          code: 'Ok',
          routes: [{
            geometry: 'encoded_polyline',
            distance: 5000,
            duration: 600,
            legs: [
              { distance: 5000, duration: 600 },
            ],
          }],
          waypoints: [
            { location: [0, 0], waypoint_index: 0 },
            { location: [1, 1], waypoint_index: 1 },
          ],
        }),
      });

      const result = await getOptimizedDirections(
        { latitude: 0, longitude: 0 },
        { latitude: 1, longitude: 1 },
        undefined,
        false
      );

      expect(result).not.toBeNull();
      expect(result?.ordem_otimizada).toEqual([]);
    });
  });
});
