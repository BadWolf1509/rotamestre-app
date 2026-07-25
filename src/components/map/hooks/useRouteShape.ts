/**
 * Hook for consuming useRouteDirections and computing the GeoJSON line shape
 * from route coordinates for rendering on the MapLibre map.
 *
 * Returns:
 * - routeShape: GeoJSON Feature<LineString> or null
 * - routeInfo: { distanceMeters, durationSeconds } or undefined
 * - isLoadingRoute: boolean
 */

import { useMemo } from 'react';

import {
  useRouteDirections,
  type RouteInfo,
  type RouteSource,
  type UseRouteDirectionsOptions,
} from '@/hooks/useRouteDirections';
import { toLineString } from '@/lib/maplibre';
import type { GeoJSONLineString } from '@/lib/maplibre';
import type { ParadaMapItem as Parada } from '@/types/parada-map';

interface UseRouteShapeResult {
  routeShape: GeoJSONLineString | null;
  routeInfo: RouteInfo | null;
  isLoadingRoute: boolean;
  routeError: string | null;
  refetchRoute: () => Promise<void>;
  routeSource: RouteSource;
  isStaleRoute: boolean;
}

/**
 * Wraps useRouteDirections and converts coordinates to a GeoJSON LineString
 * suitable for MapLibre ShapeSource.
 */
export function useRouteShape(
  paradasComCoord: Parada[],
  options?: UseRouteDirectionsOptions,
): UseRouteShapeResult {
  const {
    routeCoordinates,
    routeInfo,
    isLoading: isLoadingRoute,
    error: routeError,
    refetch: refetchRoute,
    source: routeSource,
    isStale: isStaleRoute,
  } = useRouteDirections(paradasComCoord, options);

  const routeShape = useMemo(
    () => (routeCoordinates.length > 1 ? toLineString(routeCoordinates) : null),
    [routeCoordinates],
  );

  return {
    routeShape,
    routeInfo,
    isLoadingRoute,
    routeError,
    refetchRoute,
    routeSource,
    isStaleRoute,
  };
}
