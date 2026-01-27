/* global google */

/**
 * Hook for managing custom map controls (legend, recenter)
 */

import { useCallback, useEffect, useRef } from 'react';

import type { Theme } from '@/utils/styles';
import { MAP_WEB_SHADOWS } from '@/utils/webTokens';

import type React from 'react';

interface LatLng {
  lat: number;
  lng: number;
}

interface UseMapControlsOptions {
  mapRef: React.MutableRefObject<google.maps.Map | null>;
  boundsRef: React.MutableRefObject<google.maps.LatLngBounds | null>;
  center: LatLng;
  theme: Theme;
  isLoaded: boolean;
  mapReady: boolean;
  hasParadas: boolean;
}

/**
 * Create legend HTML element
 */
function createLegendElement(theme: Theme): HTMLDivElement {
  const legend = document.createElement('div');
  legend.style.background = theme.colors.white;
  legend.style.border = `1px solid ${theme.colors.gray200}`;
  legend.style.borderRadius = `${theme.borderRadius.md}px`;
  legend.style.padding = `${theme.spacing['2']}px ${theme.spacing['2.5']}px`;
  legend.style.margin = `${theme.spacing['2']}px`;
  legend.style.boxShadow = MAP_WEB_SHADOWS.legend;
  legend.innerHTML = `
    <div style="font-weight:700;font-size:12px;margin-bottom:${theme.spacing['1.5']}px;color:${theme.colors.gray900};">Legenda</div>
    <div style="display:flex;gap:${theme.spacing['2.5']}px;font-size:12px;color:${theme.colors.gray600};align-items:center;flex-wrap:wrap;">
      <span style="display:flex;align-items:center;gap:${theme.spacing['1']}px;"><span style="width:10px;height:10px;border-radius:50%;background:${theme.colors.warning};display:inline-block;"></span>Pendente</span>
      <span style="display:flex;align-items:center;gap:${theme.spacing['1']}px;"><span style="width:10px;height:10px;border-radius:50%;background:${theme.colors.info};display:inline-block;"></span>Em rota</span>
      <span style="display:flex;align-items:center;gap:${theme.spacing['1']}px;"><span style="width:10px;height:10px;border-radius:50%;background:${theme.colors.success};display:inline-block;"></span>Concluída</span>
      <span style="display:flex;align-items:center;gap:${theme.spacing['1']}px;"><span style="width:10px;height:10px;border-radius:50%;background:${theme.colors.gray500};display:inline-block;"></span>Pulada</span>
    </div>
  `;
  return legend;
}

/**
 * Create recenter button element
 */
function createRecenterElement(theme: Theme, onClick: () => void): HTMLDivElement {
  const recenter = document.createElement('div');
  recenter.style.background = theme.colors.white;
  recenter.style.border = `1px solid ${theme.colors.gray200}`;
  recenter.style.borderRadius = `${theme.borderRadius.md}px`;
  recenter.style.padding = `${theme.spacing['2.5']}px`;
  recenter.style.margin = `${theme.spacing['2']}px`;
  recenter.style.cursor = 'pointer';
  recenter.style.boxShadow = MAP_WEB_SHADOWS.legend;
  recenter.innerText = 'Recentrar rota';
  recenter.addEventListener('click', onClick);
  return recenter;
}

/**
 * Hook for adding custom controls to Google Map
 */
export function useMapControls({
  mapRef,
  boundsRef,
  center,
  theme,
  isLoaded,
  mapReady,
  hasParadas,
}: UseMapControlsOptions): void {
  const legendControlRef = useRef<HTMLDivElement | null>(null);
  const recenterControlRef = useRef<HTMLDivElement | null>(null);

  // Handler for recenter button click
  const handleRecenter = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    try {
      const bounds = boundsRef.current;
      if (bounds && typeof bounds.isEmpty === 'function' && !bounds.isEmpty()) {
        map.fitBounds(bounds);
        return;
      }
    } catch {
      // Fallback to panTo when bounds are invalid or map throws
    }

    if (hasParadas) {
      try {
        map.panTo(center);
      } catch {
        // Ignore panTo errors to avoid crash on web
      }
    }
  }, [boundsRef, mapRef, hasParadas, center]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !google?.maps) return;

    // Capture the map instance at effect time for cleanup
    const map = mapRef.current;
    const leftPosition = google.maps.ControlPosition.LEFT_BOTTOM;
    const rightPosition = google.maps.ControlPosition.RIGHT_BOTTOM;

    // Create and add legend
    const legend = createLegendElement(theme);
    legendControlRef.current = legend;
    map.controls[leftPosition].push(legend);

    // Create and add recenter button
    const recenter = createRecenterElement(theme, handleRecenter);
    recenterControlRef.current = recenter;
    map.controls[rightPosition].push(recenter);

    return () => {
      const leftControls = map.controls?.[leftPosition];
      const rightControls = map.controls?.[rightPosition];

      // Remove legend
      if (legendControlRef.current && leftControls?.getArray) {
        const leftArray = leftControls.getArray();
        if (Array.isArray(leftArray)) {
          const idx = leftArray.indexOf(legendControlRef.current);
          if (idx >= 0) {
            leftControls.removeAt(idx);
          }
        }
      }
      // Remove recenter
      if (recenterControlRef.current && rightControls?.getArray) {
        recenterControlRef.current.removeEventListener('click', handleRecenter);
        const rightArray = rightControls.getArray();
        if (Array.isArray(rightArray)) {
          const idx = rightArray.indexOf(recenterControlRef.current);
          if (idx >= 0) {
            rightControls.removeAt(idx);
          }
        }
      }
    };
  }, [center, mapReady, isLoaded, theme, handleRecenter, mapRef]);
}
