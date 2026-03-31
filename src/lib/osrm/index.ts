/**
 * OSRM (Open Source Routing Machine) Service
 *
 * Substitui Google Routes API para reduzir custos.
 * Usa o demo server publico: router.project-osrm.org
 *
 * Rate limits:
 * - Demo server: 1 request/segundo
 * - Cache: 5 minutos para reduzir chamadas
 *
 * @see https://project-osrm.org/docs/v5.5.1/api/
 * @see https://github.com/Project-OSRM/osrm-backend/wiki/Api-usage-policy
 */

// Types
export type {
  Coordinate,
  RouteStep,
  RouteResult,
  DistanceResult,
  DirectionsResultLeg,
  DirectionsResult,
} from "./types";

// API
export {
  getRoute,
  getDistance,
  optimizeWaypoints,
  decodePolyline,
  getOptimizedDirections,
} from "./api";

// Formatting
export { formatDistance, formatDuration } from "./formatting";

// Fallback
export { calculateHaversineDistance, estimateRouteDistance } from "./fallback";

// TSP Solver
export { solveTSP } from "./tsp";
export type { TSPResult } from "./tsp";

// Table API
export { getDistanceMatrix } from "./table";
export type { DistanceMatrix } from "./table";

// Cache
export { clearCache, getCacheStats } from "./cache";
