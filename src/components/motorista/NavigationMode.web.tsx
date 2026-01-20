/* global google */

import { Ionicons } from '@expo/vector-icons';
import { GoogleMap, useJsApiLoader, OverlayView, Polyline } from '@react-google-maps/api';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useNavigationModeLogic, type NavigationModeProps } from '@/hooks/navigation';
import { useAlert } from '@/hooks/useAlert';
import { abrirNavegacao } from '@/lib/navigation';
import { calculateHaversineDistance } from '@/services/turnByTurnNavigation';
import { withOpacity } from '@/utils/color';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

import { NavigationSettings } from './NavigationSettings';

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
const mapLibraries: ('marker' | 'places')[] = ['marker', 'places'];

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
  const { showWarning, AlertDialog } = useAlert();
  const mapRef = useRef<google.maps.Map | null>(null);

  // Use shared navigation logic hook
  const {
    userLocation,
    speed,
    distance: distanceToStop,
    eta,
    isTracking,
    setIsTracking,
    showSettings,
    setShowSettings,
    routePath,
    preferences,
    realParadas,
    startCheckpoint,
    endCheckpoint,
    currentStopIndex,
    nextStopAfterCurrent,
    pendingStops,
    isEntrega,
    isNearDestination,
    formatDistance,
    getSpeedColor,
    loadPreferences,
    updateLocationFromCoords,
  } = useNavigationModeLogic({
    currentStop,
    nextStop,
    paradas,
    rotaId,
  });

  // Load Google Maps
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: mapLibraries,
    version: 'beta',
  });

  const [buttonPressed, setButtonPressed] = useState<string | null>(null);
  const { autoAdvance, proximityRadius, showSpeedometer } = {
    autoAdvance: preferences.autoAdvance ?? true,
    proximityRadius: preferences.proximityRadius ?? 50,
    showSpeedometer: preferences.showSpeedometer ?? true,
  };

  // Calculate map center and zoom based on distance for navigation
  const { mapCenter, mapZoom } = useMemo(() => {
    if (!userLocation || !currentStop) {
      return {
        mapCenter: currentStop
          ? { lat: currentStop.latitude, lng: currentStop.longitude }
          : { lat: -23.5505, lng: -46.6333 }, // São Paulo default
        mapZoom: 15,
      };
    }

    const distance = calculateHaversineDistance(
      userLocation.latitude,
      userLocation.longitude,
      currentStop.latitude,
      currentStop.longitude
    );

    // Se está perto (< 1km), centralizar entre os dois pontos
    if (distance < 1000) {
      return {
        mapCenter: {
          lat: (userLocation.latitude + currentStop.latitude) / 2,
          lng: (userLocation.longitude + currentStop.longitude) / 2,
        },
        mapZoom: distance < 500 ? 16 : 15,
      };
    }

    // Se está longe, focar no usuário com zoom mais alto para navegação
    let zoom = 15; // Zoom padrão para navegação
    if (distance > 10000) zoom = 13;
    else if (distance > 5000) zoom = 14;
    else if (distance > 2000) zoom = 14;

    return {
      mapCenter: {
        lat: userLocation.latitude,
        lng: userLocation.longitude,
      },
      mapZoom: zoom,
    };
  }, [userLocation, currentStop]);

  // Recenter map on user location
  const recenterMap = useCallback(() => {
    if (mapRef.current && userLocation) {
      mapRef.current.panTo({
        lat: userLocation.latitude,
        lng: userLocation.longitude,
      });
      mapRef.current.setZoom(16);
    }
  }, [userLocation]);

  // isEntrega is now provided by useNavigationModeLogic hook
  // loadPreferences is now provided by useNavigationModeLogic hook

  const handleArrival = useCallback(() => {
    Alert.alert(
      'Chegou ao Destino!',
      `Você chegou em: ${currentStop.endereco}`,
      [
        {
          text: 'Pular',
          style: 'destructive',
          onPress: onSkip,
        },
        {
          text: 'Concluir',
          onPress: onComplete,
        },
      ]
    );
  }, [currentStop, onComplete, onSkip]);

  const checkProximityAndAutoAdvance = useCallback(
    (distance: number) => {
      if (distance < proximityRadius && autoAdvance) {
        handleArrival();
      }
    },
    [autoAdvance, handleArrival, proximityRadius]
  );

  const startLocationTracking = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      showWarning('Erro', 'Permissão de localização negada');
      return;
    }

    setIsTracking(true);

    // Get initial location
    try {
      const location = await Location.getCurrentPositionAsync({});
      updateLocationFromCoords(
        {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          heading: location.coords.heading,
        },
        location.coords.speed
      );
    } catch (error) {
      console.warn('[NavigationMode.web] Error getting initial location:', error);
    }

    // Watch location updates
    const subscription = await Location.watchPositionAsync(
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

    return () => {
      setIsTracking(false);
      try {
        subscription.remove();
      } catch (error) {
        console.warn('[NavigationMode.web] Error removing subscription:', error);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setIsTracking, updateLocationFromCoords]);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  // Check for auto-advance when distance changes
  useEffect(() => {
    if (distanceToStop !== null) {
      checkProximityAndAutoAdvance(distanceToStop);
    }
  }, [distanceToStop, checkProximityAndAutoAdvance]);

  // Inject CSS keyframes for pulse animation
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const styleId = 'nav-mode-pulse-keyframes';
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

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const initialize = async () => {
      cleanup = await startLocationTracking();
    };

    initialize();

    return () => {
      cleanup?.();
    };
  }, [startLocationTracking]);

  // OSRM route fetching and formatDistance are now handled by useNavigationModeLogic hook

  const openExternalNavigation = () => {
    abrirNavegacao({
      latitude: currentStop.latitude,
      longitude: currentStop.longitude,
      endereco: currentStop.endereco,
    });
  };

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  // Loading state
  if (!isLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Carregando mapa...</Text>
      </View>
    );
  }

  // Error state
  if (loadError) {
    return (
      <View style={styles.container}>
        <View style={styles.mapContainer}>
          <View style={styles.mapPlaceholder}>
            <Ionicons name="warning-outline" size={80} color={theme.colors.warning} />
            <Text style={styles.mapPlaceholderText}>
              Erro ao carregar o mapa
            </Text>
            <TouchableOpacity
              style={styles.openMapButton}
              onPress={openExternalNavigation}
            >
              <Text style={styles.openMapButtonText}>Abrir no Google Maps</Text>
            </TouchableOpacity>
          </View>
        </View>
        {renderInfoPanel()}
      </View>
    );
  }

  // Info panel render function
  function renderInfoPanel() {
    return (
      <View style={styles.infoContainer}>
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

        {/* Distance, ETA and Speed */}
        <View style={styles.mainInfo}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              ...(isNearDestination && { animation: 'pip-pulse 1s ease-in-out infinite' }),
            }}
          >
            <Text
              style={[
                styles.distanceValue,
                isNearDestination && styles.distanceValueNear,
              ]}
            >
              {distanceToStop ? formatDistance(distanceToStop) : '--'}
            </Text>
            <Text style={styles.distanceLabel}>
              {isNearDestination ? '🎯 Chegando!' : 'distância'}
            </Text>
          </div>

          <View style={styles.separator} />

          <View style={styles.etaContainer}>
            <Text style={styles.etaValue}>{eta || '--'}</Text>
            <Text style={styles.etaLabel}>chegada</Text>
          </View>

          {showSpeedometer && (
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
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.skipButton,
              buttonPressed === 'skip' && styles.buttonPressed,
            ]}
            onPress={onSkip}
            onPressIn={() => setButtonPressed('skip')}
            onPressOut={() => setButtonPressed(null)}
            activeOpacity={1}
          >
            <Ionicons name="arrow-forward-circle-outline" size={20} color={theme.colors.warning} />
            <Text style={styles.skipButtonText}>Pular</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.mapsButton,
              buttonPressed === 'maps' && styles.buttonPressed,
            ]}
            onPress={openExternalNavigation}
            onPressIn={() => setButtonPressed('maps')}
            onPressOut={() => setButtonPressed(null)}
            activeOpacity={1}
          >
            <Ionicons name="navigate" size={20} color={theme.colors.white} />
            <Text style={styles.mapsButtonText}>Abrir no Maps</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.completeButton,
              buttonPressed === 'complete' && styles.buttonPressed,
            ]}
            onPress={onComplete}
            onPressIn={() => setButtonPressed('complete')}
            onPressOut={() => setButtonPressed(null)}
            activeOpacity={1}
          >
            <Ionicons name="checkmark-circle" size={20} color={theme.colors.white} />
            <Text style={styles.completeButtonText}>Concluir</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Google Map */}
      <View style={styles.mapContainer}>
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={mapCenter}
          zoom={mapZoom}
          onLoad={onMapLoad}
          options={{
            disableDefaultUI: true,
            zoomControl: true,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
          }}
        >
          {/* User Location Marker */}
          {userLocation && (
            <OverlayView
              position={{ lat: userLocation.latitude, lng: userLocation.longitude }}
              mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
            >
              {userLocation.heading !== undefined ? (
                <View
                  style={[
                    styles.userDirectionMarker,
                    { transform: [{ rotate: `${userLocation.heading}deg` }] },
                  ]}
                >
                  <Ionicons name="navigate" size={20} color={theme.colors.info} />
                </View>
              ) : (
                <View style={styles.userMarker}>
                  <View style={styles.userMarkerInner} />
                </View>
              )}
            </OverlayView>
          )}

          {/* Current Destination Marker (parada atual) */}
          <OverlayView
            position={{ lat: currentStop.latitude, lng: currentStop.longitude }}
            mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
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
          </OverlayView>

          {/* Other Pending Stops */}
          {pendingStops.map((parada) => {
            const isNextStop = nextStopAfterCurrent?.id === parada.id;
            return (
              <OverlayView
                key={parada.id}
                position={{ lat: parada.latitude, lng: parada.longitude }}
                mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
              >
                <View style={[
                  styles.otherMarker,
                  isNextStop && styles.nextStopMarker,
                ]}>
                  <Text style={[
                    styles.markerText,
                    isNextStop && styles.nextStopMarkerText,
                  ]}>
                    {parada.ordem}
                  </Text>
                </View>
              </OverlayView>
            );
          })}

          {/* Route Polyline */}
          {routePath.length >= 2 && (
            <Polyline
              path={routePath.map(coord => ({ lat: coord.latitude, lng: coord.longitude }))}
              options={{
                strokeColor: theme.colors.primary,
                strokeOpacity: 1,
                strokeWeight: 4,
              }}
            />
          )}

          {/* Start Checkpoint Marker (ponto de partida) */}
          {startCheckpoint && startCheckpoint.id !== currentStop.id && (
            <OverlayView
              position={{ lat: startCheckpoint.latitude, lng: startCheckpoint.longitude }}
              mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
            >
              <View style={styles.checkpointMarker}>
                <Ionicons name="flag" size={14} color={theme.colors.success} />
              </View>
            </OverlayView>
          )}

          {/* End Checkpoint Marker (ponto de chegada/retorno) */}
          {endCheckpoint && endCheckpoint.id !== currentStop.id && (
            <OverlayView
              position={{ lat: endCheckpoint.latitude, lng: endCheckpoint.longitude }}
              mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
            >
              <View style={styles.checkpointMarker}>
                <Ionicons name="home" size={14} color={theme.colors.info} />
              </View>
            </OverlayView>
          )}
        </GoogleMap>

        {/* Top Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.topButton} onPress={onExit}>
            <Ionicons name="close" size={24} color={theme.colors.white} />
          </TouchableOpacity>

          {isTracking && (
            <View style={styles.trackingBadge}>
              <View style={styles.trackingDot} />
              <Text style={styles.trackingText}>Rastreando</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.topButton}
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
      </View>

      {/* Info Panel */}
      {renderInfoPanel()}

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
    backgroundColor: theme.colors.black,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.gray50,
  },
  loadingText: {
    marginTop: theme.spacing['4'],
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray600,
  },
  mapContainer: {
    flex: 1,
    backgroundColor: theme.colors.gray100,
    position: 'relative',
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.gray50,
  },
  mapPlaceholderText: {
    marginTop: theme.spacing['4'],
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray500,
  },
  openMapButton: {
    marginTop: theme.spacing['6'],
    paddingHorizontal: theme.spacing['6'],
    paddingVertical: theme.spacing['3'],
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.sm,
  },
  openMapButtonText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.base,
    fontWeight: '600',
  },
  topBar: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  trackingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: withOpacity(theme.colors.success, 0.9),
    paddingHorizontal: theme.spacing['4'],
    paddingVertical: 6,
    borderRadius: theme.borderRadius.xl,
  },
  trackingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.white,
  },
  trackingText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '600',
  },
  recenterButton: {
    position: 'absolute',
    right: 16,
    bottom: 280,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  infoContainer: {
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    paddingTop: theme.spacing['3'],
    paddingHorizontal: theme.spacing['4'],
    paddingBottom: 30,
    elevation: 10,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing['2'],
    marginBottom: theme.spacing['2'],
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
    fontWeight: '600',
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
    paddingBottom: theme.spacing['4'],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
  },
  distanceContainer: {
    alignItems: 'center',
  },
  distanceValue: {
    fontSize: theme.typography.fontSize['3xl'],
    fontWeight: '700',
    color: theme.colors.gray900,
  },
  distanceValueNear: {
    color: theme.colors.success,
  },
  distanceLabel: {
    fontSize: theme.typography.fontSize.xs - 1,
    color: theme.colors.gray500,
    marginTop: 2,
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
    fontWeight: '600',
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
    fontWeight: '700',
    color: theme.colors.gray900,
  },
  speedUnit: {
    fontSize: theme.typography.fontSize.xs - 1,
    color: theme.colors.gray500,
    marginTop: 2,
  },
  destinationInfo: {
    paddingVertical: theme.spacing['4'],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
  },
  destinationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing['2'],
  },
  destinationHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing['1'],
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: theme.spacing['2'],
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
    fontWeight: '600',
  },
  typeBadgeTextEntrega: {
    color: theme.colors.success,
  },
  typeBadgeTextRetirada: {
    color: theme.colors.warning,
  },
  destinationLabel: {
    fontSize: theme.typography.fontSize.xs - 2,
    fontWeight: '600',
    color: theme.colors.gray500,
    letterSpacing: 0.5,
  },
  nextStopHint: {
    fontSize: theme.typography.fontSize.xs - 2,
    color: theme.colors.gray400,
  },
  destinationAddress: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: '600',
    color: theme.colors.gray900,
    marginBottom: theme.spacing['2'],
  },
  recipientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: theme.spacing['2'],
  },
  recipientText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray500,
  },
  observationBox: {
    backgroundColor: theme.colors.warningBg,
    padding: theme.spacing['2'],
    borderRadius: theme.borderRadius.sm,
    marginTop: theme.spacing['2'],
  },
  observationText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.secondaryDark,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: theme.spacing['2'],
    paddingTop: theme.spacing['4'],
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing['3'],
    borderRadius: theme.borderRadius.sm,
    gap: 6,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  skipButton: {
    backgroundColor: theme.colors.warningBg,
  },
  skipButtonText: {
    color: theme.colors.warning,
    fontWeight: '600',
    fontSize: theme.typography.fontSize.sm,
  },
  mapsButton: {
    backgroundColor: theme.colors.primary,
  },
  mapsButtonText: {
    color: theme.colors.white,
    fontWeight: '600',
    fontSize: theme.typography.fontSize.sm,
    textShadowColor: withOpacity(theme.colors.black, 0.25),
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  completeButton: {
    backgroundColor: theme.colors.success,
  },
  completeButtonText: {
    color: theme.colors.white,
    fontWeight: '600',
    fontSize: theme.typography.fontSize.sm,
    textShadowColor: withOpacity(theme.colors.black, 0.25),
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  userMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(66, 133, 244, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userMarkerInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4285F4',
    borderWidth: 2,
    borderColor: '#fff',
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
  // Current destination (parada atual em navegação) marker - smaller, no label
  currentDestinationMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    borderWidth: 3,
    borderColor: theme.colors.white,
  },
  currentDestinationEntrega: {
    backgroundColor: theme.colors.error,
  },
  currentDestinationRetirada: {
    backgroundColor: theme.colors.warning,
  },
  // Checkpoint (partida/chegada) marker - smaller, no label
  checkpointMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.gray200,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  // Other pending stops marker - smaller
  otherMarker: {
    backgroundColor: theme.colors.gray400,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.white,
  },
  // Next stop marker (highlighted) - smaller
  nextStopMarker: {
    backgroundColor: theme.colors.warning,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: theme.colors.white,
    shadowColor: theme.colors.warning,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  markerText: {
    color: theme.colors.white,
    fontSize: 10,
    fontWeight: '600',
  },
  nextStopMarkerText: {
    fontSize: 11,
    fontWeight: '700',
  },
  settingsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
}));
