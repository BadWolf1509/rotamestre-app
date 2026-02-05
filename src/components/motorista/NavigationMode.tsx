import { Ionicons } from '@expo/vector-icons';
import MapLibreGL, { type CameraRef } from '@maplibre/maplibre-react-native';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useNavigationModeLogic, type NavigationModeProps } from '@/hooks/navigation';
import { useAlert } from '@/hooks/useAlert';
import { logger } from '@/lib/logger';
import { MAPLIBRE_RASTER_STYLE, toLineString, toLngLat, zoomFromLongitudeDelta } from '@/lib/maplibre';
import { abrirNavegacao } from '@/lib/navigation';
import { calculateHaversineDistance } from '@/services/turnByTurnNavigation';
import { withOpacity } from '@/utils/color';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

import { NavigationSettings } from './NavigationSettings';
import { TurnByTurnNavigation } from './TurnByTurnNavigation';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export function NavigationMode({
  currentStop,
  nextStop,
  paradas,
  rotaId,
  onComplete,
  onSkip,
  onExit,
}: NavigationModeProps) {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const { showConfirm, AlertDialog } = useAlert();

  // Use shared navigation logic hook
  const {
    userLocation,
    speed,
    distance,
    eta,
    isTracking,
    showSettings,
    setShowSettings,
    routePath,
    preferences,
    navigationMode,
    setNavigationMode,
    isInitializing,
    setIsInitializing,
    realParadas,
    startCheckpoint,
    endCheckpoint,
    currentStopIndex,
    nextStopAfterCurrent,
    remainingWaypoints,
    isEntrega,
    formatDistance,
    getSpeedColor,
    loadPreferences,
    startNavigation,
    stopNavigation,
    updateLocationFromCoords,
  } = useNavigationModeLogic({
    currentStop,
    nextStop,
    paradas,
    rotaId,
  });

  const routeShape = useMemo(
    () => (routePath.length >= 2 ? toLineString(routePath) : null),
    [routePath]
  );

  const cameraRef = useRef<CameraRef>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  // Animation refs for UI improvements
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const buttonScaleAnims = useRef({
    skip: new Animated.Value(1),
    maps: new Animated.Value(1),
    complete: new Animated.Value(1),
  }).current;
  const isPulsingRef = useRef(false);

  const triggerHaptic = useCallback(async (type: 'impact' | 'success' | 'warning') => {
    if (Platform.OS === 'web' || !preferences.vibrationAlerts) return;

    try {
      if (type === 'impact') {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else if (type === 'success') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (type === 'warning') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    } catch {
      // Haptics not available
    }
  }, [preferences.vibrationAlerts]);

  const playNotificationSound = useCallback(async () => {
    if (Platform.OS === 'web' || !preferences.soundAlerts) return;

    try {
      // Configure audio mode for notifications
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: false,
        staysActiveInBackground: false,
      });

      // Unload previous sound if exists
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      // Play a simple notification beep using Audio
      // Note: Custom sounds can be added to assets/sounds/ folder
      // For now, we use haptics as the primary feedback
    } catch {
      // Audio not available
    }
  }, [preferences.soundAlerts]);


  useEffect(() => {
    const initialize = async () => {
      await startNavigation();
      await loadPreferences();
      setIsInitializing(false);
    };
    initialize();
    return () => {
      stopNavigation();
      // Cleanup sound
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, [loadPreferences, setIsInitializing, startNavigation, stopNavigation]);

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 5,
        },
        (location) => {
          updateLocationFromCoords(
            {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              heading: location.coords.heading,
            },
            location.coords.speed
          );
        }
      );
    })();

    return () => {
      try {
        subscription?.remove();
      } catch (error) {
        // expo-location remove() não funciona corretamente na web
        logger.warn('[NavigationMode] Error removing subscription:', error);
      }
    };
  }, [updateLocationFromCoords]);

  // OSRM route fetching is now handled by useNavigationModeLogic hook

  const handleOpenInMaps = () => {
    if (!currentStop) return;

    // If internal nav is enabled, switch to turn-by-turn mode
    if (preferences.internalNavigation) {
      setNavigationMode('turn-by-turn');
    } else {
      // Open in external app
      abrirNavegacao({
        latitude: currentStop.latitude,
        longitude: currentStop.longitude,
        endereco: currentStop.endereco,
      });
    }
  };

  const handleCompleteStop = async () => {
    await triggerHaptic('impact');
    const confirmed = await showConfirm({
      title: 'Confirmar Entrega',
      message: `Confirma a entrega em:\n${currentStop.endereco}?`,
      confirmText: 'Confirmar',
      cancelText: 'Cancelar',
    });
    if (confirmed) {
      await playNotificationSound();
      await triggerHaptic('success');
      onComplete();
    }
  };

  const handleSkipStop = async () => {
    await triggerHaptic('impact');
    const confirmed = await showConfirm({
      title: 'Pular Parada',
      message: `Deseja pular esta parada?\n${currentStop.endereco}`,
      confirmText: 'Pular',
      cancelText: 'Cancelar',
      type: 'danger',
    });
    if (confirmed) {
      await triggerHaptic('warning');
      onSkip();
    }
  };

  const handleExitNavigation = async () => {
    const confirmed = await showConfirm({
      title: 'Sair da Navegação',
      message: 'Deseja sair do modo de navegação?',
      confirmText: 'Sair',
      cancelText: 'Cancelar',
      type: 'danger',
    });
    if (confirmed) {
      await stopNavigation();
      onExit();
    }
  };

  // formatDistance is now provided by useNavigationModeLogic hook

  // Calcular região do mapa com zoom apropriado para navegação
  const getRegion = useCallback(() => {
    if (userLocation && currentStop) {
      // Calcular distância para decidir o zoom
      const distanceToDestination = calculateHaversineDistance(
        userLocation.latitude,
        userLocation.longitude,
        currentStop.latitude,
        currentStop.longitude
      );

      // Se está perto (< 1km), mostrar ambos os pontos com padding
      if (distanceToDestination < 1000) {
        const minLat = Math.min(userLocation.latitude, currentStop.latitude);
        const maxLat = Math.max(userLocation.latitude, currentStop.latitude);
        const minLon = Math.min(userLocation.longitude, currentStop.longitude);
        const maxLon = Math.max(userLocation.longitude, currentStop.longitude);

        // Adicionar padding de 30% para não ficar muito apertado
        const latPadding = Math.max(0.003, (maxLat - minLat) * 0.3);
        const lonPadding = Math.max(0.003, (maxLon - minLon) * 0.3);

        return {
          latitude: (minLat + maxLat) / 2,
          longitude: (minLon + maxLon) / 2,
          latitudeDelta: Math.max(0.008, (maxLat - minLat) + latPadding * 2),
          longitudeDelta: Math.max(0.008, (maxLon - minLon) + lonPadding * 2),
        };
      }

      // Se está longe, focar no usuário com zoom mais alto para navegação
      // Calcular zoom baseado na distância (quanto mais longe, menos zoom)
      let delta = 0.01; // ~1km view - padrão para navegação
      if (distanceToDestination > 10000) delta = 0.05; // ~5km view
      else if (distanceToDestination > 5000) delta = 0.03; // ~3km view
      else if (distanceToDestination > 2000) delta = 0.02; // ~2km view

      return {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: delta,
        longitudeDelta: delta,
      };
    }

    return currentStop
      ? {
          latitude: currentStop.latitude,
          longitude: currentStop.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }
      : null;
  }, [userLocation, currentStop]);

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

  // Proximity alert animation (pulse when < 100m)
  useEffect(() => {
    if (distance !== null && distance < 100 && !isPulsingRef.current) {
      isPulsingRef.current = true;
      triggerHaptic('success');
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else if (distance !== null && distance >= 100 && isPulsingRef.current) {
      isPulsingRef.current = false;
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [distance, pulseAnim, triggerHaptic]);

  // Button press animation helpers
  const animateButtonPress = (button: 'skip' | 'maps' | 'complete', pressed: boolean) => {
    Animated.spring(buttonScaleAnims[button], {
      toValue: pressed ? 0.95 : 1,
      useNativeDriver: true,
      friction: 8,
    }).start();
  };

  // getSpeedColor is now provided by useNavigationModeLogic hook

  // Recenter map on user location
  const recenterMap = useCallback(() => {
    if (cameraRef.current && userLocation) {
      triggerHaptic('impact');
      cameraRef.current.setCamera({
        centerCoordinate: toLngLat(userLocation),
        zoomLevel: zoomFromLongitudeDelta(0.005),
        animationDuration: 500,
      });
    }
  }, [userLocation, triggerHaptic]);

  // isEntrega, realParadas, checkpoints, startCheckpoint, endCheckpoint,
  // currentStopIndex, nextStopAfterCurrent, remainingWaypoints are now
  // provided by useNavigationModeLogic hook

  // Loading state
  if (isInitializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Preparando navegação...</Text>
      </View>
    );
  }

  if (!currentStop || !region) return null;

  // Show turn-by-turn navigation if selected
  if (navigationMode === 'turn-by-turn' && userLocation) {
    return (
      <TurnByTurnNavigation
        origin={userLocation}
        destination={{
          latitude: currentStop.latitude,
          longitude: currentStop.longitude,
          address: currentStop.endereco,
        }}
        waypoints={remainingWaypoints}
        onArrive={handleCompleteStop}
        onExit={() => setNavigationMode('map')}
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* Map */}
      <MapLibreGL.MapView
        testID="map-view"
        style={styles.map}
        mapStyle={MAPLIBRE_RASTER_STYLE}
        rotateEnabled={false}
        pitchEnabled={false}
        compassEnabled={false}
        logoEnabled={false}
        attributionEnabled={false}
      >
        {cameraSettings && (
          <MapLibreGL.Camera ref={cameraRef} {...cameraSettings} />
        )}

        {userLocation && (
          <MapLibreGL.MarkerView
            coordinate={toLngLat(userLocation)}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.userLocationMarker}>
              <View style={styles.userLocationDot} />
            </View>
          </MapLibreGL.MarkerView>
        )}

        {/* Current Destination Marker (parada atual) */}
        <MapLibreGL.MarkerView
          coordinate={toLngLat({
            latitude: currentStop.latitude,
            longitude: currentStop.longitude,
          })}
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <View style={[
            styles.currentDestinationMarker,
            isEntrega ? styles.currentDestinationEntrega : styles.currentDestinationRetirada,
          ]}>
            <Ionicons
              name={isEntrega ? 'cube' : 'arrow-up-circle'}
              size={18}
              color={theme.colors.white}
            />
          </View>
        </MapLibreGL.MarkerView>

        {/* Other pending stops (excluding current and checkpoints) */}
        {realParadas
          .filter((p) => p.id !== currentStop.id && p.status === 'pendente')
          .map((parada) => {
            const isNextStop = nextStopAfterCurrent?.id === parada.id;
            return (
              <MapLibreGL.MarkerView
                key={parada.id}
                coordinate={toLngLat({
                  latitude: parada.latitude,
                  longitude: parada.longitude,
                })}
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <View style={[
                  styles.otherMarker,
                  isNextStop && styles.nextStopMarker,
                  !isNextStop && { opacity: 0.6 },
                ]}>
                  <Text style={[
                    styles.markerText,
                    isNextStop && styles.nextStopMarkerText,
                  ]}>
                    {parada.ordem}
                  </Text>
                </View>
              </MapLibreGL.MarkerView>
            );
          })}

        {/* Route Polyline */}
        {routeShape && (
          <MapLibreGL.ShapeSource id="rota-navigation" shape={routeShape}>
            <MapLibreGL.LineLayer
              id="rota-navigation-line"
              style={{ lineColor: theme.colors.primary, lineWidth: 4 }}
            />
          </MapLibreGL.ShapeSource>
        )}

        {/* Start Checkpoint Marker (ponto de partida) */}
        {startCheckpoint && startCheckpoint.id !== currentStop.id && (
          <MapLibreGL.MarkerView
            coordinate={toLngLat({
              latitude: startCheckpoint.latitude,
              longitude: startCheckpoint.longitude,
            })}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.checkpointMarker}>
              <Ionicons name="flag" size={14} color={theme.colors.success} />
            </View>
          </MapLibreGL.MarkerView>
        )}

        {/* End Checkpoint Marker (ponto de chegada/retorno) */}
        {endCheckpoint && endCheckpoint.id !== currentStop.id && (
          <MapLibreGL.MarkerView
            coordinate={toLngLat({
              latitude: endCheckpoint.latitude,
              longitude: endCheckpoint.longitude,
            })}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.checkpointMarker}>
              <Ionicons name="home" size={14} color={theme.colors.info} />
            </View>
          </MapLibreGL.MarkerView>
        )}
      </MapLibreGL.MapView>

      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.exitButton} onPress={handleExitNavigation}>
          <Ionicons name="close" size={24} color={theme.colors.white} />
        </TouchableOpacity>

        {isTracking && (
          <View style={styles.trackingBadge}>
            <View style={styles.trackingDot} />
            <Text style={styles.trackingText}>Rastreando</Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => setShowSettings(true)}
        >
          <Ionicons name="settings-outline" size={24} color={theme.colors.white} />
        </TouchableOpacity>
      </View>

      {/* Recenter Button */}
      {userLocation && (
        <TouchableOpacity
          style={styles.recenterButton}
          onPress={recenterMap}
          activeOpacity={0.8}
        >
          <Ionicons name="locate" size={22} color={theme.colors.primary} />
        </TouchableOpacity>
      )}

      {/* Navigation Info Panel */}
      {/* Usa Math.max para garantir mínimo de 34px (Android 15 pode retornar insets.bottom = 0) */}
      <View style={[styles.infoPanel, { paddingBottom: theme.spacing.xl + Math.max(insets.bottom, 34) }]}>
        {/* Progress Indicator (only real stops, not checkpoints) */}
        <View style={styles.progressContainer}>
          {realParadas.map((parada, index) => {
            const isCompleted = parada.status === 'concluida';
            const isCurrent = parada.id === currentStop.id;
            const isPending = parada.status === 'pendente' && !isCurrent;
            return (
              <React.Fragment key={parada.id}>
                <View
                  style={[
                    styles.progressDot,
                    isCompleted && styles.progressDotCompleted,
                    isCurrent && styles.progressDotCurrent,
                    isPending && styles.progressDotPending,
                  ]}
                >
                  {isCurrent && (
                    <Ionicons name="navigate" size={10} color={theme.colors.white} />
                  )}
                  {isCompleted && (
                    <Ionicons name="checkmark" size={10} color={theme.colors.white} />
                  )}
                  {isPending && (
                    <Text style={styles.progressDotText}>{index + 1}</Text>
                  )}
                </View>
                {index < realParadas.length - 1 && (
                  <View
                    style={[
                      styles.progressLine,
                      isCompleted && styles.progressLineCompleted,
                    ]}
                  />
                )}
              </React.Fragment>
            );
          })}
        </View>

        {/* Distance and ETA */}
        <View style={styles.mainInfo}>
          <Animated.View
            style={[
              styles.distanceContainer,
              distance !== null && distance < 100 && {
                transform: [{ scale: pulseAnim }],
              },
            ]}
          >
            <Text
              style={[
                styles.distanceValue,
                distance !== null && distance < 100 && styles.distanceValueNear,
              ]}
            >
              {distance ? formatDistance(distance) : '--'}
            </Text>
            <Text style={styles.distanceLabel}>
              {distance !== null && distance < 100 ? '🎯 Chegando!' : 'distância'}
            </Text>
          </Animated.View>

          <View style={styles.separator} />

          <View style={styles.etaContainer}>
            <Text style={styles.etaValue}>{eta || '--'}</Text>
            <Text style={styles.etaLabel}>chegada</Text>
          </View>

          {preferences.showSpeedometer && (
            <>
              <View style={styles.separator} />

              <View style={styles.speedContainer}>
                <Text style={[styles.speedValue, { color: getSpeedColor(speed) }]}>
                  {speed}
                </Text>
                <Text style={styles.speedUnit}>km/h</Text>
              </View>
            </>
          )}
        </View>

        {/* Current Destination */}
        <View style={styles.destinationInfo}>
          <View style={styles.destinationHeader}>
            <View style={styles.destinationHeaderLeft}>
              <View
                style={[
                  styles.typeBadge,
                  isEntrega ? styles.typeBadgeEntrega : styles.typeBadgeRetirada,
                ]}
              >
                <Ionicons
                  name={isEntrega ? 'cube' : 'arrow-up-circle'}
                  size={12}
                  color={isEntrega ? theme.colors.success : theme.colors.warning}
                />
                <Text
                  style={[
                    styles.typeBadgeText,
                    isEntrega ? styles.typeBadgeTextEntrega : styles.typeBadgeTextRetirada,
                  ]}
                >
                  {isEntrega ? 'Entrega' : 'Retirada'}
                </Text>
              </View>
              <Text style={styles.destinationLabel}>
                • Parada {currentStopIndex}/{realParadas.length}
              </Text>
            </View>
            {nextStop && (
              <Text style={styles.nextStopHint}>
                Próxima: {nextStop.endereco.split(',')[0]}
              </Text>
            )}
          </View>
          <Text style={styles.destinationAddress}>{currentStop.endereco}</Text>

          {currentStop.destinatario && (
            <View style={styles.recipientInfo}>
              <Ionicons name="person-outline" size={14} color={theme.colors.gray500} />
              <Text style={styles.recipientText}>{currentStop.destinatario}</Text>
            </View>
          )}

          {currentStop.observacoes && (
            <View style={styles.observationBox}>
              <Text style={styles.observationText}>{currentStop.observacoes}</Text>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <Animated.View style={{ flex: 1, transform: [{ scale: buttonScaleAnims.skip }] }}>
            <TouchableOpacity
              style={[styles.actionButton, styles.skipButton]}
              onPress={handleSkipStop}
              onPressIn={() => animateButtonPress('skip', true)}
              onPressOut={() => animateButtonPress('skip', false)}
              activeOpacity={1}
            >
              <Ionicons name="arrow-forward-circle-outline" size={20} color={theme.colors.warning} />
              <Text style={styles.skipButtonText}>Pular</Text>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={{ flex: 1, transform: [{ scale: buttonScaleAnims.maps }] }}>
            <TouchableOpacity
              style={[styles.actionButton, styles.mapsButton]}
              onPress={handleOpenInMaps}
              onPressIn={() => animateButtonPress('maps', true)}
              onPressOut={() => animateButtonPress('maps', false)}
              activeOpacity={1}
            >
              <Ionicons name="navigate" size={20} color={theme.colors.white} />
              <Text style={styles.mapsButtonText}>
                {preferences.internalNavigation ? 'Navegar' : 'Abrir no Maps'}
              </Text>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={{ flex: 1, transform: [{ scale: buttonScaleAnims.complete }] }}>
            <TouchableOpacity
              style={[styles.actionButton, styles.completeButton]}
              onPress={handleCompleteStop}
              onPressIn={() => animateButtonPress('complete', true)}
              onPressOut={() => animateButtonPress('complete', false)}
              activeOpacity={1}
            >
              <Ionicons name="checkmark-circle" size={20} color={theme.colors.white} />
              <Text style={styles.completeButtonText}>Concluir</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>

      {/* Settings Modal */}
      {showSettings && (
        <View style={styles.settingsOverlay}>
          <NavigationSettings
            visible={showSettings}
            onClose={() => setShowSettings(false)}
          />
        </View>
      )}
      {AlertDialog}
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.gray50,
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray600,
    fontFamily: theme.typography.fontSans,
  },
  map: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    backgroundColor: withOpacity(theme.colors.black, 0.5),
  },
  exitButton: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.full,
    backgroundColor: withOpacity(theme.colors.black, 0.3),
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.full,
    backgroundColor: withOpacity(theme.colors.black, 0.3),
    justifyContent: 'center',
    alignItems: 'center',
  },
  recenterButton: {
    position: 'absolute',
    right: theme.spacing.lg,
    bottom: 380, // Above info panel
    width: 44,
    height: 44,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  trackingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs + 2,
    backgroundColor: withOpacity(theme.colors.success, 0.9),
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs + 2,
    borderRadius: theme.borderRadius.xl,
  },
  trackingDot: {
    width: theme.spacing.sm,
    height: theme.spacing.sm,
    borderRadius: theme.spacing.xs,
    backgroundColor: theme.colors.white,
  },
  trackingText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  infoPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    paddingTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    // paddingBottom é definido dinamicamente com Math.max(insets.bottom, 34)
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  progressDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.gray300,
  },
  progressDotCompleted: {
    backgroundColor: theme.colors.success,
  },
  progressDotCurrent: {
    backgroundColor: theme.colors.primary,
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  progressDotPending: {
    backgroundColor: theme.colors.gray300,
  },
  progressDotText: {
    fontSize: 9,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray600,
  },
  progressLine: {
    width: 20,
    height: 2,
    backgroundColor: theme.colors.gray300,
    marginHorizontal: 2,
  },
  progressLineCompleted: {
    backgroundColor: theme.colors.success,
  },
  mainInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
  },
  distanceContainer: {
    alignItems: 'center',
  },
  distanceValue: {
    fontSize: theme.typography.fontSize['3xl'],
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.gray900,
  },
  distanceLabel: {
    fontSize: theme.typography.fontSize.xs - 1,
    color: theme.colors.gray500,
    marginTop: 2,
  },
  distanceValueNear: {
    color: theme.colors.success,
  },
  separator: {
    width: 1,
    height: 40,
    backgroundColor: theme.colors.gray200,
  },
  etaContainer: {
    alignItems: 'center',
  },
  etaValue: {
    fontSize: theme.typography.fontSize.xl + 4,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
  },
  etaLabel: {
    fontSize: theme.typography.fontSize.xs - 1,
    color: theme.colors.gray500,
    marginTop: 2,
  },
  speedContainer: {
    alignItems: 'center',
  },
  speedValue: {
    fontSize: theme.typography.fontSize['2xl'] + 4,
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.gray900,
  },
  speedUnit: {
    fontSize: theme.typography.fontSize.xs - 1,
    color: theme.colors.gray500,
    marginTop: 2,
  },
  destinationInfo: {
    paddingVertical: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
  },
  destinationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  destinationHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.full,
  },
  typeBadgeEntrega: {
    backgroundColor: withOpacity(theme.colors.success, 0.15),
  },
  typeBadgeRetirada: {
    backgroundColor: withOpacity(theme.colors.warning, 0.15),
  },
  typeBadgeText: {
    fontSize: theme.typography.fontSize.xs - 2,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  typeBadgeTextEntrega: {
    color: theme.colors.success,
  },
  typeBadgeTextRetirada: {
    color: theme.colors.warning,
  },
  destinationLabel: {
    fontSize: theme.typography.fontSize.xs - 2,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray500,
    letterSpacing: 0.5,
  },
  nextStopHint: {
    fontSize: theme.typography.fontSize.xs - 2,
    color: theme.colors.gray400,
  },
  destinationAddress: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
    marginBottom: theme.spacing.sm,
  },
  recipientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs + 2,
    marginBottom: theme.spacing.sm,
  },
  recipientText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray500,
  },
  observationBox: {
    backgroundColor: theme.colors.warningBg,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    marginTop: theme.spacing.sm,
  },
  observationText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.secondaryDark,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.lg,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs + 2,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
  },
  skipButton: {
    backgroundColor: theme.colors.warningBg,
  },
  skipButtonText: {
    color: theme.colors.warning,
    fontFamily: theme.typography.fontSansSemiBold,
    fontSize: theme.typography.fontSize.sm,
  },
  mapsButton: {
    backgroundColor: theme.colors.primary,
  },
  mapsButtonText: {
    color: theme.colors.white,
    fontFamily: theme.typography.fontSansSemiBold,
    fontSize: theme.typography.fontSize.sm,
    // Brand guideline: text shadow for white text on colored background
    textShadowColor: withOpacity(theme.colors.black, 0.25),
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  completeButton: {
    backgroundColor: theme.colors.success,
  },
  completeButtonText: {
    color: theme.colors.white,
    fontFamily: theme.typography.fontSansSemiBold,
    fontSize: theme.typography.fontSize.sm,
    // Brand guideline: text shadow for white text on colored background
    textShadowColor: withOpacity(theme.colors.black, 0.25),
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  // Current destination (parada atual em navegação) marker
  currentDestinationMarker: {
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
    borderWidth: 3,
    borderColor: theme.colors.white,
  },
  userLocationMarker: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: withOpacity(theme.colors.info, 0.2),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.colors.white,
  },
  userLocationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.info,
  },
  currentDestinationEntrega: {
    backgroundColor: theme.colors.error,
  },
  currentDestinationRetirada: {
    backgroundColor: theme.colors.warning,
  },
  // Checkpoint markers (start/end)
  checkpointMarker: {
    width: 28,
    height: 28,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
    borderWidth: 2,
    borderColor: theme.colors.gray200,
  },
  // Other pending stops marker
  otherMarker: {
    backgroundColor: theme.colors.gray400,
    width: 24,
    height: 24,
    borderRadius: theme.borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.white,
  },
  // Next stop marker (highlighted)
  nextStopMarker: {
    backgroundColor: theme.colors.warning,
    width: 28,
    height: 28,
    borderRadius: theme.borderRadius.full,
    borderWidth: 2,
    borderColor: theme.colors.white,
    shadowColor: theme.colors.warning,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 4,
  },
  markerText: {
    color: theme.colors.white,
    fontSize: 10,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  nextStopMarkerText: {
    fontSize: 11,
    fontFamily: theme.typography.fontSansBold,
  },
  settingsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
}));


