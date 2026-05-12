/**
 * Hook for consuming useRouteDirections and computing the GeoJSON line shape
 * from route coordinates for rendering on the MapLibre map.
 *
 * Returns:
 * - routeShape: GeoJSON Feature<LineString> or null
 * - routeInfo: { distanceMeters, durationSeconds } or undefined
 * - isLoadingRoute: boolean
 */

import { useMemo } from "react";

import { useRouteDirections, type RouteInfo } from "@/hooks/useRouteDirections";
import { toLineString } from "@/lib/maplibre";
import type { ParadaMapItem as Parada } from "@/types/parada-map";

interface UseRouteShapeResult {
  routeShape: any | null;
  routeInfo: RouteInfo | null;
  isLoadingRoute: boolean;
}

/**
 * Wraps useRouteDirections and converts coordinates to a GeoJSON LineString
 * suitable for MapLibre ShapeSource.
 */
export function useRouteShape(paradasComCoord: Parada[]): UseRouteShapeResult {
  const {
    routeCoordinates,
    routeInfo,
    isLoading: isLoadingRoute,
  } = useRouteDirections(paradasComCoord);

  const routeShape = useMemo(
    () => (routeCoordinates.length > 1 ? toLineString(routeCoordinates) : null),
    [routeCoordinates],
  );

  return { routeShape, routeInfo, isLoadingRoute };
}
