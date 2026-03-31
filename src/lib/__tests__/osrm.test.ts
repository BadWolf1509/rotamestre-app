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
} from "../osrm";

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("OSRM module", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearCache();
  });

  describe("Haversine distance calculations", () => {
    it("should calculate distance between two points", () => {
      // São Paulo to Rio de Janeiro (~360km)
      const distance = calculateHaversineDistance(
        -23.5505,
        -46.6333, // São Paulo
        -22.9068,
        -43.1729, // Rio de Janeiro
      );

      // Should be approximately 358-362 km
      expect(distance).toBeGreaterThan(355000);
      expect(distance).toBeLessThan(365000);
    });

    it("should return 0 for same point", () => {
      const distance = calculateHaversineDistance(
        -23.5505,
        -46.6333,
        -23.5505,
        -46.6333,
      );

      expect(distance).toBe(0);
    });

    it("should handle negative coordinates", () => {
      const distance = calculateHaversineDistance(
        -7.1195,
        -34.845,
        -7.22,
        -34.88,
      );

      expect(distance).toBeGreaterThan(0);
    });
  });

  describe("Route distance estimation", () => {
    it("should estimate route distance with urban correction", () => {
      const result = estimateRouteDistance(
        { latitude: -23.5505, longitude: -46.6333 },
        { latitude: -23.5605, longitude: -46.6433 },
      );

      expect(result.distance).toBeGreaterThan(0);
      expect(result.duration).toBeGreaterThan(0);
      // Urban correction factor is 1.3x
      const haversine = calculateHaversineDistance(
        -23.5505,
        -46.6333,
        -23.5605,
        -46.6433,
      );
      expect(result.distance).toBeGreaterThanOrEqual(
        Math.round(haversine * 1.3),
      );
    });
  });

  describe("Distance formatting", () => {
    it("should format meters correctly", () => {
      expect(formatDistance(500)).toBe("500m");
      expect(formatDistance(999)).toBe("999m");
    });

    it("should format kilometers correctly", () => {
      expect(formatDistance(1000)).toBe("1.0km");
      expect(formatDistance(1500)).toBe("1.5km");
      expect(formatDistance(10000)).toBe("10.0km");
    });
  });

  describe("Duration formatting", () => {
    it("should format short durations correctly", () => {
      expect(formatDuration(30)).toBe("menos de 1 min");
      expect(formatDuration(59)).toBe("menos de 1 min");
    });

    it("should format minutes correctly", () => {
      expect(formatDuration(60)).toBe("1 min");
      expect(formatDuration(120)).toBe("2 min");
      expect(formatDuration(90)).toBe("2 min"); // Rounds to 2 min
    });

    it("should format hours correctly", () => {
      expect(formatDuration(3600)).toBe("1h");
      expect(formatDuration(3660)).toBe("1h 1min");
      expect(formatDuration(7200)).toBe("2h");
      expect(formatDuration(5400)).toBe("1h 30min");
    });
  });

  describe("Polyline decoding", () => {
    it("should decode a valid polyline", () => {
      // Simple test polyline
      const encoded = "_p~iF~ps|U_ulLnnqC_mqNvxq`@";
      const decoded = decodePolyline(encoded);

      expect(decoded.length).toBeGreaterThan(0);
      decoded.forEach((point) => {
        expect(point).toHaveProperty("latitude");
        expect(point).toHaveProperty("longitude");
        expect(typeof point.latitude).toBe("number");
        expect(typeof point.longitude).toBe("number");
      });
    });

    it("should handle empty polyline", () => {
      const decoded = decodePolyline("");
      expect(decoded).toEqual([]);
    });
  });

  describe("Cache operations", () => {
    it("should start with empty cache", () => {
      const stats = getCacheStats();
      expect(stats.size).toBe(0);
      expect(stats.oldestEntry).toBeNull();
    });

    it("should clear cache", () => {
      clearCache();
      const stats = getCacheStats();
      expect(stats.size).toBe(0);
    });
  });

  describe("Route optimization (Table + TSP + Route)", () => {
    it("should optimize circular route using Table API + TSP + Route API", async () => {
      // Mock 1: Table API returns distance matrix
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          code: "Ok",
          distances: [
            [0, 20000, 10000, 14000],
            [20000, 0, 25000, 12000],
            [10000, 25000, 0, 8000],
            [14000, 12000, 8000, 0],
          ],
          durations: [
            [0, 2400, 1200, 1680],
            [2400, 0, 3000, 1440],
            [1200, 3000, 0, 960],
            [1680, 1440, 960, 0],
          ],
          sources: [
            { location: [0, 0] },
            { location: [1, 1] },
            { location: [2, 2] },
            { location: [3, 3] },
          ],
          destinations: [
            { location: [0, 0] },
            { location: [1, 1] },
            { location: [2, 2] },
            { location: [3, 3] },
          ],
        }),
      });

      // Mock 2: Route API returns the actual route for the optimized order
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          code: "Ok",
          routes: [
            {
              geometry: "optimized_polyline",
              distance: 42000,
              duration: 5040,
              legs: [
                { distance: 10000, duration: 1200 },
                { distance: 8000, duration: 960 },
                { distance: 12000, duration: 1440 },
                { distance: 12000, duration: 1440 },
              ],
            },
          ],
          waypoints: [
            { location: [0, 0], waypoint_index: 0 },
            { location: [2, 2], waypoint_index: 1 },
            { location: [3, 3], waypoint_index: 2 },
            { location: [1, 1], waypoint_index: 3 },
            { location: [0, 0], waypoint_index: 4 },
          ],
        }),
      });

      const result = await getOptimizedDirections(
        { latitude: 0, longitude: 0 },
        { latitude: 0, longitude: 0 },
        [
          { latitude: 1, longitude: 1 }, // A (far, idx 0)
          { latitude: 2, longitude: 2 }, // B (close, idx 1)
          { latitude: 3, longitude: 3 }, // C (medium, idx 2)
        ],
        true,
      );

      expect(result).not.toBeNull();
      // TSP optimal (two tied routes at 50000):
      //   O→A→C→B→O = 20000+12000+8000+10000 = 50000 → [0, 2, 1]
      //   O→B→C→A→O = 10000+8000+12000+20000 = 50000 → [1, 2, 0]
      // Brute-force (Heap's algorithm) finds [0, 2, 1] first
      expect(result?.ordem_otimizada).toEqual([0, 2, 1]);

      // Verify Table API was called first, Route API second
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch.mock.calls[0][0]).toContain("/table/v1/driving/");
      expect(mockFetch.mock.calls[1][0]).toContain("/route/v1/driving/");
    });

    it("should use Haversine TSP when Table API fails for circular route", async () => {
      // Mock 1: Table API fails
      mockFetch.mockRejectedValueOnce(new Error("AbortError"));

      // Mock 2: Route API returns actual route for the Haversine-optimized order
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          code: "Ok",
          routes: [
            {
              geometry: "haversine_optimized_polyline",
              distance: 35000,
              duration: 4200,
              legs: [
                { distance: 8000, duration: 960 },
                { distance: 7000, duration: 840 },
                { distance: 10000, duration: 1200 },
                { distance: 10000, duration: 1200 },
              ],
            },
          ],
          waypoints: [
            { location: [-34.87, -7.12], waypoint_index: 0 },
            { location: [-34.85, -7.14], waypoint_index: 1 },
            { location: [-34.84, -7.13], waypoint_index: 2 },
            { location: [-34.86, -7.15], waypoint_index: 3 },
            { location: [-34.87, -7.12], waypoint_index: 4 },
          ],
        }),
      });

      const result = await getOptimizedDirections(
        { latitude: -7.12, longitude: -34.87 }, // Origin (same as destination = circular)
        { latitude: -7.12, longitude: -34.87 },
        [
          { latitude: -7.15, longitude: -34.86 }, // A (far)
          { latitude: -7.14, longitude: -34.85 }, // B (close)
          { latitude: -7.13, longitude: -34.84 }, // C (medium)
        ],
        true,
      );

      expect(result).not.toBeNull();
      // Even though Table API failed, TSP ran on Haversine distances
      // Route API should have been called with optimized order
      expect(result?.distancia_total_metros).toBe(35000);
      expect(result?.ordem_otimizada).toBeDefined();
      // Verify Table API was attempted, then Route API was called
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch.mock.calls[0][0]).toContain("/table/v1/driving/");
      expect(mockFetch.mock.calls[1][0]).toContain("/route/v1/driving/");
    });

    it("should use Haversine fallback when OSRM fails", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          code: "NoRoute",
          trips: [],
        }),
      });

      const result = await getOptimizedDirections(
        { latitude: 0, longitude: 0 },
        { latitude: 1, longitude: 1 },
        [],
        false,
      );

      // Should return Haversine fallback
      expect(result).not.toBeNull();
      expect(result?.distancia_total_metros).toBeGreaterThan(0);
    });

    it("should handle network errors gracefully", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await getOptimizedDirections(
        { latitude: 0, longitude: 0 },
        { latitude: 1, longitude: 1 },
        [],
        false,
      );

      // Should return Haversine fallback
      expect(result).not.toBeNull();
    });

    it("should use Route API for non-circular routes", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          code: "Ok",
          routes: [
            {
              geometry: "encoded_polyline",
              distance: 5000,
              duration: 600,
              legs: [
                { distance: 2500, duration: 300 },
                { distance: 2500, duration: 300 },
              ],
            },
          ],
          waypoints: [
            { location: [0, 0], waypoint_index: 0 },
            { location: [1, 1], waypoint_index: 1 },
            { location: [2, 2], waypoint_index: 2 },
          ],
        }),
      });

      const result = await getOptimizedDirections(
        { latitude: 0, longitude: 0 }, // Origin
        { latitude: 2, longitude: 2 }, // Destination (different from origin)
        [
          { latitude: 1, longitude: 1 }, // Waypoint
        ],
        false, // no optimization
      );

      expect(result).not.toBeNull();
      expect(result?.distancia_total_metros).toBe(5000);
      expect(result?.duracao_total_segundos).toBe(600);
      expect(result?.legs).toHaveLength(2);

      // Should have used Route API
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/route/v1/driving"),
        expect.any(Object),
      );
    });

    it("should maintain waypoint order for non-optimized routes", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          code: "Ok",
          routes: [
            {
              geometry: "encoded_polyline",
              distance: 9000,
              duration: 1200,
              legs: [
                { distance: 3000, duration: 400 },
                { distance: 3000, duration: 400 },
                { distance: 3000, duration: 400 },
              ],
            },
          ],
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
        false, // no optimization - maintain order
      );

      expect(result).not.toBeNull();
      // Order should be preserved: [0, 1] (first waypoint, then second)
      expect(result?.ordem_otimizada).toEqual([0, 1]);
    });

    it("should fall back to Haversine when Table API fails for circular route", async () => {
      // Table API fails
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await getOptimizedDirections(
        { latitude: -7.1, longitude: -34.8 },
        { latitude: -7.1, longitude: -34.8 }, // circular
        [
          { latitude: -7.2, longitude: -34.9 },
          { latitude: -7.15, longitude: -34.85 },
        ],
        true,
      );

      // Should return Haversine fallback, not null
      expect(result).not.toBeNull();
      expect(result!.distancia_total_metros).toBeGreaterThan(0);
      expect(result!.ordem_otimizada).toEqual([0, 1]); // default order
    });

    it("should fall back when Route API fails after successful Table", async () => {
      // Table API succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          code: "Ok",
          distances: [
            [0, 1000],
            [1000, 0],
          ],
          durations: [
            [0, 120],
            [120, 0],
          ],
          sources: [{ location: [0, 0] }, { location: [1, 1] }],
          destinations: [{ location: [0, 0] }, { location: [1, 1] }],
        }),
      });

      // Route API fails
      mockFetch.mockRejectedValueOnce(new Error("Route API down"));

      const result = await getOptimizedDirections(
        { latitude: 0, longitude: 0 },
        { latitude: 0, longitude: 0 },
        [{ latitude: 1, longitude: 1 }],
        true,
      );

      // Should return Haversine fallback
      expect(result).not.toBeNull();
      expect(result!.distancia_total_metros).toBeGreaterThan(0);
    });

    it("should optimize single waypoint via Table+Route", async () => {
      // Table API
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          code: "Ok",
          distances: [
            [0, 5000],
            [5000, 0],
          ],
          durations: [
            [0, 600],
            [600, 0],
          ],
          sources: [{ location: [0, 0] }, { location: [1, 1] }],
          destinations: [{ location: [0, 0] }, { location: [1, 1] }],
        }),
      });

      // Route API
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          code: "Ok",
          routes: [
            {
              geometry: "polyline",
              distance: 10000,
              duration: 1200,
              legs: [
                { distance: 5000, duration: 600 },
                { distance: 5000, duration: 600 },
              ],
            },
          ],
          waypoints: [
            { location: [0, 0], waypoint_index: 0 },
            { location: [1, 1], waypoint_index: 1 },
            { location: [0, 0], waypoint_index: 2 },
          ],
        }),
      });

      const result = await getOptimizedDirections(
        { latitude: 0, longitude: 0 },
        { latitude: 0, longitude: 0 },
        [{ latitude: 1, longitude: 1 }],
        true,
      );

      expect(result).not.toBeNull();
      expect(result!.ordem_otimizada).toEqual([0]);
      expect(result!.distancia_total_metros).toBe(10000);
    });
  });

  describe("Edge cases", () => {
    it("should handle single waypoint", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          code: "Ok",
          routes: [
            {
              geometry: "encoded_polyline",
              distance: 5000,
              duration: 600,
              legs: [
                { distance: 2500, duration: 300 },
                { distance: 2500, duration: 300 },
              ],
            },
          ],
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
        false,
      );

      expect(result).not.toBeNull();
      expect(result?.ordem_otimizada).toEqual([0]);
    });

    it("should handle no waypoints", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          code: "Ok",
          routes: [
            {
              geometry: "encoded_polyline",
              distance: 5000,
              duration: 600,
              legs: [{ distance: 5000, duration: 600 }],
            },
          ],
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
        false,
      );

      expect(result).not.toBeNull();
      expect(result?.ordem_otimizada).toEqual([]);
    });

    it("should handle undefined waypoints", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          code: "Ok",
          routes: [
            {
              geometry: "encoded_polyline",
              distance: 5000,
              duration: 600,
              legs: [{ distance: 5000, duration: 600 }],
            },
          ],
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
        false,
      );

      expect(result).not.toBeNull();
      expect(result?.ordem_otimizada).toEqual([]);
    });
  });
});
