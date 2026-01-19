/**
 * Route Geometry Utilities
 *
 * Functions for calculating distances from points to polylines,
 * detecting off-route conditions, and geometric operations.
 */

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export type OffRouteStatus = 'on-route' | 'warning' | 'critical';

interface PointToPolylineResult {
  distance: number;
  nearestPoint: Coordinate;
  segmentIndex: number;
}

interface OffRouteResult {
  status: OffRouteStatus;
  distance: number;
  nearestPoint: Coordinate | null;
}

// Earth radius in meters
const EARTH_RADIUS = 6371000;

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Convert radians to degrees
 */
function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in meters
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const deltaPhi = toRadians(lat2 - lat1);
  const deltaLambda = toRadians(lon2 - lon1);

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS * c;
}

/**
 * Calculate cross-track distance from a point to a great-circle path
 * This gives the perpendicular distance from the point to the line
 *
 * @param point - The point to check
 * @param lineStart - Start of the line segment
 * @param lineEnd - End of the line segment
 * @returns Distance in meters (can be negative for left/right of track)
 */
function crossTrackDistance(
  point: Coordinate,
  lineStart: Coordinate,
  lineEnd: Coordinate
): number {
  const d13 = calculateDistance(
    lineStart.latitude,
    lineStart.longitude,
    point.latitude,
    point.longitude
  ) / EARTH_RADIUS;

  const theta13 = toRadians(
    bearing(lineStart, point)
  );
  const theta12 = toRadians(
    bearing(lineStart, lineEnd)
  );

  const dxt = Math.asin(Math.sin(d13) * Math.sin(theta13 - theta12)) * EARTH_RADIUS;

  return Math.abs(dxt);
}

/**
 * Calculate along-track distance - how far along the path the closest point is
 *
 * @param point - The point to check
 * @param lineStart - Start of the line segment
 * @param lineEnd - End of the line segment
 * @returns Distance in meters along the path from lineStart
 */
function alongTrackDistance(
  point: Coordinate,
  lineStart: Coordinate,
  lineEnd: Coordinate
): number {
  const d13 = calculateDistance(
    lineStart.latitude,
    lineStart.longitude,
    point.latitude,
    point.longitude
  ) / EARTH_RADIUS;

  const dxt = crossTrackDistance(point, lineStart, lineEnd) / EARTH_RADIUS;
  const dat = Math.acos(Math.cos(d13) / Math.cos(dxt)) * EARTH_RADIUS;

  return dat;
}

/**
 * Calculate bearing from one point to another
 * Returns bearing in degrees (0-360)
 */
function bearing(from: Coordinate, to: Coordinate): number {
  const phi1 = toRadians(from.latitude);
  const phi2 = toRadians(to.latitude);
  const deltaLambda = toRadians(to.longitude - from.longitude);

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

  const theta = Math.atan2(y, x);
  return (toDegrees(theta) + 360) % 360;
}

/**
 * Calculate destination point given start point, bearing, and distance
 */
function destinationPoint(
  start: Coordinate,
  bearingDeg: number,
  distance: number
): Coordinate {
  const delta = distance / EARTH_RADIUS;
  const theta = toRadians(bearingDeg);
  const phi1 = toRadians(start.latitude);
  const lambda1 = toRadians(start.longitude);

  const phi2 = Math.asin(
    Math.sin(phi1) * Math.cos(delta) +
    Math.cos(phi1) * Math.sin(delta) * Math.cos(theta)
  );

  const lambda2 =
    lambda1 +
    Math.atan2(
      Math.sin(theta) * Math.sin(delta) * Math.cos(phi1),
      Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2)
    );

  return {
    latitude: toDegrees(phi2),
    longitude: toDegrees(lambda2),
  };
}

/**
 * Calculate the perpendicular distance from a point to a line segment
 * and find the nearest point on the segment
 *
 * @param point - The point to check
 * @param lineStart - Start of the line segment
 * @param lineEnd - End of the line segment
 * @returns Object with distance and nearest point
 */
export function pointToSegmentDistance(
  point: Coordinate,
  lineStart: Coordinate,
  lineEnd: Coordinate
): { distance: number; nearestPoint: Coordinate } {
  const segmentLength = calculateDistance(
    lineStart.latitude,
    lineStart.longitude,
    lineEnd.latitude,
    lineEnd.longitude
  );

  // If segment is too short, just return distance to start
  if (segmentLength < 1) {
    return {
      distance: calculateDistance(
        point.latitude,
        point.longitude,
        lineStart.latitude,
        lineStart.longitude
      ),
      nearestPoint: lineStart,
    };
  }

  // Calculate along-track distance
  const alongDist = alongTrackDistance(point, lineStart, lineEnd);

  // If the closest point is before the segment start
  if (alongDist < 0) {
    return {
      distance: calculateDistance(
        point.latitude,
        point.longitude,
        lineStart.latitude,
        lineStart.longitude
      ),
      nearestPoint: lineStart,
    };
  }

  // If the closest point is after the segment end
  if (alongDist > segmentLength) {
    return {
      distance: calculateDistance(
        point.latitude,
        point.longitude,
        lineEnd.latitude,
        lineEnd.longitude
      ),
      nearestPoint: lineEnd,
    };
  }

  // The closest point is on the segment
  const crossDist = crossTrackDistance(point, lineStart, lineEnd);
  const bearingToEnd = bearing(lineStart, lineEnd);
  const nearestPoint = destinationPoint(lineStart, bearingToEnd, alongDist);

  return {
    distance: crossDist,
    nearestPoint,
  };
}

/**
 * Calculate the minimum distance from a point to a polyline
 * Returns the distance and the nearest point on the polyline
 *
 * @param point - The point to check
 * @param polyline - Array of coordinates forming the polyline
 * @returns Object with distance, nearest point, and segment index
 */
export function pointToPolylineDistance(
  point: Coordinate,
  polyline: Coordinate[]
): PointToPolylineResult {
  if (polyline.length === 0) {
    return {
      distance: Infinity,
      nearestPoint: point,
      segmentIndex: -1,
    };
  }

  if (polyline.length === 1) {
    return {
      distance: calculateDistance(
        point.latitude,
        point.longitude,
        polyline[0].latitude,
        polyline[0].longitude
      ),
      nearestPoint: polyline[0],
      segmentIndex: 0,
    };
  }

  let minDistance = Infinity;
  let nearestPoint = polyline[0];
  let segmentIndex = 0;

  // Check each segment
  for (let i = 0; i < polyline.length - 1; i++) {
    const result = pointToSegmentDistance(point, polyline[i], polyline[i + 1]);

    if (result.distance < minDistance) {
      minDistance = result.distance;
      nearestPoint = result.nearestPoint;
      segmentIndex = i;
    }
  }

  return {
    distance: minDistance,
    nearestPoint,
    segmentIndex,
  };
}

/**
 * Check if a point is off-route and determine the severity
 *
 * @param point - Current user location
 * @param polyline - Route polyline coordinates
 * @param warningThreshold - Distance in meters to trigger warning (default 100m)
 * @param criticalThreshold - Distance in meters to trigger critical/reroute (default 200m)
 * @returns Object with status, distance, and nearest point
 */
export function getOffRouteStatus(
  point: Coordinate,
  polyline: Coordinate[],
  warningThreshold: number = 100,
  criticalThreshold: number = 200
): OffRouteResult {
  if (polyline.length === 0) {
    return {
      status: 'on-route',
      distance: 0,
      nearestPoint: null,
    };
  }

  const result = pointToPolylineDistance(point, polyline);

  let status: OffRouteStatus = 'on-route';
  if (result.distance >= criticalThreshold) {
    status = 'critical';
  } else if (result.distance >= warningThreshold) {
    status = 'warning';
  }

  return {
    status,
    distance: result.distance,
    nearestPoint: result.nearestPoint,
  };
}

/**
 * Check if a coordinate is valid
 */
export function isValidCoordinate(coord: Coordinate): boolean {
  return (
    !isNaN(coord.latitude) &&
    !isNaN(coord.longitude) &&
    coord.latitude >= -90 &&
    coord.latitude <= 90 &&
    coord.longitude >= -180 &&
    coord.longitude <= 180
  );
}
