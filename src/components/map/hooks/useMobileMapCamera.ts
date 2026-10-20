/**
 * Hook for managing camera state in MapaMobile (MapLibre Native)
 *
 * Handles:
 * - Camera ref creation
 * - Initial camera position computation from paradas bounds
 * - fitBounds effect when paradas are loaded
 */

import { useRef, useEffect, useMemo, type RefObject } from 'react';

import { useMapFitPadding } from '@/components/map/mobile/useMapFitPadding';
import { getBounds, toLngLat, zoomFromLongitudeDelta } from '@/lib/maplibre';
import type { ParadaMapItem as Parada } from '@/types/parada-map';

import type {
  CameraRef,
  InitialViewState,
} from '@maplibre/maplibre-react-native';

type MapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

type InitialCamera = InitialViewState;

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
  const fitPadding = useMapFitPadding();

  // Identidade das paradas pelo conteúdo: realtime e refetch entregam um
  // array NOVO com as mesmas paradas, e re-enquadrar nisso devolvia o mapa à
  // visão geral no meio do uso (pino selecionado e balão perdidos, PR #594).
  const chave = paradasComCoord
    .map((p) => `${p.id}:${p.latitude},${p.longitude}`)
    .join('|');
  const paradasRef = useRef(paradasComCoord);
  paradasRef.current = paradasComCoord;
  const chaveEnquadradaRef = useRef<string | null>(null);

  // Fit all paradas into view once loaded (e de novo só se elas mudarem)
  useEffect(() => {
    const paradas = paradasRef.current;
    if (chaveEnquadradaRef.current === chave) return undefined;
    // A câmera é conferida quando o timer dispara, não agora: este efeito só
    // roda de novo se as paradas mudarem.
    if (paradas.length > 1) {
      const bounds = getBounds(
        paradas.map((parada) => ({
          latitude: parada.latitude!,
          longitude: parada.longitude!,
        })),
      );
      if (!bounds) return undefined;
      const timer = setTimeout(() => {
        if (!cameraRef.current) return;
        chaveEnquadradaRef.current = chave;
        cameraRef.current.fitBounds(
          [bounds.sw[0], bounds.sw[1], bounds.ne[0], bounds.ne[1]],
          {
            padding: fitPadding,
            duration: 500,
          },
        );
      }, 500);

      return () => clearTimeout(timer);
    }
    return undefined;
  }, [chave, fitPadding]);

  const initialRegion = useMemo(
    () => computeInitialRegion(paradasComCoord),
    [paradasComCoord],
  );

  const initialCamera = useMemo<InitialCamera>(
    () => ({
      center: toLngLat({
        latitude: initialRegion.latitude,
        longitude: initialRegion.longitude,
      }),
      zoom: zoomFromLongitudeDelta(initialRegion.longitudeDelta),
    }),
    [initialRegion],
  );

  return { cameraRef, initialCamera };
}
