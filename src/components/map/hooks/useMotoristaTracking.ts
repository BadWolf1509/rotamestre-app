/* global google */

/**
 * Hook for real-time motorista (driver) tracking on web maps
 * Handles loading last location, subscribing to updates, and managing markers
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  buildMotoristaHeader,
  buildMotoristaInfoContent,
} from '@/components/map/infoWindowBuilders';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import type { MotoristaLocation } from '@/types/notifications';
import type { Theme } from '@/utils/styles';
import { MAP_WEB_SHADOWS } from '@/utils/webTokens';

import type React from 'react';

interface UseMotoristaTrackingOptions {
  rotaId?: string;
  showMotorista?: boolean;
  motoristaNome?: string;
  mapRef: React.MutableRefObject<google.maps.Map | null>;
  isLoaded: boolean;
  mapReady: boolean;
  theme: Theme;
  mapId?: string;
  allowAdvancedMarkers?: boolean;
}

interface UseMotoristaTrackingResult {
  motoristaLocation: MotoristaLocation | null;
  clearMotoristaMarker: () => void;
}

/**
 * Get marker color based on motorista speed
 */
function getMarkerColor(velocidade: number | null | undefined, theme: Theme): string {
  if (!velocidade) return theme.colors.info; // azul padrão
  if (velocidade === 0) return theme.colors.gray500; // cinza (parado)
  if (velocidade > 60) return theme.colors.error; // vermelho (rápido)
  if (velocidade > 30) return theme.colors.warning; // laranja (moderado)
  return theme.colors.success; // verde (lento)
}

/**
 * Get time since last location update
 */
function getTimeSinceUpdate(timestamp: string): string {
  const now = new Date();
  const locationTime = new Date(timestamp);
  const diffMs = now.getTime() - locationTime.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'agora';
  if (diffMins < 60) return `${diffMins}m atrás`;
  const diffHours = Math.floor(diffMins / 60);
  return `${diffHours}h atrás`;
}

/**
 * Create DOM element for motorista marker (delivery van icon)
 */
function createMotoristaMarkerContent(
  markerColor: string,
  motoristaNome: string
): HTMLDivElement {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = `
    width: 36px;
    height: 36px;
    cursor: pointer;
    transition: transform 0.15s ease, filter 0.15s ease;
    filter: ${MAP_WEB_SHADOWS.motorista};
  `;
  wrapper.setAttribute('role', 'button');
  wrapper.setAttribute('aria-label', motoristaNome);
  wrapper.setAttribute('tabindex', '0');

  // Delivery van icon in colored circle
  wrapper.innerHTML = `
    <svg width="36" height="36" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
      <circle cx="18" cy="18" r="16" fill="${markerColor}" stroke="white" stroke-width="2"/>
      <g transform="translate(8, 9) scale(0.83)">
        <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" fill="white"/>
      </g>
    </svg>
  `;

  // Interactivity - hover
  wrapper.addEventListener('mouseenter', () => {
    wrapper.style.transform = 'scale(1.15)';
    wrapper.style.filter = MAP_WEB_SHADOWS.motoristaHover;
  });

  wrapper.addEventListener('mouseleave', () => {
    wrapper.style.transform = 'scale(1)';
    wrapper.style.filter = MAP_WEB_SHADOWS.motorista;
  });

  // Accessibility - focus
  wrapper.addEventListener('focus', () => {
    wrapper.style.outline = `2px solid ${markerColor}`;
    wrapper.style.outlineOffset = '2px';
  });

  wrapper.addEventListener('blur', () => {
    wrapper.style.outline = 'none';
  });

  return wrapper;
}

export function useMotoristaTracking({
  rotaId,
  showMotorista = false,
  motoristaNome = 'Motorista',
  mapRef,
  isLoaded,
  mapReady,
  theme,
  mapId,
  allowAdvancedMarkers = true,
}: UseMotoristaTrackingOptions): UseMotoristaTrackingResult {
  const [motoristaLocation, setMotoristaLocation] = useState<MotoristaLocation | null>(null);
  const motoristaMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | google.maps.Marker | null>(null);
  const motoristaInfoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const allowAdvancedMarkersRef = useRef(allowAdvancedMarkers);

  useEffect(() => {
    allowAdvancedMarkersRef.current = allowAdvancedMarkers;
  }, [allowAdvancedMarkers]);

  // Clear motorista marker
  const clearMotoristaMarker = useCallback(() => {
    if (motoristaMarkerRef.current) {
      if ('map' in motoristaMarkerRef.current) {
        try {
          if (!motoristaMarkerRef.current.content && typeof document !== 'undefined') {
            motoristaMarkerRef.current.content = document.createElement('div');
          }
          motoristaMarkerRef.current.map = null;
        } catch (error) {
          logger.warn('[useMotoristaTracking] Failed to detach marker:', error);
        }
      } else if ('setMap' in motoristaMarkerRef.current) {
        try {
          (motoristaMarkerRef.current as google.maps.Marker).setMap(null);
        } catch (error) {
          logger.warn('[useMotoristaTracking] Failed to detach legacy marker:', error);
        }
      }
      motoristaMarkerRef.current = null;
    }
    if (motoristaInfoWindowRef.current) {
      motoristaInfoWindowRef.current.close();
      motoristaInfoWindowRef.current = null;
    }
  }, []);

  // Load last known location
  useEffect(() => {
    if (!showMotorista || !rotaId) {
      setMotoristaLocation(null);
      return;
    }

    const loadLastLocation = async () => {
      try {
        const { data, error } = await supabase
          .from('motorista_locations')
          .select('*')
          .eq('rota_id', rotaId)
          .order('timestamp', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          if (error.code !== 'PGRST116' && error.message !== 'JSON object requested, multiple (or no) rows returned') {
            logger.warn('[useMotoristaTracking] Location not available:', error.code);
          }
          return;
        }

        if (data) {
          setMotoristaLocation(data as MotoristaLocation);
        }
      } catch {
        logger.warn('[useMotoristaTracking] Location unavailable');
      }
    };

    loadLastLocation();
  }, [showMotorista, rotaId]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!showMotorista || !rotaId) return;

    const channel = supabase
      .channel(`motorista-web-${rotaId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'motorista_locations',
          filter: `rota_id=eq.${rotaId}`,
        },
        (payload) => {
          setMotoristaLocation(payload.new as MotoristaLocation);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [showMotorista, rotaId]);

  // Create/update motorista marker on map
  useEffect(() => {
    if (!mapReady || !mapRef.current || !isLoaded) return;

    // Remove marker if not showing motorista or no location
    if (!showMotorista || !motoristaLocation) {
      clearMotoristaMarker();
      return;
    }

    const markerColor = getMarkerColor(motoristaLocation.velocidade, theme);
    const position = {
      lat: Number(motoristaLocation.latitude),
      lng: Number(motoristaLocation.longitude),
    };

    const AdvancedMarker = google.maps.marker?.AdvancedMarkerElement;
    // @ts-expect-error - getMapId() exists in Maps API but not in types
    const mapHasMapId = mapRef.current && typeof mapRef.current.getMapId === 'function' && mapRef.current.getMapId();
    const canUseAdvancedMarkers = Boolean(allowAdvancedMarkersRef.current && mapId && AdvancedMarker && mapHasMapId);

    // If marker already exists, update position
    if (motoristaMarkerRef.current) {
      if (!canUseAdvancedMarkers && 'map' in motoristaMarkerRef.current) {
        // Advanced marker no longer allowed; recreate as legacy marker
        clearMotoristaMarker();
      } else if (canUseAdvancedMarkers && 'position' in motoristaMarkerRef.current) {
        motoristaMarkerRef.current.position = position;
        motoristaMarkerRef.current.content = createMotoristaMarkerContent(markerColor, motoristaNome);
        return;
      } else if ('setPosition' in motoristaMarkerRef.current) {
        const marker = motoristaMarkerRef.current as google.maps.Marker;
        marker.setPosition(position);
        return;
      }
    }

    // Create new marker
    if (canUseAdvancedMarkers && AdvancedMarker) {
      try {
        const content = createMotoristaMarkerContent(markerColor, motoristaNome);
        if (!content || typeof content.getRootNode !== 'function') {
          throw new Error('Invalid AdvancedMarker content');
        }

        const marker = new AdvancedMarker({
          map: null,
          position,
          content,
          title: motoristaNome,
          zIndex: 9999,
        });

        try {
          marker.map = mapRef.current;
        } catch (error) {
          logger.warn('[useMotoristaTracking] Failed to attach advanced marker:', error);
          throw error;
        }

        if (!motoristaInfoWindowRef.current) {
          motoristaInfoWindowRef.current = new google.maps.InfoWindow();
        }

        marker.addListener('gmp-click', () => {
          motoristaInfoWindowRef.current!.setHeaderContent?.(buildMotoristaHeader(motoristaNome, markerColor));
          motoristaInfoWindowRef.current!.setContent(buildMotoristaInfoContent(motoristaLocation.velocidade, getTimeSinceUpdate(motoristaLocation.timestamp), markerColor));
          motoristaInfoWindowRef.current!.open(mapRef.current, marker);
        });

        motoristaMarkerRef.current = marker;
        return;
      } catch (error) {
        logger.warn('[useMotoristaTracking] AdvancedMarkerElement failed, using fallback:', error);
      }
    }

    // Fallback to legacy Marker
    const vanIcon = {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
        <svg width="36" height="36" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
          <circle cx="18" cy="18" r="16" fill="${markerColor}" stroke="white" stroke-width="2"/>
          <g transform="translate(8, 9) scale(0.83)">
            <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" fill="white"/>
          </g>
        </svg>
      `)}`,
      scaledSize: new google.maps.Size(36, 36),
      anchor: new google.maps.Point(18, 18),
    };

    const marker = new google.maps.Marker({
      map: mapRef.current,
      position,
      icon: vanIcon,
      title: motoristaNome,
      zIndex: 9999,
    });

    if (!motoristaInfoWindowRef.current) {
      motoristaInfoWindowRef.current = new google.maps.InfoWindow();
    }

    marker.addListener('click', () => {
      motoristaInfoWindowRef.current!.setHeaderContent?.(buildMotoristaHeader(motoristaNome, markerColor));
      motoristaInfoWindowRef.current!.setContent(buildMotoristaInfoContent(motoristaLocation.velocidade, getTimeSinceUpdate(motoristaLocation.timestamp), markerColor));
      motoristaInfoWindowRef.current!.open(mapRef.current, marker);
    });

    motoristaMarkerRef.current = marker;
  }, [mapReady, isLoaded, showMotorista, motoristaLocation, motoristaNome, theme, mapId, mapRef, clearMotoristaMarker, allowAdvancedMarkers]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearMotoristaMarker();
    };
  }, [clearMotoristaMarker]);

  return {
    motoristaLocation,
    clearMotoristaMarker,
  };
}
