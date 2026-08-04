/**
 * PictureInPictureMap - Floating Mini Map Component (Web)
 *
 * A draggable, expandable mini-map overlay that shows the user's current
 * location and destination during navigation. Optimized for web browsers.
 *
 * ## Features
 * - **Draggable**: Snap to left/right edges with CSS transitions
 * - **Expandable**: Double-click or button to expand to 90% width
 * - **Swipe to close**: Quick swipe down dismisses the PiP (touch devices)
 * - **Position persistence**: Remembers last position across sessions
 * - **Collision avoidance**: Auto-repositions to avoid FABs/bottom sheets
 * - **Real-time route**: Shows OSRM route polyline via MapLibre GL JS
 * - **ETA display**: Distance and time to destination
 * - **Pulse animation**: CSS animation when near destination (<100m)
 * - **Fallback UI**: Shows Google Maps link if map fails to load
 *
 * ## Interactions
 * - **Click**: No action (allows map interaction when expanded)
 * - **Double-click**: Toggle expand/collapse
 * - **Drag (mouse)**: Move PiP, snaps to nearest edge on release
 * - **Drag (touch)**: Same as mouse, optimized for touch devices
 * - **Swipe down**: Close PiP (distance > 100px)
 *
 * ## Performance
 * - MapLibre GL JS for hardware-accelerated rendering
 * - OpenFreeMap tiles (free, no API key required)
 * - CSS transitions instead of JS animations where possible
 * - Marker refs to avoid recreation on updates
 *
 * @example
 * ```tsx
 * <PictureInPictureMap
 *   visible={showPiP}
 *   userLocation={{ latitude: -23.55, longitude: -46.63 }}
 *   destination={{ latitude: -23.56, longitude: -46.64, address: 'Rua...' }}
 *   onClose={() => setShowPiP(false)}
 *   onExpand={() => openFullNavigation()}
 *   progress={{ completed: 2, total: 5 }}
 *   stopType="entrega"
 * />
 * ```
 *
 * @see PictureInPictureMap.tsx for native version
 * @see usePiPRouteInfo for route calculation logic
 * @see usePiPCollisionDetection for collision avoidance logic
 */

import { Ionicons } from '@expo/vector-icons';
import * as maplibregl from 'maplibre-gl';
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';

import 'maplibre-gl/dist/maplibre-gl.css';

import {
  EDGE_PADDING,
  PIP_HEIGHT,
  PIP_WIDTH,
  usePiPCollisionDetection,
  usePiPRouteInfo,
  usePipDrag,
  getMapCenter,
  getMapZoom,
  buildGoogleMapsUrl,
} from '@/hooks/navigation';
import type { PictureInPictureMapProps } from '@/hooks/navigation';
import { usePiPPosition } from '@/hooks/usePiPPosition';
import { logger } from '@/lib/logger';
import {
  getOpenFreeMapStyle,
  installOpenFreeMapMissingImageHandler,
} from '@/lib/openFreeMapStyle';
import { boxShadow, withOpacity } from '@/utils/color';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

export function PictureInPictureMap({
  visible,
  userLocation,
  destination,
  onClose,
  onExpand,
  progress,
  currentStopOrder,
  stopType,
  userHeading,
  nextInstruction,
  avoidAreas,
}: PictureInPictureMapProps) {
  const { theme } = useUnistyles();
  const { savedPosition, savePosition } = usePiPPosition();

  // Estado de expansão
  const [isExpanded, setIsExpanded] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const positionRef = useRef({ x: 0, y: 0 });

  // Use shared hooks for route info and collision detection
  const { routeInfo, isNearDestination, routePath } = usePiPRouteInfo({
    visible,
    userLocation,
    destination,
  });
  const { checkCollision, findSafePosition } = usePiPCollisionDetection();

  // Drag interaction hook
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const { isDragging, handleMouseDown, handleTouchStart } = usePipDrag({
    isExpanded,
    viewport,
    positionRef,
    setPosition,
    onClose,
    savePosition,
  });

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  // Marker refs
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const destMarkerRef = useRef<maplibregl.Marker | null>(null);

  // Dimensões calculadas
  const expandedWidth = Math.min(viewport.width * 0.9, 600);
  const expandedHeight = Math.min(viewport.height * 0.5, 400);
  const currentWidth = isExpanded ? expandedWidth : PIP_WIDTH;
  const currentHeight = isExpanded ? expandedHeight : PIP_HEIGHT;

  // Injetar CSS keyframes para animação de pulso (apenas web)
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const styleId = 'pip-pulse-keyframes';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @keyframes pip-pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.15); }
      }
    `;
    document.head.appendChild(style);

    return () => {
      const existingStyle = document.getElementById(styleId);
      if (existingStyle) {
        existingStyle.remove();
      }
    };
  }, []);

  // Inicializar posição no canto inferior direito
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const updateViewport = () => {
        setViewport({ width: window.innerWidth, height: window.innerHeight });
      };
      updateViewport();
      window.addEventListener('resize', updateViewport);
      return () => window.removeEventListener('resize', updateViewport);
    }
  }, []);

  // Posicionar no canto quando visível (usa posição salva se disponível)
  useEffect(() => {
    if (visible && viewport.width > 0 && !isExpanded) {
      // Posição padrão (canto inferior direito)
      const defaultX = viewport.width - PIP_WIDTH - EDGE_PADDING - 80;
      const defaultY = viewport.height - PIP_HEIGHT - EDGE_PADDING - 120;

      // Usar posição salva se disponível e válida
      let initialX = defaultX;
      let initialY = defaultY;

      if (savedPosition) {
        initialX = Math.max(
          EDGE_PADDING,
          Math.min(savedPosition.x, viewport.width - PIP_WIDTH - EDGE_PADDING),
        );
        initialY = Math.max(
          EDGE_PADDING,
          Math.min(
            savedPosition.y,
            viewport.height - PIP_HEIGHT - EDGE_PADDING - 60,
          ),
        );
      }

      setPosition({ x: initialX, y: initialY });
      positionRef.current = { x: initialX, y: initialY };
    }
  }, [visible, viewport, isExpanded, savedPosition]);

  // Auto-reposicionamento para evitar colisão com avoidAreas
  useEffect(() => {
    if (
      !avoidAreas ||
      avoidAreas.length === 0 ||
      isExpanded ||
      !visible ||
      viewport.width === 0
    )
      return;

    const currentPosition = positionRef.current;

    // Use shared collision detection hook
    const hasCollision = checkCollision(currentPosition, avoidAreas);

    if (hasCollision) {
      const minY = EDGE_PADDING;
      const maxY = viewport.height - PIP_HEIGHT - EDGE_PADDING - 60;

      const bestPosition = findSafePosition(currentPosition, avoidAreas, {
        width: viewport.width,
        height: viewport.height,
        minY,
        maxY,
      });

      // Reposicionar (com transição CSS)
      positionRef.current = bestPosition;
      setPosition(bestPosition);
      savePosition(bestPosition);
    }
  }, [
    avoidAreas,
    visible,
    isExpanded,
    viewport,
    savePosition,
    checkCollision,
    findSafePosition,
  ]);

  // Toggle expansão
  const toggleExpand = useCallback(() => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);

    if (newExpanded) {
      // Centralizar quando expandido
      const centerX = (viewport.width - expandedWidth) / 2;
      const centerY = (viewport.height - expandedHeight) / 2;
      setPosition({ x: centerX, y: centerY });
      positionRef.current = { x: centerX, y: centerY };
    } else {
      // Voltar ao canto inferior direito
      const snapX = viewport.width - PIP_WIDTH - EDGE_PADDING - 80;
      const snapY = viewport.height - PIP_HEIGHT - EDGE_PADDING - 120;
      setPosition({ x: snapX, y: snapY });
      positionRef.current = { x: snapX, y: snapY };
    }
  }, [isExpanded, viewport, expandedWidth, expandedHeight]);

  // Map calculations (pure functions from pip-utils)
  const getRegion = useCallback(
    () => getMapCenter(userLocation, destination),
    [userLocation, destination],
  );
  const getZoom = useCallback(
    () => getMapZoom(userLocation, destination),
    [userLocation, destination],
  );

  // Open external Google Maps
  const openGoogleMaps = useCallback(() => {
    if (!destination) return;
    const url = buildGoogleMapsUrl(destination, userLocation);
    if (typeof window !== 'undefined') {
      window.open(url, '_blank');
    }
  }, [userLocation, destination]);

  // Create user marker element
  const createUserMarkerElement = useCallback(
    (heading?: number) => {
      const el = document.createElement('div');

      if (heading !== undefined) {
        // Seta direcional quando heading disponível
        el.style.cssText = `
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background-color: ${theme.colors.white};
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 4px rgba(0,0,0,0.25);
        transform: rotate(${heading}deg);
      `;
        el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 512 512"><path fill="${theme.colors.info}" d="m256 64l192 192-64 64-96-96v224h-64V224l-96 96-64-64z"/></svg>`;
      } else {
        // Ponto azul padrão
        el.style.cssText = `
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background-color: ${withOpacity(theme.colors.info, 0.2)};
        display: flex;
        align-items: center;
        justify-content: center;
      `;

        const dot = document.createElement('div');
        dot.style.cssText = `
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background-color: ${theme.colors.info};
        border: 2px solid ${theme.colors.white};
      `;
        el.appendChild(dot);
      }

      return el;
    },
    [theme.colors.info, theme.colors.white],
  );

  // Create destination marker element
  const createDestinationMarkerElement = useCallback(() => {
    const el = document.createElement('div');
    el.style.cssText = `
      background-color: ${theme.colors.white};
      border-radius: 15px;
      padding: 4px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.2);
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 512 512"><path fill="${theme.colors.error}" d="M256 32C167.67 32 96 96.51 96 176c0 128 160 304 160 304s160-176 160-304c0-79.49-71.67-144-160-144m0 224a64 64 0 1 1 64-64a64.07 64.07 0 0 1-64 64"/></svg>`;

    return el;
  }, [theme.colors.white, theme.colors.error]);

  // Initialize MapLibre map
  useEffect(() => {
    if (!mapContainerRef.current || !visible || !destination) return;

    // Clean up existing map
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    let cancelled = false;
    let mapInstance: maplibregl.Map | null = null;
    let removeMissingImageHandler: (() => void) | null = null;

    const initializeMap = async () => {
      try {
        const style = await getOpenFreeMapStyle();
        if (cancelled || !mapContainerRef.current) return;

        const center = getRegion();
        const zoom = getZoom();

        mapInstance = new maplibregl.Map({
          container: mapContainerRef.current,
          style,
          center: [center.lng, center.lat],
          zoom,
          attributionControl: false,
          interactive: isExpanded,
        });
        removeMissingImageHandler =
          installOpenFreeMapMissingImageHandler(mapInstance);

        mapInstance.on('load', () => {
          setMapReady(true);
          mapRef.current = mapInstance;
        });

        mapInstance.on('error', (e) => {
          logger.error('[PiP.web] Map error:', e);
          setMapError('Erro ao carregar mapa');
        });
      } catch (error) {
        if (cancelled) return;
        logger.error('[PiP.web] Failed to initialize map:', error);
        setMapError('Erro ao inicializar mapa');
      }
    };

    initializeMap();

    return () => {
      cancelled = true;
      if (removeMissingImageHandler) {
        removeMissingImageHandler();
      }
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
      if (destMarkerRef.current) {
        destMarkerRef.current.remove();
        destMarkerRef.current = null;
      }
      if (mapInstance) {
        mapInstance.remove();
      }
      mapRef.current = null;
      setMapReady(false);
    };
  }, [visible, destination, isExpanded, getRegion, getZoom]);

  // Update map interactivity when expanded state changes
  useEffect(() => {
    if (!mapRef.current) return;

    if (isExpanded) {
      mapRef.current.scrollZoom.enable();
      mapRef.current.dragPan.enable();
      mapRef.current.doubleClickZoom.enable();
    } else {
      mapRef.current.scrollZoom.disable();
      mapRef.current.dragPan.disable();
      mapRef.current.doubleClickZoom.disable();
    }
  }, [isExpanded]);

  // Add/update markers
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;

    // Update or create user marker
    if (userLocation) {
      if (userMarkerRef.current) {
        userMarkerRef.current.setLngLat([
          userLocation.longitude,
          userLocation.latitude,
        ]);
        // Update marker element if heading changed
        const newEl = createUserMarkerElement(userHeading);
        userMarkerRef.current.getElement().replaceWith(newEl);
      } else {
        userMarkerRef.current = new maplibregl.Marker({
          element: createUserMarkerElement(userHeading),
        })
          .setLngLat([userLocation.longitude, userLocation.latitude])
          .addTo(mapRef.current);
      }
    }

    // Update or create destination marker
    if (destination) {
      if (destMarkerRef.current) {
        destMarkerRef.current.setLngLat([
          destination.longitude,
          destination.latitude,
        ]);
      } else {
        destMarkerRef.current = new maplibregl.Marker({
          element: createDestinationMarkerElement(),
        })
          .setLngLat([destination.longitude, destination.latitude])
          .addTo(mapRef.current);
      }
    }
  }, [
    mapReady,
    userLocation,
    destination,
    userHeading,
    createUserMarkerElement,
    createDestinationMarkerElement,
  ]);

  // Add route polyline
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;

    const map = mapRef.current;
    const sourceId = 'pip-route-source';
    const layerId = 'pip-route-layer';

    // Remove existing layer and source if they exist
    if (map.getLayer(layerId)) {
      map.removeLayer(layerId);
    }
    if (map.getSource(sourceId)) {
      map.removeSource(sourceId);
    }

    if (routePath.length < 2) return;

    // Add route source
    map.addSource(sourceId, {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: routePath.map((c) => [c.longitude, c.latitude]),
        },
      },
    });

    // Add route layer
    map.addLayer({
      id: layerId,
      type: 'line',
      source: sourceId,
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': theme.colors.primary,
        'line-width': 4,
        'line-opacity': 1,
      },
    });

    return () => {
      if (!(map as unknown as { style?: unknown }).style) return;
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    };
  }, [mapReady, routePath, theme.colors.primary]);

  // Update map center when user location changes
  useEffect(() => {
    if (!mapRef.current || !mapReady || !userLocation) return;

    const center = getRegion();
    mapRef.current.setCenter([center.lng, center.lat]);
  }, [mapReady, userLocation, getRegion]);

  if (!visible || !destination) return null;

  // Estado de erro
  if (mapError) {
    return (
      <div
        ref={containerRef}
        style={{
          position: 'fixed',
          left: position.x,
          top: position.y,
          width: currentWidth,
          height: currentHeight,
          zIndex: 9999,
          cursor: isDragging ? 'grabbing' : 'grab',
          transition: isDragging ? 'none' : 'all 0.3s ease-out',
        }}
        onMouseDown={handleMouseDown}
      >
        <View
          style={[
            styles.container,
            { width: currentWidth, height: currentHeight },
          ]}
        >
          <View style={styles.fallbackContainer}>
            <Ionicons
              name="map-outline"
              size={32}
              color={theme.colors.gray400}
            />
            <Text style={styles.fallbackText}>Mapa indisponível</Text>
            <TouchableOpacity
              style={styles.openMapsButton}
              onPress={openGoogleMaps}
            >
              <Ionicons
                name="open-outline"
                size={16}
                color={theme.colors.primary}
              />
              <Text style={styles.openMapsText}>Abrir Google Maps</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.controls}>
            <TouchableOpacity
              style={[styles.controlButton, styles.closeButton]}
              onPress={onClose}
            >
              <Ionicons name="close" size={18} color={theme.colors.white} />
            </TouchableOpacity>
          </View>
        </View>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      data-testid="pip-map-container"
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        width: currentWidth,
        height: currentHeight,
        zIndex: 9999,
        transition: isDragging ? 'none' : 'all 0.3s ease-out',
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: boxShadow(0, 4, 16, 0, '#000000', 0.25),
      }}
    >
      <View
        style={[
          styles.container,
          { width: currentWidth, height: currentHeight },
        ]}
      >
        {/* Drag Overlay - cobre toda área quando colapsado para permitir drag */}
        {!isExpanded && (
          <div
            data-testid="pip-drag-overlay"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 10, // Acima do mapa, abaixo dos controles (z-index: 20)
              cursor: isDragging ? 'grabbing' : 'grab',
              touchAction: 'none', // Essencial para touch funcionar
              background: 'transparent',
            }}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            onDoubleClick={toggleExpand}
          />
        )}

        {/* MapLibre Map */}
        <div
          ref={mapContainerRef}
          style={{
            width: '100%',
            height: '100%',
          }}
        />

        {/* Loading overlay */}
        {!mapReady && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
          </View>
        )}

        {/* Navigation Instruction - apenas quando colapsado e há instrução */}
        {!isExpanded && nextInstruction && (
          <View style={styles.instructionBar}>
            <Ionicons
              name="compass-outline"
              size={14}
              color={theme.colors.white}
            />
            <Text style={styles.instructionText} numberOfLines={1}>
              {nextInstruction}
            </Text>
          </View>
        )}

        {/* Progress Badge - apenas quando colapsado e há progresso */}
        {!isExpanded && progress && (
          <View
            style={[
              styles.progressBadge,
              nextInstruction && styles.progressBadgeWithInstruction,
            ]}
          >
            <Ionicons
              name="checkmark-circle-outline"
              size={12}
              color={theme.colors.white}
            />
            <Text style={styles.progressText}>
              {currentStopOrder ?? progress.completed + 1} de {progress.total}
            </Text>
          </View>
        )}

        {/* ETA Badge - apenas quando colapsado */}
        {!isExpanded && routeInfo && (
          <View
            style={[styles.etaBadge, isNearDestination && styles.etaBadgePulse]}
          >
            <Ionicons
              name={stopType === 'retirada' ? 'cube-outline' : 'gift-outline'}
              size={12}
              color={theme.colors.white}
            />
            <Text style={styles.etaText}>
              {routeInfo.distanceText} • {routeInfo.timeText}
            </Text>
          </View>
        )}

        {/* Controles */}
        <View style={styles.controls}>
          {/* Expand/Collapse button */}
          <TouchableOpacity
            testID="pip-expand-button"
            style={[styles.controlButton, isExpanded && styles.collapseButton]}
            onPress={(e) => {
              e.stopPropagation();
              toggleExpand();
            }}
            accessibilityLabel={isExpanded ? 'Minimizar mapa' : 'Expandir mapa'}
          >
            <Ionicons
              name={isExpanded ? 'contract' : 'expand'}
              size={18}
              color={theme.colors.white}
            />
          </TouchableOpacity>

          {/* Navigate button (only when expanded) */}
          {isExpanded && (
            <TouchableOpacity
              testID="pip-navigate-button"
              style={[styles.controlButton, styles.navigateButton]}
              onPress={(e) => {
                e.stopPropagation();
                onExpand();
              }}
              accessibilityLabel="Abrir navegação completa"
            >
              <Ionicons name="navigate" size={18} color={theme.colors.white} />
            </TouchableOpacity>
          )}

          {/* Close button */}
          <TouchableOpacity
            testID="pip-close-button"
            style={[styles.controlButton, styles.closeButton]}
            onPress={(e) => {
              e.stopPropagation();
              onClose();
            }}
            accessibilityLabel="Fechar mapa"
          >
            <Ionicons name="close" size={18} color={theme.colors.white} />
          </TouchableOpacity>
        </View>

        {/* Drag indicator (only when collapsed) */}
        {!isExpanded && (
          <View style={styles.dragIndicator}>
            <View style={styles.dragBar} />
          </View>
        )}
      </View>
    </div>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.gray100,
    gap: theme.spacing['2'],
  },
  loadingText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray500,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: withOpacity(theme.colors.white, 0.8),
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.gray50,
    gap: theme.spacing['2'],
    padding: theme.spacing['4'],
  },
  fallbackText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray500,
  },
  openMapsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing['1'],
    paddingHorizontal: theme.spacing['3'],
    paddingVertical: theme.spacing['1.5'],
    backgroundColor: theme.colors.infoBg,
    borderRadius: theme.borderRadius.xs,
    marginTop: theme.spacing['2'],
  },
  openMapsText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.primary,
    fontWeight: '500',
  },
  controls: {
    position: 'absolute',
    top: theme.spacing['2'],
    right: theme.spacing['2'],
    flexDirection: 'row',
    gap: theme.spacing['2'],
    zIndex: 20, // Acima do drag overlay (z-index: 10)
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: theme.borderRadius.full,
    backgroundColor: withOpacity(theme.colors.black, 0.6),
    justifyContent: 'center',
    alignItems: 'center',
  },
  collapseButton: {
    backgroundColor: withOpacity(theme.colors.primary, 0.9),
  },
  navigateButton: {
    backgroundColor: withOpacity(theme.colors.success, 0.9),
  },
  closeButton: {
    backgroundColor: withOpacity(theme.colors.error, 0.9),
  },
  instructionBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: withOpacity(theme.colors.gray800, 0.9),
    paddingHorizontal: theme.spacing['2'],
    paddingVertical: theme.spacing['1.5'],
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing['1.5'],
    zIndex: 15, // Acima de tudo no PiP
    borderTopLeftRadius: theme.borderRadius.lg,
    borderTopRightRadius: theme.borderRadius.lg,
  },
  instructionText: {
    flex: 1,
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.white,
    fontWeight: '500',
  },
  progressBadge: {
    position: 'absolute',
    top: theme.spacing['2'],
    left: theme.spacing['2'],
    backgroundColor: withOpacity(theme.colors.success, 0.9),
    borderRadius: theme.borderRadius.xs,
    paddingHorizontal: theme.spacing['2'],
    paddingVertical: theme.spacing['1'],
    flexDirection: 'row',
    zIndex: 15, // Visível acima do drag overlay
    alignItems: 'center',
    gap: theme.spacing['1'],
  },
  progressBadgeWithInstruction: {
    // Ajustar posição quando há instrução
    top: theme.spacing['8'],
  },
  progressText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.white,
    fontWeight: '600',
  },
  etaBadge: {
    position: 'absolute',
    bottom: theme.spacing['2'],
    left: theme.spacing['2'],
    backgroundColor: withOpacity(theme.colors.primary, 0.9),
    borderRadius: theme.borderRadius.xs,
    paddingHorizontal: theme.spacing['2'],
    paddingVertical: theme.spacing['1'],
    flexDirection: 'row',
    zIndex: 15, // Visível acima do drag overlay
    alignItems: 'center',
    gap: theme.spacing['1'],
  },
  etaBadgePulse: {
    // CSS animation para web (React Native Web suporta isso)
    animation: 'pip-pulse 1s ease-in-out infinite',
    backgroundColor: withOpacity(theme.colors.success, 0.95),
  },
  etaText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.white,
    fontWeight: '600',
  },
  dragIndicator: {
    position: 'absolute',
    top: 6,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 15, // Visível acima do drag overlay
    pointerEvents: 'none', // Não bloqueia eventos do overlay
  },
  dragBar: {
    width: 30,
    height: 3,
    borderRadius: 2,
    backgroundColor: withOpacity(theme.colors.black, 0.3),
  },
  userMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: withOpacity(theme.colors.info, 0.2),
    justifyContent: 'center',
    alignItems: 'center',
  },
  userMarkerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.info,
    borderWidth: 2,
    borderColor: theme.colors.white,
  },
  userDirectionMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
  },
  destinationMarker: {
    backgroundColor: theme.colors.white,
    borderRadius: 15,
    padding: theme.spacing['1'],
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
}));
