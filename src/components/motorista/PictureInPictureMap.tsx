import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  Animated,
  PanResponder,
  TouchableOpacity,
  View,
  Text,
  useWindowDimensions,
  ActivityIndicator,
  Platform,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { withOpacity } from '@/utils/color';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

// PiP dimensions (constantes base) - Unificado entre plataformas
const PIP_WIDTH = 140;
const PIP_HEIGHT = 200;
const EDGE_PADDING = 16;

interface PictureInPictureMapProps {
  visible: boolean;
  userLocation: { latitude: number; longitude: number } | null;
  destination: { latitude: number; longitude: number; address: string } | null;
  onClose: () => void;
  onExpand: () => void;
}

// Altura base da Tab Bar (sem safe area)
const TAB_BAR_BASE_HEIGHT = 60;

// Velocidade média urbana para estimativa de tempo (km/h)
const AVERAGE_URBAN_SPEED_KMH = 30;

/**
 * Calcula a distância em km entre dois pontos usando fórmula Haversine
 */
function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Raio da Terra em km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function PictureInPictureMap({
  visible,
  userLocation,
  destination,
  onClose,
  onExpand,
}: PictureInPictureMapProps) {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // Dimensões calculadas dinamicamente (reativas a rotação/split-screen)
  const expandedWidth = useMemo(() => screenWidth * 0.9, [screenWidth]);
  const expandedHeight = useMemo(() => screenHeight * 0.4, [screenHeight]);

  // Refs para bounds seguros (atualizados quando insets ou dimensões mudam)
  // Usa Math.max para garantir mínimo de 34px (Android 15 pode retornar insets.bottom = 0)
  const safeTopBoundRef = useRef(insets.top + 10);
  const safeBottomBoundRef = useRef(screenHeight - PIP_HEIGHT - TAB_BAR_BASE_HEIGHT - Math.max(insets.bottom, 34) - EDGE_PADDING);

  // Atualizar refs quando insets ou dimensões mudarem
  useEffect(() => {
    safeTopBoundRef.current = insets.top + 10;
    safeBottomBoundRef.current = screenHeight - PIP_HEIGHT - TAB_BAR_BASE_HEIGHT - Math.max(insets.bottom, 34) - EDGE_PADDING;
  }, [insets.top, insets.bottom, screenHeight]);

  // Posição inicial (canto inferior direito)
  const initialX = screenWidth - PIP_WIDTH - EDGE_PADDING;
  const initialY = Math.max(safeTopBoundRef.current, 100);

  // Ref para rastrear posição atual (evita acessar _value interno)
  const currentPositionRef = useRef({ x: initialX, y: initialY });

  // Animation values
  const pan = useRef(new Animated.ValueXY({
    x: initialX,
    y: initialY,
  })).current;
  const animatedWidth = useRef(new Animated.Value(PIP_WIDTH)).current;
  const animatedHeight = useRef(new Animated.Value(PIP_HEIGHT)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  // State
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [mapLoading, setMapLoading] = useState(true);

  // Calcular distância e tempo estimado até o destino
  const routeInfo = useMemo(() => {
    if (!userLocation || !destination) return null;

    const distanceKm = calculateDistanceKm(
      userLocation.latitude,
      userLocation.longitude,
      destination.latitude,
      destination.longitude
    );

    // Estimar tempo baseado em velocidade média urbana
    const estimatedMinutes = Math.ceil((distanceKm / AVERAGE_URBAN_SPEED_KMH) * 60);

    return {
      distanceKm,
      estimatedMinutes,
      // Formatar para exibição
      distanceText: distanceKm < 1
        ? `${Math.round(distanceKm * 1000)} m`
        : `${distanceKm.toFixed(1)} km`,
      timeText: estimatedMinutes < 60
        ? `${estimatedMinutes} min`
        : `${Math.floor(estimatedMinutes / 60)}h${estimatedMinutes % 60}`,
    };
  }, [userLocation, destination]);

  // Ref para isExpanded (necessário para PanResponder que captura closure)
  const isExpandedRef = useRef(isExpanded);
  useEffect(() => {
    isExpandedRef.current = isExpanded;
  }, [isExpanded]);

  // Atualizar posição quando dimensões mudarem (rotação)
  useEffect(() => {
    if (!isExpandedRef.current) {
      // Reposicionar no canto direito após rotação
      const newX = screenWidth - PIP_WIDTH - EDGE_PADDING;
      const newY = Math.max(safeTopBoundRef.current, Math.min(currentPositionRef.current.y, safeBottomBoundRef.current));
      pan.setValue({ x: newX, y: newY });
      currentPositionRef.current = { x: newX, y: newY };
    } else {
      // Recentralizar se expandido
      const centerX = (screenWidth - expandedWidth) / 2;
      const centerY = (screenHeight - expandedHeight) / 2;
      pan.setValue({ x: centerX, y: centerY });
      animatedWidth.setValue(expandedWidth);
      animatedHeight.setValue(expandedHeight);
    }
  }, [screenWidth, screenHeight, expandedWidth, expandedHeight, pan, animatedWidth, animatedHeight]);

  // Listener para rastrear posição atual
  useEffect(() => {
    const listenerId = pan.addListener((value) => {
      currentPositionRef.current = value;
    });
    return () => {
      pan.removeListener(listenerId);
    };
  }, [pan]);

  // Refs para dimensões da tela (necessário para PanResponder que captura closure)
  const screenWidthRef = useRef(screenWidth);
  const screenHeightRef = useRef(screenHeight);
  useEffect(() => {
    screenWidthRef.current = screenWidth;
    screenHeightRef.current = screenHeight;
  }, [screenWidth, screenHeight]);

  // Pan responder for dragging
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !isExpandedRef.current,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Só capturar se houver movimento significativo e não estiver expandido
        return !isExpandedRef.current && (Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2);
      },
      onPanResponderGrant: () => {
        setIsDragging(true);
        // Haptic feedback ao iniciar drag
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        // Salvar posição atual como offset antes de começar o drag
        pan.setOffset({
          x: currentPositionRef.current.x,
          y: currentPositionRef.current.y,
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false } // Deve ser false pois width/height no mesmo View não suportam native driver
      ),
      onPanResponderRelease: (_, gestureState) => {
        setIsDragging(false);
        // Consolidar offset com valor atual
        pan.flattenOffset();

        // Haptic feedback ao soltar (snap)
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }

        // Snap to edges (usando refs para valores atualizados)
        const currentScreenWidth = screenWidthRef.current;
        const finalX = gestureState.moveX < currentScreenWidth / 2
          ? EDGE_PADDING
          : currentScreenWidth - PIP_WIDTH - EDGE_PADDING;

        // Keep within screen bounds (usando refs para valores atualizados de safe area)
        const finalY = Math.max(
          safeTopBoundRef.current, // Abaixo da status bar
          Math.min(
            safeBottomBoundRef.current, // Acima da tab bar + navigation bar
            gestureState.moveY - PIP_HEIGHT / 2
          )
        );

        Animated.spring(pan, {
          toValue: { x: finalX, y: finalY },
          useNativeDriver: false,
          tension: 40,
          friction: 8,
        }).start();
      },
    })
  ).current;

  // Show/hide animation
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 300,
      useNativeDriver: false, // Deve ser false pois width/height no mesmo View não suportam native driver
    }).start();
  }, [opacity, visible]);

  // Toggle expansion
  const toggleExpand = () => {
    // Haptic feedback ao expandir/colapsar
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);

    if (newExpanded) {
      // Expand to center
      Animated.parallel([
        Animated.spring(pan, {
          toValue: {
            x: (screenWidth - expandedWidth) / 2,
            y: (screenHeight - expandedHeight) / 2,
          },
          useNativeDriver: false,
          tension: 40,
          friction: 8,
        }),
        Animated.spring(animatedWidth, {
          toValue: expandedWidth,
          useNativeDriver: false,
          tension: 40,
          friction: 8,
        }),
        Animated.spring(animatedHeight, {
          toValue: expandedHeight,
          useNativeDriver: false,
          tension: 40,
          friction: 8,
        }),
      ]).start();
    } else {
      // Collapse to corner (usando safe bounds)
      Animated.parallel([
        Animated.spring(pan, {
          toValue: {
            x: screenWidth - PIP_WIDTH - EDGE_PADDING,
            y: Math.max(safeTopBoundRef.current, 100),
          },
          useNativeDriver: false,
          tension: 40,
          friction: 8,
        }),
        Animated.spring(animatedWidth, {
          toValue: PIP_WIDTH,
          useNativeDriver: false,
          tension: 40,
          friction: 8,
        }),
        Animated.spring(animatedHeight, {
          toValue: PIP_HEIGHT,
          useNativeDriver: false,
          tension: 40,
          friction: 8,
        }),
      ]).start();
    }
  };

  // Handler para fechar com haptic
  const handleClose = () => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    onClose();
  };

  // Calculate region
  const getRegion = () => {
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
  };

  const region = getRegion();

  if (!visible || !region) return null;

  return (
    <Animated.View
      testID="pip-map-container"
      style={[
        styles.container,
        {
          width: animatedWidth,
          height: animatedHeight,
          transform: [
            { translateX: pan.x },
            { translateY: pan.y },
          ],
          opacity,
        },
      ]}
      {...panResponder.panHandlers}
    >
      {/* Map */}
      <MapView
        testID="pip-map-view"
        style={[styles.map, { pointerEvents: isExpanded ? 'auto' : 'none' }]}
        provider={PROVIDER_GOOGLE}
        region={region}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        rotateEnabled={false}
        scrollEnabled={isExpanded}
        zoomEnabled={isExpanded}
        toolbarEnabled={false}
        onMapReady={() => setMapLoading(false)}
      >
        {/* Polyline conectando usuário ao destino */}
        {userLocation && destination && (
          <Polyline
            coordinates={[
              { latitude: userLocation.latitude, longitude: userLocation.longitude },
              { latitude: destination.latitude, longitude: destination.longitude },
            ]}
            strokeColor={theme.colors.primary}
            strokeWidth={3}
            lineDashPattern={[10, 5]}
          />
        )}

        {destination && (
          <Marker
            coordinate={destination}
            title={destination.address}
            tracksViewChanges={false}
          >
            <View style={styles.destinationMarker}>
              <Ionicons name="location" size={20} color={theme.colors.error} />
            </View>
          </Marker>
        )}
      </MapView>

      {/* Loading overlay */}
      {mapLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
        </View>
      )}

      {/* ETA Badge - apenas quando colapsado */}
      {!isExpanded && routeInfo && (
        <View style={styles.etaBadge}>
          <Ionicons name="navigate-outline" size={12} color={theme.colors.white} />
          <Text style={styles.etaText}>
            {routeInfo.distanceText} • {routeInfo.timeText}
          </Text>
        </View>
      )}

      {/* Controls overlay */}
      <View style={[styles.controls, { pointerEvents: 'box-none' }]}>
        {/* Expand/Collapse button */}
        <TouchableOpacity
          testID="pip-expand-button"
          style={[
            styles.controlButton,
            isExpanded && styles.collapseButton,
          ]}
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

        {/* Open full navigation button (only when expanded) */}
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

        {/* Close button */}
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
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: withOpacity(theme.colors.white, 0.8),
    justifyContent: 'center',
    alignItems: 'center',
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
}));
