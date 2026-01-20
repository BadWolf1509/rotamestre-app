/**
 * Tests for routeGeometry utilities
 */

import {
  calculateDistance,
  pointToSegmentDistance,
  pointToPolylineDistance,
  getOffRouteStatus,
  isValidCoordinate,
  type Coordinate,
} from '../routeGeometry';

describe('routeGeometry', () => {
  describe('calculateDistance', () => {
    it('should return 0 for same coordinates', () => {
      const distance = calculateDistance(-23.5505, -46.6333, -23.5505, -46.6333);

      expect(distance).toBe(0);
    });

    it('should calculate distance between São Paulo and Rio de Janeiro', () => {
      // São Paulo: -23.5505, -46.6333
      // Rio de Janeiro: -22.9068, -43.1729
      const distance = calculateDistance(-23.5505, -46.6333, -22.9068, -43.1729);

      // ~358 km (verified with external calculator)
      expect(distance).toBeGreaterThan(350000);
      expect(distance).toBeLessThan(370000);
    });

    it('should calculate distance for short distances (meters)', () => {
      // Two points ~100m apart
      const distance = calculateDistance(-23.5505, -46.6333, -23.5515, -46.6333);

      expect(distance).toBeGreaterThan(100);
      expect(distance).toBeLessThan(200);
    });

    it('should handle crossing the equator', () => {
      const distance = calculateDistance(1, 0, -1, 0);

      // ~222 km (2 degrees of latitude at equator)
      expect(distance).toBeGreaterThan(220000);
      expect(distance).toBeLessThan(225000);
    });

    it('should handle crossing the prime meridian', () => {
      const distance = calculateDistance(0, 1, 0, -1);

      // ~222 km (2 degrees of longitude at equator)
      expect(distance).toBeGreaterThan(220000);
      expect(distance).toBeLessThan(225000);
    });

    it('should be symmetric', () => {
      const d1 = calculateDistance(-23.5505, -46.6333, -22.9068, -43.1729);
      const d2 = calculateDistance(-22.9068, -43.1729, -23.5505, -46.6333);

      expect(d1).toBeCloseTo(d2, 5);
    });
  });

  describe('pointToSegmentDistance', () => {
    const lineStart: Coordinate = { latitude: -23.55, longitude: -46.63 };
    const lineEnd: Coordinate = { latitude: -23.55, longitude: -46.65 };

    it('should return distance to start for very short segments', () => {
      const shortLineEnd: Coordinate = {
        latitude: lineStart.latitude + 0.000001,
        longitude: lineStart.longitude + 0.000001,
      };
      const point: Coordinate = { latitude: -23.56, longitude: -46.64 };

      const result = pointToSegmentDistance(point, lineStart, shortLineEnd);

      // Should return distance to start point
      const expectedDistance = calculateDistance(
        point.latitude,
        point.longitude,
        lineStart.latitude,
        lineStart.longitude
      );
      expect(result.distance).toBeCloseTo(expectedDistance, -1);
      expect(result.nearestPoint).toEqual(lineStart);
    });

    it('should return distance to nearest point on segment', () => {
      // Point directly above the middle of the segment
      const point: Coordinate = { latitude: -23.54, longitude: -46.64 };

      const result = pointToSegmentDistance(point, lineStart, lineEnd);

      // Should be approximately the distance from the point perpendicular to segment
      expect(result.distance).toBeGreaterThan(0);
      expect(result.nearestPoint.longitude).toBeCloseTo(-46.64, 1);
    });

    it('should return distance to lineEnd when point is past segment end', () => {
      // Point beyond lineEnd
      const point: Coordinate = { latitude: -23.55, longitude: -46.66 };

      const result = pointToSegmentDistance(point, lineStart, lineEnd);

      // Nearest point should be lineEnd
      expect(result.nearestPoint.latitude).toBeCloseTo(lineEnd.latitude, 1);
      expect(result.nearestPoint.longitude).toBeCloseTo(lineEnd.longitude, 1);
    });
  });

  describe('pointToPolylineDistance', () => {
    it('should return Infinity for empty polyline', () => {
      const point: Coordinate = { latitude: -23.55, longitude: -46.64 };

      const result = pointToPolylineDistance(point, []);

      expect(result.distance).toBe(Infinity);
      expect(result.nearestPoint).toEqual(point);
      expect(result.segmentIndex).toBe(-1);
    });

    it('should return distance to single point polyline', () => {
      const point: Coordinate = { latitude: -23.55, longitude: -46.64 };
      const polylinePoint: Coordinate = { latitude: -23.56, longitude: -46.64 };

      const result = pointToPolylineDistance(point, [polylinePoint]);

      const expectedDistance = calculateDistance(
        point.latitude,
        point.longitude,
        polylinePoint.latitude,
        polylinePoint.longitude
      );
      expect(result.distance).toBeCloseTo(expectedDistance, 0);
      expect(result.nearestPoint).toEqual(polylinePoint);
      expect(result.segmentIndex).toBe(0);
    });

    it('should find nearest segment in multi-segment polyline', () => {
      const point: Coordinate = { latitude: -23.55, longitude: -46.64 };
      const polyline: Coordinate[] = [
        { latitude: -23.54, longitude: -46.62 },
        { latitude: -23.54, longitude: -46.64 },
        { latitude: -23.54, longitude: -46.66 },
      ];

      const result = pointToPolylineDistance(point, polyline);

      // Point is closest to segment 0-1 or 1-2 (both pass through -46.64)
      expect(result.distance).toBeGreaterThan(0);
      expect(result.segmentIndex).toBeGreaterThanOrEqual(0);
      expect(result.segmentIndex).toBeLessThan(polyline.length - 1);
    });

    it('should handle point on the polyline', () => {
      const polyline: Coordinate[] = [
        { latitude: -23.55, longitude: -46.62 },
        { latitude: -23.55, longitude: -46.64 },
        { latitude: -23.55, longitude: -46.66 },
      ];
      // Point exactly on the polyline
      const point = polyline[1];

      const result = pointToPolylineDistance(point, polyline);

      expect(result.distance).toBeLessThan(1); // Very close to 0
    });
  });

  describe('getOffRouteStatus', () => {
    const polyline: Coordinate[] = [
      { latitude: -23.55, longitude: -46.62 },
      { latitude: -23.55, longitude: -46.64 },
      { latitude: -23.55, longitude: -46.66 },
    ];

    it('should return on-route for empty polyline', () => {
      const point: Coordinate = { latitude: -23.55, longitude: -46.64 };

      const result = getOffRouteStatus(point, []);

      expect(result.status).toBe('on-route');
      expect(result.distance).toBe(0);
      expect(result.nearestPoint).toBeNull();
    });

    it('should return on-route when point is close to route', () => {
      // Point ~50m from route
      const point: Coordinate = { latitude: -23.5505, longitude: -46.64 };

      const result = getOffRouteStatus(point, polyline, 100, 200);

      expect(result.status).toBe('on-route');
      expect(result.distance).toBeLessThan(100);
    });

    it('should return warning when point is moderately off route', () => {
      // Point ~150m from route
      const point: Coordinate = { latitude: -23.5515, longitude: -46.64 };

      const result = getOffRouteStatus(point, polyline, 100, 200);

      expect(result.status).toBe('warning');
      expect(result.distance).toBeGreaterThanOrEqual(100);
      expect(result.distance).toBeLessThan(200);
    });

    it('should return critical when point is far off route', () => {
      // Point ~300m from route
      const point: Coordinate = { latitude: -23.553, longitude: -46.64 };

      const result = getOffRouteStatus(point, polyline, 100, 200);

      expect(result.status).toBe('critical');
      expect(result.distance).toBeGreaterThanOrEqual(200);
    });

    it('should use default thresholds', () => {
      // Point ~150m from route (between default 100 warning and 200 critical)
      const point: Coordinate = { latitude: -23.5515, longitude: -46.64 };

      const result = getOffRouteStatus(point, polyline);

      expect(result.status).toBe('warning');
    });

    it('should return nearest point', () => {
      const point: Coordinate = { latitude: -23.56, longitude: -46.64 };

      const result = getOffRouteStatus(point, polyline);

      expect(result.nearestPoint).not.toBeNull();
      expect(result.nearestPoint?.latitude).toBeCloseTo(-23.55, 1);
    });
  });

  describe('isValidCoordinate', () => {
    it('should return true for valid coordinates', () => {
      expect(isValidCoordinate({ latitude: 0, longitude: 0 })).toBe(true);
      expect(isValidCoordinate({ latitude: -23.55, longitude: -46.63 })).toBe(true);
      expect(isValidCoordinate({ latitude: 90, longitude: 180 })).toBe(true);
      expect(isValidCoordinate({ latitude: -90, longitude: -180 })).toBe(true);
    });

    it('should return false for latitude out of range', () => {
      expect(isValidCoordinate({ latitude: 91, longitude: 0 })).toBe(false);
      expect(isValidCoordinate({ latitude: -91, longitude: 0 })).toBe(false);
    });

    it('should return false for longitude out of range', () => {
      expect(isValidCoordinate({ latitude: 0, longitude: 181 })).toBe(false);
      expect(isValidCoordinate({ latitude: 0, longitude: -181 })).toBe(false);
    });

    it('should return false for NaN values', () => {
      expect(isValidCoordinate({ latitude: NaN, longitude: 0 })).toBe(false);
      expect(isValidCoordinate({ latitude: 0, longitude: NaN })).toBe(false);
      expect(isValidCoordinate({ latitude: NaN, longitude: NaN })).toBe(false);
    });

    it('should return true for edge cases', () => {
      expect(isValidCoordinate({ latitude: 90, longitude: 0 })).toBe(true);
      expect(isValidCoordinate({ latitude: -90, longitude: 0 })).toBe(true);
      expect(isValidCoordinate({ latitude: 0, longitude: 180 })).toBe(true);
      expect(isValidCoordinate({ latitude: 0, longitude: -180 })).toBe(true);
    });
  });

  describe('distance calculations accuracy', () => {
    it('should match known distance between landmarks', () => {
      // Statute of Liberty: 40.6892, -74.0445
      // Empire State Building: 40.7484, -73.9857
      // Known distance: ~8.5 km
      const distance = calculateDistance(40.6892, -74.0445, 40.7484, -73.9857);

      expect(distance).toBeGreaterThan(8000);
      expect(distance).toBeLessThan(9000);
    });

    it('should handle antipodal points', () => {
      // Points on opposite sides of Earth
      // Maximum distance ~20,037 km (half Earth's circumference)
      const distance = calculateDistance(0, 0, 0, 180);

      expect(distance).toBeGreaterThan(20000000); // ~20,000 km
    });
  });
});
