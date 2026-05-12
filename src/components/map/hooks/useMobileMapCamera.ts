/**
 * Hook for managing camera state in MapaMobile (MapLibre Native)
 *
 * Handles:
 * - Camera ref creation
 * - Initial camera position computation from paradas bounds
 * - fitBounds effect when paradas are loaded
 */

import { useRef, useEffect, useMemo, type RefObject } from "react";

import { getBounds, toLngLat, zoomFromLongitudeDelta } from "@/lib/maplibre";
import type { ParadaMapItem as Parada } from "@/types/parada-map";

import type { CameraRef } from "@maplibre/maplibre-react-native";

type MapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

interface InitialCamera {
  centerCoordinate: [number, number];
  zoomLevel: number;
}

interface UseMobileMapCameraResult {
  cameraRef: RefObject<CameraRef | null>;
  initialCamera: InitialCamera;
}

function computeInitialRegion(paradasComCoord: Parada[]): MapRegion {
  if (paradasComCoord.length === 0) {
    return {
      latitude: 0,
      longitude: 0,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    };
  }

  if (paradasComCoord.length === 1) {
    return {
      latitude: paradasComCoord[0].latitude!,
      longitude: paradasComCoord[0].longitude!,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
  }

  let minLat = paradasComCoord[0].latitude!;
  let maxLat = paradasComCoord[0].latitude!;
  let minLng = paradasComCoord[0].longitude!;
  let maxLng = paradasComCoord[0].longitude!;

  paradasComCoord.forEach((p) => {
    minLat = Math.min(minLat, p.latitude!);
    maxLat = Math.max(maxLat, p.latitude!);
    minLng = Math.min(minLng, p.longitude!);
    maxLng = Math.max(maxLng, p.longitude!);
  });

  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;
  const deltaLat = (maxLat - minLat) * 1.5; // 1.5x for padding
  const deltaLng = (maxLng - minLng) * 1.5;

  return {
    latitude: centerLat,
    longitude: centerLng,
    latitudeDelta: Math.max(deltaLat, 0.01),
    longitudeDelta: Math.max(deltaLng, 0.01),
  };
}

/**
 * Manages the MapLibre camera ref and computes initial camera position
 * from a set of paradas with valid coordinates.
 */
export function useMobileMapCamera(
  paradasComCoord: Parada[],
): UseMobileMapCameraResult {
  const cameraRef = useRef<CameraRef>(null);

  // Fit all paradas into view once loaded
  useEffect(() => {
    if (paradasComCoord.length > 1 && cameraRef.current) {
      const bounds = getBounds(
        paradasComCoord.map((parada) => ({
          latitude: parada.latitude!,
          longitude: parada.longitude!,
        })),
      );
      if (!bounds) return undefined;
      const timer = setTimeout(() => {
        cameraRef.current?.fitBounds(
          bounds.ne,
          bounds.sw,
          [50, 50, 50, 50],
          500,
        );
      }, 500);

      return () => clearTimeout(timer);
    }
    return undefined;
  }, [paradasComCoord]);

  const initialRegion = useMemo(
    () => computeInitialRegion(paradasComCoord),
    [paradasComCoord],
  );

  const initialCamera = useMemo(
    () => ({
      centerCoordinate: toLngLat({
        latitude: initialRegion.latitude,
        longitude: initialRegion.longitude,
      }),
      zoomLevel: zoomFromLongitudeDelta(initialRegion.longitudeDelta),
    }),
    [initialRegion],
  );

  return { cameraRef, initialCamera };
}
