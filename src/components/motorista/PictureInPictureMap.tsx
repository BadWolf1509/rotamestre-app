/**
 * PictureInPictureMap - Floating Mini Map Component (Native)
 *
 * A draggable, expandable mini-map overlay that shows the user's current
 * location and destination during navigation. Optimized for React Native.
 *
 * ## Features
 * - **Draggable**: Snap to left/right edges with spring animation
 * - **Expandable**: Double-tap or button to expand to 90% width
 * - **Swipe to close**: Quick swipe down dismisses the PiP
 * - **Haptic feedback**: Touch feedback on all interactions
 * - **Position persistence**: Remembers last position across sessions
 * - **Collision avoidance**: Auto-repositions to avoid FABs/bottom sheets
 * - **Real-time route**: Shows OSRM route polyline
 * - **ETA display**: Distance and time to destination
 * - **Pulse animation**: Pulses when near destination (<100m)
 *
 * ## Gestures
 * - **Tap**: No action (allows map interaction when expanded)
 * - **Double-tap**: Toggle expand/collapse
 * - **Drag**: Move PiP, snaps to nearest edge on release
 * - **Swipe down**: Close PiP (velocity > 1.5, distance > 50px)
 *
 * ## Performance
 * - Uses Animated API with spring physics
 * - Refs for stable closures in PanResponder
 * - Memoized calculations for route shape
 * - Safe area aware positioning
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
 *   currentStopOrder={3}
 *   stopType="entrega"
 * />
 * ```
 *
 * @see PictureInPictureMap.web.tsx for web version
 * @see usePiPRouteInfo for route calculation logic
 * @see usePiPPosition for position persistence
 */

import { Ionicons } from '@expo/vector-icons';
import MapLibreGL, { type CameraRef } from '@maplibre/maplibre-react-native';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ANDROID_MIN_NAV_BAR_HEIGHT,
  DOUBLE_TAP_DELAY,
  EDGE_PADDING,
  MIN_SAFE_TOP_POSITION,
  OPACITY_ANIMATION_DURATION,
  PIP_HEIGHT,
  PIP_WIDTH,
  SWIPE_VELOCITY_THRESHOLD,
  TAB_BAR_BASE_HEIGHT,
  usePiPRouteInfo,
} from '@/hooks/navigation';
import type { PictureInPictureMapProps } from '@/hooks/navigation';
import { usePiPPosition } from '@/hooks/usePiPPosition';
import { MAPLIBRE_RASTER_STYLE, toLineString, toLngLat, zoomFromLongitudeDelta } from '@/lib/maplibre';
import { withOpacity } from '@/utils/color';
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
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { savedPosition, savePosition } = usePiPPosition();
  const cameraRef = useRef<CameraRef>(null);

  // Dimensões calculadas dinamicamente (reativas a rotação/split-screen)
  const expandedWidth = useMemo(() => screenWidth * 0.9, [screenWidth]);
  const expandedHeight = useMemo(() => screenHeight * 0.4, [screenHeight]);

  // Refs para bounds seguros (atualizados quando insets ou dimensões mudam)
  // Usa Math.max para garantir mínimo (Android 15 pode retornar insets.bottom = 0)
  const safeTopBoundRef = useRef(insets.top + 10);
  const safeBottomBoundRef = useRef(screenHeight - PIP_HEIGHT - TAB_BAR_BASE_HEIGHT - Math.max(insets.bottom, ANDROID_MIN_NAV_BAR_HEIGHT) - EDGE_PADDING);

  // Atualizar refs quando insets ou dimensões mudarem
  useEffect(() => {
    safeTopBoundRef.current = insets.top + 10;
    safeBottomBoundRef.current = screenHeight - PIP_HEIGHT - TAB_BAR_BASE_HEIGHT - Math.max(insets.bottom, ANDROID_MIN_NAV_BAR_HEIGHT) - EDGE_PADDING;
  }, [insets.top, insets.bottom, screenHeight]);

  // Posição inicial (usa posição salva ou canto superior direito)
  const defaultX = screenWidth - PIP_WIDTH - EDGE_PADDING;
  const defaultY = Math.max(safeTopBoundRef.current, MIN_SAFE_TOP_POSITION);
  // Usa posição salva se disponível e válida para as dimensões atuais
  const initialX = savedPosition
    ? Math.max(EDGE_PADDING, Math.min(savedPosition.x, screenWidth - PIP_WIDTH - EDGE_PADDING))
    : defaultX;
  const initialY = savedPosition
    ? Math.max(safeTopBoundRef.current, Math.min(savedPosition.y, safeBottomBoundRef.current))
    : defaultY;

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
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // State
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [mapLoading, setMapLoading] = useState(true);

  // Use shared hook for route info and OSRM route fetching
  const { routeInfo, isNearDestination, routePath } = usePiPRouteInfo({
    visible,
    userLocation,
    destination,
  });

  const routeShape = useMemo(
    () => (routePath.length >= 2 ? toLineString(routePath) : null),
    [routePath]
  );
  useEffect(() => {
    if (isNearDestination && !isExpanded) {
      // Iniciar animação de pulso
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 500,
            useNativeDriver: false,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: false,
          }),
        ])
      );
      pulseAnimation.start();
      // Haptic feedback de sucesso ao chegar perto
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      return () => pulseAnimation.stop();
    } else {
      // Reset animação
      pulseAnim.setValue(1);
    }
  }, [isNearDestination, isExpanded, pulseAnim]);

  // Ref para isExpanded (necessário para PanResponder que captura closure)
  const isExpandedRef = useRef(isExpanded);
  // Ref para detectar double-tap
  const lastTapRef = useRef<number>(0);
  // Ref para toggleExpand (necessário para PanResponder que captura closure)
  const toggleExpandRef = useRef<() => void>(() => {});
  // Ref para savePosition (necessário para PanResponder que captura closure)
  const savePositionRef = useRef(savePosition);
  // Ref para onClose (necessário para PanResponder que captura closure)
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    isExpandedRef.current = isExpanded;
  }, [isExpanded]);
  useEffect(() => {
    savePositionRef.current = savePosition;
  }, [savePosition]);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Atualizar posição quando a posição salva for carregada
  useEffect(() => {
    if (savedPosition && !isExpandedRef.current) {
      const validX = Math.max(EDGE_PADDING, Math.min(savedPosition.x, screenWidth - PIP_WIDTH - EDGE_PADDING));
      const validY = Math.max(safeTopBoundRef.current, Math.min(savedPosition.y, safeBottomBoundRef.current));
      pan.setValue({ x: validX, y: validY });
      currentPositionRef.current = { x: validX, y: validY };
    }
  }, [savedPosition, pan, screenWidth]);

  // Auto-reposicionamento para evitar colisão com avoidAreas
  useEffect(() => {
    if (!avoidAreas || avoidAreas.length === 0 || isExpandedRef.current || !visible) return;

    const currentX = currentPositionRef.current.x;
    const currentY = currentPositionRef.current.y;
    const pipRight = currentX + PIP_WIDTH;
    const pipBottom = currentY + PIP_HEIGHT;

    // Verificar colisão com cada área
    const hasCollision = avoidAreas.some(area => {
      const areaRight = area.x + area.width;
      const areaBottom = area.y + area.height;
      return !(pipRight < area.x || currentX > areaRight || pipBottom < area.y || currentY > areaBottom);
    });

    if (hasCollision) {
      // Calcular posições seguras (4 cantos)
      const safePositions = [
        { x: EDGE_PADDING, y: safeTopBoundRef.current }, // Superior esquerdo
        { x: screenWidth - PIP_WIDTH - EDGE_PADDING, y: safeTopBoundRef.current }, // Superior direito
        { x: EDGE_PADDING, y: safeBottomBoundRef.current }, // Inferior esquerdo
        { x: screenWidth - PIP_WIDTH - EDGE_PADDING, y: safeBottomBoundRef.current }, // Inferior direito
      ];

      // Encontrar posição segura mais próxima que não colida
      let bestPosition = safePositions[1]; // Fallback: superior direito
      let minDistance = Infinity;

      for (const pos of safePositions) {
        const posRight = pos.x + PIP_WIDTH;
        const posBottom = pos.y + PIP_HEIGHT;

        // Verificar se essa posição colide
        const wouldCollide = avoidAreas.some(area => {
          const areaRight = area.x + area.width;
          const areaBottom = area.y + area.height;
          return !(posRight < area.x || pos.x > areaRight || posBottom < area.y || pos.y > areaBottom);
        });

        if (!wouldCollide) {
          const distance = Math.sqrt(
            Math.pow(pos.x - currentX, 2) + Math.pow(pos.y - currentY, 2)
          );
          if (distance < minDistance) {
            minDistance = distance;
            bestPosition = pos;
          }
        }
      }

      // Animar para posição segura
      Animated.spring(pan, {
        toValue: bestPosition,
        useNativeDriver: false,
        tension: 40,
        friction: 8,
      }).start(() => {
        currentPositionRef.current = bestPosition;
        savePositionRef.current(bestPosition);
      });
    }
  }, [avoidAreas, visible, pan, screenWidth]);

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
        const now = Date.now();
        // Detectar double-tap para expandir
        if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
          // Double-tap detectado - expandir
          if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
          toggleExpandRef.current();
          lastTapRef.current = 0; // Reset para evitar triple-tap
          return;
        }
        lastTapRef.current = now;

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

        // Detectar swipe para baixo rápido (velocidade > threshold e distância > 50px)
        if (gestureState.vy > SWIPE_VELOCITY_THRESHOLD && gestureState.dy > 50) {
          // Swipe down - fechar com animação
          if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          }
          Animated.timing(pan.y, {
            toValue: screenHeightRef.current + PIP_HEIGHT,
            duration: 200,
            useNativeDriver: false,
          }).start(() => {
            onCloseRef.current();
          });
          return;
        }

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
        }).start(() => {
          // Persistir posição após snap
          savePositionRef.current({ x: finalX, y: finalY });
        });
      },
    })
  ).current;

  // Show/hide animation
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: OPACITY_ANIMATION_DURATION,
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
            y: Math.max(safeTopBoundRef.current, MIN_SAFE_TOP_POSITION),
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

  // Atualizar ref do toggleExpand para PanResponder
  useEffect(() => {
    toggleExpandRef.current = toggleExpand;
  });

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
  const cameraSettings = useMemo(() => {
    if (!region) return null;
    return {
      centerCoordinate: toLngLat({
        latitude: region.latitude,
        longitude: region.longitude,
      }),
      zoomLevel: zoomFromLongitudeDelta(region.longitudeDelta),
      animationDuration: 500,
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
      <MapLibreGL.MapView
        testID="pip-map-view"
        style={[styles.map, { pointerEvents: isExpanded ? 'auto' : 'none' }]}
        mapStyle={MAPLIBRE_RASTER_STYLE}
        rotateEnabled={false}
        pitchEnabled={false}
        scrollEnabled={isExpanded}
        zoomEnabled={isExpanded}
        compassEnabled={false}
        logoEnabled={false}
        attributionEnabled={false}
        onDidFinishLoadingMap={() => setMapLoading(false)}
      >
        {cameraSettings && (
          <MapLibreGL.Camera ref={cameraRef} {...cameraSettings} />
        )}

        {/* Polyline conectando usuário ao destino via OSRM */}
        {routeShape && (
          <MapLibreGL.ShapeSource id="rota-pip" shape={routeShape}>
            <MapLibreGL.LineLayer
              id="rota-pip-line"
              style={{ lineColor: theme.colors.primary, lineWidth: 4 }}
            />
          </MapLibreGL.ShapeSource>
        )}

        {/* Marcador do usuário com seta direcional (quando heading disponível) */}
        {userLocation && userHeading !== undefined && (
          <MapLibreGL.MarkerView
            coordinate={toLngLat(userLocation)}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={[styles.userDirectionMarker, { transform: [{ rotate: `${userHeading}deg` }] }]}>
              <Ionicons name="navigate" size={20} color={theme.colors.info} />
            </View>
          </MapLibreGL.MarkerView>
        )}

        {/* Marcador do usuário (sem heading) */}
        {userLocation && userHeading === undefined && (
          <MapLibreGL.MarkerView
            coordinate={toLngLat(userLocation)}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.userLocationMarker} />
          </MapLibreGL.MarkerView>
        )}

        {destination && (
          <MapLibreGL.MarkerView
            coordinate={toLngLat(destination)}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.destinationMarker}>
              <Ionicons name="location" size={20} color={theme.colors.error} />
            </View>
          </MapLibreGL.MarkerView>
        )}
      </MapLibreGL.MapView>

      {/* Drag Overlay - cobre o mapa quando colapsado para permitir drag em toda área */}
      {/* Necessário porque MapView no Android pode capturar eventos mesmo com pointerEvents: 'none' */}
      {!isExpanded && (
        <View
          testID="pip-drag-overlay"
          style={styles.dragOverlay}
          // pointerEvents padrão é 'auto' - captura toques e permite PanResponder funcionar
        />
      )}

      {/* Loading overlay */}
      {mapLoading && (
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
  dragOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    zIndex: 5, // Acima do mapa, abaixo dos controles
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
    alignItems: 'center',
    gap: theme.spacing['1'],
    zIndex: 10, // Acima do drag overlay
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
    alignItems: 'center',
    gap: theme.spacing['1'],
    zIndex: 10, // Acima do drag overlay
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
    zIndex: 20, // Acima do drag overlay (z-index: 5)
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
    zIndex: 10, // Visível acima do drag overlay
    pointerEvents: 'none', // Não bloqueia eventos
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
