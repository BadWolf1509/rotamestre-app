/**
 * PictureInPictureMap - Floating Mini Map Component (Native)
 *
 * A draggable, expandable mini-map overlay that shows the user's current
 * location and destination during navigation. Optimized for React Native.
 *
 * @see PictureInPictureMap.web.tsx for web version
 * @see usePiPRouteInfo for route calculation logic
 * @see usePiPPosition for position persistence
 */

import { Ionicons } from '@expo/vector-icons';
import * as MapLibreGL from '@maplibre/maplibre-react-native';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef, useMemo, useState } from 'react';
import {
  Animated,
  TouchableOpacity,
  View,
  Text,
  useWindowDimensions,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  EDGE_PADDING,
  MIN_SAFE_TOP_POSITION,
  PIP_WIDTH,
  usePiPRouteInfo,
} from '@/hooks/navigation';
import type { PictureInPictureMapProps } from '@/hooks/navigation';
import { usePiPAnimation } from '@/hooks/navigation/pip/usePiPAnimation';
import { usePiPGestures } from '@/hooks/navigation/pip/usePiPGestures';
import { usePiPPositioning } from '@/hooks/navigation/pip/usePiPPositioning';
import { usePiPPulse } from '@/hooks/navigation/pip/usePiPPulse';
import { usePiPPosition } from '@/hooks/usePiPPosition';
import {
  OPENFREEMAP_STYLE_URL,
  toLineString,
  toLngLat,
  zoomFromLongitudeDelta,
} from '@/lib/maplibre';
import { withOpacity } from '@/utils/color';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

import type { CameraRef } from '@maplibre/maplibre-react-native';

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
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { savedPosition, savePosition } = usePiPPosition();
  const cameraRef = useRef<CameraRef>(null);
  const [mapLoading, setMapLoading] = useState(true);

  // Expanded dimensions (reactive to rotation/split-screen)
  const expandedWidth = useMemo(() => screenWidth * 0.9, [screenWidth]);
  const expandedHeight = useMemo(() => screenHeight * 0.4, [screenHeight]);

  // Initial position (use saved or default to top-right corner)
  const initialPosition = useMemo(() => {
    const safeTop = insets.top + 10;
    const defaultX = screenWidth - PIP_WIDTH - EDGE_PADDING;
    const defaultY = Math.max(safeTop, MIN_SAFE_TOP_POSITION);
    if (!savedPosition) return { x: defaultX, y: defaultY };
    return {
      x: Math.max(
        EDGE_PADDING,
        Math.min(savedPosition.x, screenWidth - PIP_WIDTH - EDGE_PADDING),
      ),
      y: Math.max(safeTop, Math.min(savedPosition.y, defaultY)),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only compute once on mount

  // Position tracking ref
  const currentPositionRef = useRef(initialPosition);

  // Temporary safeTopBoundRef for animation hook (will be overwritten by positioning hook)
  const tempSafeTopRef = useRef(insets.top + 10);

  // Animation hook (pan, opacity, expand/collapse)
  const {
    pan,
    animatedWidth,
    animatedHeight,
    opacity,
    isExpanded,
    isExpandedRef,
    toggleExpand,
    toggleExpandRef,
  } = usePiPAnimation({
    initialPosition,
    screenWidth,
    screenHeight,
    expandedWidth,
    expandedHeight,
    safeTopBoundRef: tempSafeTopRef,
    visible,
  });

  // Refs for PanResponder closures
  const savePositionRef = useRef(savePosition);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    savePositionRef.current = savePosition;
  }, [savePosition]);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Positioning hook (safe bounds, collision avoidance, rotation handling)
  const { safeTopBoundRef, safeBottomBoundRef } = usePiPPositioning({
    insets,
    screenWidth,
    screenHeight,
    expandedWidth,
    expandedHeight,
    pan,
    animatedWidth,
    animatedHeight,
    visible,
    savedPosition,
    avoidAreas,
    isExpandedRef,
    currentPositionRef,
    savePositionRef,
  });

  // Keep animation hook's safeTopBoundRef in sync
  useEffect(() => {
    tempSafeTopRef.current = safeTopBoundRef.current;
  }, [safeTopBoundRef]);

  // Gesture hook (PanResponder: drag, double-tap, swipe-down, snap)
  const { panResponder, isDragging } = usePiPGestures({
    pan,
    currentPositionRef,
    isExpandedRef,
    toggleExpandRef,
    savePositionRef,
    onCloseRef,
    safeTopBoundRef,
    safeBottomBoundRef,
    screenWidth,
    screenHeight,
  });

  // Route info and proximity detection
  const { routeInfo, isNearDestination, routePath } = usePiPRouteInfo({
    visible,
    userLocation,
    destination,
  });

  const routeShape = useMemo(
    () => (routePath.length >= 2 ? toLineString(routePath) : null),
    [routePath],
  );

  // Pulse animation when near destination
  const pulseAnim = usePiPPulse(isNearDestination, isExpanded);

  // Close handler with haptic
  const handleClose = () => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    onClose();
  };

  // Camera/region calculation
  const region = useMemo(() => {
    if (userLocation && destination) {
      const minLat = Math.min(userLocation.latitude, destination.latitude);
      const maxLat = Math.max(userLocation.latitude, destination.latitude);
      const minLon = Math.min(userLocation.longitude, destination.longitude);
      const maxLon = Math.max(userLocation.longitude, destination.longitude);
      return {
        latitude: (minLat + maxLat) / 2,
        longitude: (minLon + maxLon) / 2,
        latitudeDelta: Math.max(0.01, (maxLat - minLat) * 1.5),
        longitudeDelta: Math.max(0.01, (maxLon - minLon) * 1.5),
      };
    }
    if (userLocation) {
      return {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }
    return null;
  }, [userLocation, destination]);

  const cameraSettings = useMemo<MapLibreGL.CameraStop | null>(() => {
    if (!region) return null;
    return {
      center: toLngLat({
        latitude: region.latitude,
        longitude: region.longitude,
      }),
      zoom: zoomFromLongitudeDelta(region.longitudeDelta),
      duration: 500,
    };
  }, [region]);

  if (!visible || !region) return null;

  return (
    <Animated.View
      testID="pip-map-container"
      style={[
        styles.container,
        {
          width: animatedWidth,
          height: animatedHeight,
          transform: [{ translateX: pan.x }, { translateY: pan.y }],
          opacity,
        },
      ]}
      {...panResponder.panHandlers}
    >
      {/* Map */}
      <MapLibreGL.Map
        testID="pip-map-view"
        style={[styles.map, { pointerEvents: isExpanded ? 'auto' : 'none' }]}
        mapStyle={OPENFREEMAP_STYLE_URL}
        touchRotate={false}
        touchPitch={false}
        dragPan={isExpanded}
        touchZoom={isExpanded}
        compass={false}
        logo={false}
        attribution={true}
        onDidFinishLoadingMap={() => setMapLoading(false)}
      >
        {cameraSettings && (
          <MapLibreGL.Camera ref={cameraRef} {...cameraSettings} />
        )}

        {routeShape && (
          <MapLibreGL.GeoJSONSource id="rota-pip" data={routeShape}>
            <MapLibreGL.Layer
              id="rota-pip-line"
              type="line"
              paint={{ 'line-color': theme.colors.primary, 'line-width': 4 }}
            />
          </MapLibreGL.GeoJSONSource>
        )}

        {userLocation && userHeading !== undefined && (
          <MapLibreGL.Marker lngLat={toLngLat(userLocation)} anchor="center">
            <View
              style={[
                styles.userDirectionMarker,
                { transform: [{ rotate: `${userHeading}deg` }] },
              ]}
            >
              <Ionicons name="navigate" size={20} color={theme.colors.info} />
            </View>
          </MapLibreGL.Marker>
        )}

        {userLocation && userHeading === undefined && (
          <MapLibreGL.Marker lngLat={toLngLat(userLocation)} anchor="center">
            <View style={styles.userLocationMarker} />
          </MapLibreGL.Marker>
        )}

        {destination && (
          <MapLibreGL.Marker lngLat={toLngLat(destination)} anchor="center">
            <View style={styles.destinationMarker}>
              <Ionicons name="location" size={20} color={theme.colors.error} />
            </View>
          </MapLibreGL.Marker>
        )}
      </MapLibreGL.Map>

      {/* Drag overlay (covers map when collapsed to allow drag) */}
      {!isExpanded && (
        <View testID="pip-drag-overlay" style={styles.dragOverlay} />
      )}

      {/* Loading overlay */}
      {mapLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
        </View>
      )}

      {/* Navigation Instruction */}
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

      {/* Progress Badge */}
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

      {/* ETA Badge */}
      {!isExpanded && routeInfo && (
        <Animated.View
          style={[
            styles.etaBadge,
            isNearDestination && { transform: [{ scale: pulseAnim }] },
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
        </Animated.View>
      )}

      {/* Controls overlay */}
      <View style={[styles.controls, { pointerEvents: 'box-none' }]}>
        <TouchableOpacity
          testID="pip-expand-button"
          style={[styles.controlButton, isExpanded && styles.collapseButton]}
          onPress={toggleExpand}
          activeOpacity={0.8}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel={isExpanded ? 'Minimizar mapa' : 'Expandir mapa'}
          accessibilityRole="button"
        >
          <Ionicons
            name={isExpanded ? 'contract' : 'expand'}
            size={18}
            color={theme.colors.white}
          />
        </TouchableOpacity>

        {isExpanded && (
          <TouchableOpacity
            testID="pip-navigate-button"
            style={[styles.controlButton, styles.navigateButton]}
            onPress={onExpand}
            activeOpacity={0.8}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Abrir navegação completa"
            accessibilityRole="button"
          >
            <Ionicons name="navigate" size={18} color={theme.colors.white} />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          testID="pip-close-button"
          style={[styles.controlButton, styles.closeButton]}
          onPress={handleClose}
          activeOpacity={0.8}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Fechar mapa"
          accessibilityRole="button"
        >
          <Ionicons name="close" size={18} color={theme.colors.white} />
        </TouchableOpacity>
      </View>

      {/* Drag indicator (only when collapsed) */}
      {!isExpanded && !isDragging && (
        <View style={styles.dragIndicator}>
          <View style={styles.dragBar} />
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    position: 'absolute',
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 999,
  },
  map: {
    flex: 1,
  },
  dragOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    zIndex: 5,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: withOpacity(theme.colors.white, 0.8),
    justifyContent: 'center',
    alignItems: 'center',
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
    zIndex: 15,
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
    alignItems: 'center',
    gap: theme.spacing['1'],
    zIndex: 10,
  },
  progressBadgeWithInstruction: {
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
    alignItems: 'center',
    gap: theme.spacing['1'],
    zIndex: 10,
  },
  etaText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.white,
    fontWeight: '600',
  },
  controls: {
    position: 'absolute',
    top: theme.spacing['2'],
    right: theme.spacing['2'],
    flexDirection: 'row',
    gap: theme.spacing['2'],
    zIndex: 20,
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
  dragIndicator: {
    position: 'absolute',
    bottom: 4,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
    pointerEvents: 'none',
  },
  dragBar: {
    width: 30,
    height: 3,
    borderRadius: 2,
    backgroundColor: withOpacity(theme.colors.black, 0.3),
  },
  destinationMarker: {
    backgroundColor: theme.colors.white,
    borderRadius: 15,
    padding: theme.spacing['1'],
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
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
    elevation: 5,
  },
  userLocationMarker: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: withOpacity(theme.colors.info, 0.35),
    borderWidth: 2,
    borderColor: theme.colors.white,
  },
}));
