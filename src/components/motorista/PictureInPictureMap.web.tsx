import { Ionicons } from '@expo/vector-icons';
import { GoogleMap, useJsApiLoader, OverlayView, Polyline } from '@react-google-maps/api';
import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';

import {
  EDGE_PADDING,
  PIP_HEIGHT,
  PIP_WIDTH,
  SWIPE_DOWN_THRESHOLD,
  usePiPCollisionDetection,
  usePiPRouteInfo,
} from '@/hooks/navigation';
import type { PictureInPictureMapProps } from '@/hooks/navigation';
import { usePiPPosition } from '@/hooks/usePiPPosition';
import { boxShadow, withOpacity } from '@/utils/color';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
const GOOGLE_MAPS_MAP_ID = process.env.EXPO_PUBLIC_GOOGLE_MAPS_MAP_ID || '';

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

  // Estado de expansão e arrasto
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [mapReady, setMapReady] = useState(false);

  // Use shared hooks for route info and collision detection
  const { routeInfo, isNearDestination, routePath } = usePiPRouteInfo({
    visible,
    userLocation,
    destination,
  });
  const { checkCollision, findSafePosition } = usePiPCollisionDetection();

  // Refs para arrasto
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const positionRef = useRef({ x: 0, y: 0 });
  const dragStartPosRef = useRef({ x: 0, y: 0 }); // Posição inicial do PiP quando começou o drag

  // Dimensões da viewport
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  // Carregar Google Maps API - IMPORTANTE: usar mesmo ID que outros componentes
  // para evitar erro "Loader must not be called again with different options"
  const mapLibraries = useMemo(() => ['marker', 'places'] as ('marker' | 'places')[], []);
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script', // Deve ser igual em todos os componentes
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: mapLibraries,
    version: 'beta',
  });

  // Dimensões calculadas
  const expandedWidth = useMemo(() => Math.min(viewport.width * 0.9, 600), [viewport.width]);
  const expandedHeight = useMemo(() => Math.min(viewport.height * 0.5, 400), [viewport.height]);
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
        initialX = Math.max(EDGE_PADDING, Math.min(savedPosition.x, viewport.width - PIP_WIDTH - EDGE_PADDING));
        initialY = Math.max(EDGE_PADDING, Math.min(savedPosition.y, viewport.height - PIP_HEIGHT - EDGE_PADDING - 60));
      }

      setPosition({ x: initialX, y: initialY });
      positionRef.current = { x: initialX, y: initialY };
    }
  }, [visible, viewport, isExpanded, savedPosition]);

  // Auto-reposicionamento para evitar colisão com avoidAreas
  useEffect(() => {
    if (!avoidAreas || avoidAreas.length === 0 || isExpanded || !visible || viewport.width === 0) return;

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
  }, [avoidAreas, visible, isExpanded, viewport, savePosition, checkCollision, findSafePosition]);

  // Snap to edges helper
  const snapToEdge = useCallback(() => {
    const { x, y } = positionRef.current;
    const centerX = x + PIP_WIDTH / 2;
    const snapX = centerX < viewport.width / 2
      ? EDGE_PADDING
      : viewport.width - PIP_WIDTH - EDGE_PADDING;

    // Clamp Y dentro dos bounds
    const minY = EDGE_PADDING;
    const maxY = viewport.height - PIP_HEIGHT - EDGE_PADDING - 60;
    const snapY = Math.max(minY, Math.min(maxY, y));

    positionRef.current = { x: snapX, y: snapY };
    setPosition({ x: snapX, y: snapY });
    // Persistir posição após snap
    savePosition({ x: snapX, y: snapY });
  }, [viewport, savePosition]);

  // Handlers de arrasto com mouse
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isExpanded) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - positionRef.current.x,
      y: e.clientY - positionRef.current.y,
    };
    dragStartPosRef.current = { ...positionRef.current };
  }, [isExpanded]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || isExpanded) return;
    const newX = e.clientX - dragStartRef.current.x;
    const newY = e.clientY - dragStartRef.current.y;
    positionRef.current = { x: newX, y: newY };
    setPosition({ x: newX, y: newY });
  }, [isDragging, isExpanded]);

  const handleMouseUp = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);

    // Detectar swipe para baixo (distância > 100px)
    const deltaY = positionRef.current.y - dragStartPosRef.current.y;
    if (deltaY > SWIPE_DOWN_THRESHOLD) {
      // Swipe down - fechar
      onClose();
      return;
    }

    snapToEdge();
  }, [isDragging, snapToEdge, onClose]);

  // Handlers de arrasto com touch (mobile/tablet)
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isExpanded) return;
    // Não usar preventDefault aqui - causa o warning "cancelable=false"
    e.stopPropagation();
    setIsDragging(true);
    const touch = e.touches[0];
    dragStartRef.current = {
      x: touch.clientX - positionRef.current.x,
      y: touch.clientY - positionRef.current.y,
    };
    dragStartPosRef.current = { ...positionRef.current };
  }, [isExpanded]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging || isExpanded) return;
    const touch = e.touches[0];
    const newX = touch.clientX - dragStartRef.current.x;
    const newY = touch.clientY - dragStartRef.current.y;
    positionRef.current = { x: newX, y: newY };
    setPosition({ x: newX, y: newY });
  }, [isDragging, isExpanded]);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);

    // Detectar swipe para baixo (distância > 100px)
    const deltaY = positionRef.current.y - dragStartPosRef.current.y;
    if (deltaY > SWIPE_DOWN_THRESHOLD) {
      // Swipe down - fechar
      onClose();
      return;
    }
    snapToEdge();
  }, [isDragging, snapToEdge, onClose]);

  // Event listeners globais para arrasto (mouse)
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove, { passive: true });
      window.addEventListener('touchend', handleTouchEnd);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

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

  // Calcular região do mapa
  const getRegion = useCallback(() => {
    if (userLocation && destination) {
      const minLat = Math.min(userLocation.latitude, destination.latitude);
      const maxLat = Math.max(userLocation.latitude, destination.latitude);
      const minLon = Math.min(userLocation.longitude, destination.longitude);
      const maxLon = Math.max(userLocation.longitude, destination.longitude);

      return {
        lat: (minLat + maxLat) / 2,
        lng: (minLon + maxLon) / 2,
      };
    }

    if (userLocation) {
      return {
        lat: userLocation.latitude,
        lng: userLocation.longitude,
      };
    }

    if (destination) {
      return {
        lat: destination.latitude,
        lng: destination.longitude,
      };
    }

    return { lat: -23.5505, lng: -46.6333 }; // São Paulo default
  }, [userLocation, destination]);

  // Calcular zoom
  const getZoom = useCallback(() => {
    if (userLocation && destination) {
      const latDiff = Math.abs(userLocation.latitude - destination.latitude);
      const lngDiff = Math.abs(userLocation.longitude - destination.longitude);
      const maxDiff = Math.max(latDiff, lngDiff);

      if (maxDiff > 0.1) return 12;
      if (maxDiff > 0.05) return 13;
      if (maxDiff > 0.02) return 14;
      return 15;
    }
    return 15;
  }, [userLocation, destination]);

  // Abrir Google Maps externo
  const openGoogleMaps = useCallback(() => {
    if (!destination) return;

    const origin = userLocation
      ? `${userLocation.latitude},${userLocation.longitude}`
      : '';

    const dest = `${destination.latitude},${destination.longitude}`;
    const url = `https://www.google.com/maps/dir/?api=1${origin ? `&origin=${origin}` : ''}&destination=${dest}&travelmode=driving`;

    if (typeof window !== 'undefined') {
      window.open(url, '_blank');
    }
  }, [userLocation, destination]);

  // Callback para offset do overlay
  const getOverlayOffset = useCallback((width: number, height: number) => ({
    x: -(width / 2),
    y: -(height / 2),
  }), []);

  if (!visible || !destination) return null;

  const center = getRegion();
  const zoom = getZoom();

  // Estado de erro ou carregando
  if (loadError) {
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
        <View style={[styles.container, { width: currentWidth, height: currentHeight }]}>
          <View style={styles.fallbackContainer}>
            <Ionicons name="map-outline" size={32} color={theme.colors.gray400} />
            <Text style={styles.fallbackText}>Mapa indisponível</Text>
            <TouchableOpacity style={styles.openMapsButton} onPress={openGoogleMaps}>
              <Ionicons name="open-outline" size={16} color={theme.colors.primary} />
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

  if (!isLoaded) {
    return (
      <div
        style={{
          position: 'fixed',
          left: position.x,
          top: position.y,
          width: currentWidth,
          height: currentHeight,
          zIndex: 9999,
        }}
      >
        <View style={[styles.container, styles.loadingContainer, { width: currentWidth, height: currentHeight }]}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Carregando mapa...</Text>
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
      <View style={[styles.container, { width: currentWidth, height: currentHeight }]}>
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

        {/* Mapa Google */}
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={center}
          zoom={zoom}
          onLoad={() => setMapReady(true)}
          options={{
            disableDefaultUI: true,
            zoomControl: isExpanded,
            scrollwheel: isExpanded,
            draggable: isExpanded,
            clickableIcons: false,
            gestureHandling: isExpanded ? 'auto' : 'none',
            mapId: GOOGLE_MAPS_MAP_ID || undefined,
          }}
        >
          {/* Polyline da rota real via OSRM */}
          {mapReady && routePath.length >= 2 && (
            <Polyline
              path={routePath.map(coord => ({ lat: coord.latitude, lng: coord.longitude }))}
              options={{
                strokeColor: theme.colors.primary,
                strokeWeight: 4,
                strokeOpacity: 1,
                geodesic: true,
              }}
            />
          )}

          {/* Marker do usuário */}
          {userLocation && (
            <OverlayView
              position={{ lat: userLocation.latitude, lng: userLocation.longitude }}
              mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
              getPixelPositionOffset={getOverlayOffset}
            >
              {userHeading !== undefined ? (
                // Seta direcional quando heading disponível
                <View
                  style={[
                    styles.userDirectionMarker,
                    { transform: [{ rotate: `${userHeading}deg` }] },
                  ]}
                  pointerEvents="none"
                >
                  <Ionicons name="navigate" size={20} color={theme.colors.info} />
                </View>
              ) : (
                // Ponto azul padrão
                <View style={styles.userMarker} pointerEvents="none">
                  <View style={styles.userMarkerDot} />
                </View>
              )}
            </OverlayView>
          )}

          {/* Marker do destino */}
          {destination && (
            <OverlayView
              position={{ lat: destination.latitude, lng: destination.longitude }}
              mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
              getPixelPositionOffset={getOverlayOffset}
            >
              <View style={styles.destinationMarker} pointerEvents="none">
                <Ionicons name="location" size={20} color={theme.colors.error} />
              </View>
            </OverlayView>
          )}
        </GoogleMap>

        {/* Loading overlay */}
        {!mapReady && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
          </View>
        )}

        {/* Navigation Instruction - apenas quando colapsado e há instrução */}
        {!isExpanded && nextInstruction && (
          <View style={styles.instructionBar}>
            <Ionicons name="compass-outline" size={14} color={theme.colors.white} />
            <Text style={styles.instructionText} numberOfLines={1}>
              {nextInstruction}
            </Text>
          </View>
        )}

        {/* Progress Badge - apenas quando colapsado e há progresso */}
        {!isExpanded && progress && (
          <View style={[styles.progressBadge, nextInstruction && styles.progressBadgeWithInstruction]}>
            <Ionicons name="checkmark-circle-outline" size={12} color={theme.colors.white} />
            <Text style={styles.progressText}>
              {currentStopOrder ?? progress.completed + 1} de {progress.total}
            </Text>
          </View>
        )}

        {/* ETA Badge - apenas quando colapsado */}
        {!isExpanded && routeInfo && (
          <View
            style={[
              styles.etaBadge,
              isNearDestination && styles.etaBadgePulse,
            ]}
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
