/**
 * NavigationMode.web.tsx - Modo de navegação para motorista (Web)
 *
 * Migrado de Google Maps para MapLibre GL JS + OpenFreeMap (Jan/2025)
 * - Usa tiles gratuitos do OpenFreeMap
 * - Não requer API key
 */

import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import maplibregl from 'maplibre-gl';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import 'maplibre-gl/dist/maplibre-gl.css';

import { useNavigationModeLogic, type NavigationModeProps } from '@/hooks/navigation';
import { useAlert } from '@/hooks/useAlert';
import { abrirNavegacao } from '@/lib/navigation';
import { getOpenFreeMapStyle, installOpenFreeMapMissingImageHandler } from '@/lib/openFreeMapStyle';
import { calculateHaversineDistance } from '@/services/turnByTurnNavigation';
import { withOpacity } from '@/utils/color';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

import { NavigationSettings } from './NavigationSettings';

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
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

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

  const [buttonPressed, setButtonPressed] = useState<string | null>(null);
  const { autoAdvance, proximityRadius, showSpeedometer } = {
    autoAdvance: preferences.autoAdvance ?? true,
    proximityRadius: preferences.proximityRadius ?? 50,
    showSpeedometer: preferences.showSpeedometer ?? true,
  };

  // Calculate map center based on user location and destination
  const mapCenter = useMemo(() => {
    if (!userLocation || !currentStop) {
      return currentStop
        ? [currentStop.longitude, currentStop.latitude] as [number, number]
        : [-46.6333, -23.5505] as [number, number]; // São Paulo default
    }

    const distance = calculateHaversineDistance(
      userLocation.latitude,
      userLocation.longitude,
      currentStop.latitude,
      currentStop.longitude
    );

    // If close, center between both points
    if (distance < 1000) {
      return [
        (userLocation.longitude + currentStop.longitude) / 2,
        (userLocation.latitude + currentStop.latitude) / 2,
      ] as [number, number];
    }

    // If far, focus on user
    return [userLocation.longitude, userLocation.latitude] as [number, number];
  }, [userLocation, currentStop]);

  // Initialize MapLibre map (only once on mount)
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Capture initial center value
    const initialCenter = mapCenter;
    let cancelled = false;
    let mapInstance: maplibregl.Map | null = null;
    let removeMissingImageHandler: (() => void) | null = null;

    const initializeMap = async () => {
      try {
        const style = await getOpenFreeMapStyle();
        if (cancelled || !mapContainerRef.current) return;

        mapInstance = new maplibregl.Map({
          container: mapContainerRef.current,
          style,
          center: initialCenter,
          zoom: 15,
        });
        removeMissingImageHandler = installOpenFreeMapMissingImageHandler(mapInstance);

        mapInstance.on('load', () => {
          setMapLoaded(true);
        });

        mapRef.current = mapInstance;
      } catch (error) {
        if (cancelled) return;
        console.error('[NavigationMode.web] Failed to initialize map:', error);
      }
    };

    initializeMap();

    // Copy refs to local variables for cleanup
    const markers = markersRef.current;
    const userMarker = userMarkerRef.current;

    return () => {
      cancelled = true;
      if (removeMissingImageHandler) {
        removeMissingImageHandler();
      }
      markers.forEach(marker => marker.remove());
      markers.clear();
      userMarker?.remove();
      if (mapInstance) {
        mapInstance.remove();
      }
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update map center when user location changes
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !userLocation) return;
    mapRef.current.setCenter([userLocation.longitude, userLocation.latitude]);
  }, [userLocation, mapLoaded]);

  // Create/update user location marker
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !userLocation) return;

    // Remove old marker
    userMarkerRef.current?.remove();

    // Create user marker element
    const el = document.createElement('div');
    const hasHeading = userLocation.heading !== undefined;

    if (hasHeading) {
      el.innerHTML = `
        <div style="
          width: 32px;
          height: 32px;
          border-radius: 16px;
          background: white;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 4px rgba(0,0,0,0.25);
          transform: rotate(${userLocation.heading}deg);
        ">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="${theme.colors.info}">
            <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71L12 2z"/>
          </svg>
        </div>
      `;
    } else {
      el.innerHTML = `
        <div style="
          width: 24px;
          height: 24px;
          border-radius: 12px;
          background: rgba(66, 133, 244, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <div style="
            width: 12px;
            height: 12px;
            border-radius: 6px;
            background: #4285F4;
            border: 2px solid white;
          "></div>
        </div>
      `;
    }

    userMarkerRef.current = new maplibregl.Marker({ element: el })
      .setLngLat([userLocation.longitude, userLocation.latitude])
      .addTo(mapRef.current);
  }, [userLocation, mapLoaded, theme.colors.info]);

  // Create/update destination and stop markers
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current.clear();

    // Current destination marker
    const destEl = document.createElement('div');
    const destColor = isEntrega ? theme.colors.error : theme.colors.warning;
    destEl.innerHTML = `
      <div style="
        width: 36px;
        height: 36px;
        border-radius: 18px;
        background: ${destColor};
        border: 3px solid white;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      ">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
          ${isEntrega
            ? '<path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zm-7-2l4-4-4-4v3H8v2h4v3z"/>'
            : '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>'
          }
        </svg>
      </div>
    `;
    const destMarker = new maplibregl.Marker({ element: destEl })
      .setLngLat([currentStop.longitude, currentStop.latitude])
      .addTo(mapRef.current);
    markersRef.current.set('current', destMarker);

    // Other pending stops
    pendingStops.forEach((parada) => {
      const isNext = nextStopAfterCurrent?.id === parada.id;
      const el = document.createElement('div');
      el.innerHTML = `
        <div style="
          width: ${isNext ? '28px' : '24px'};
          height: ${isNext ? '28px' : '24px'};
          border-radius: ${isNext ? '14px' : '12px'};
          background: ${isNext ? theme.colors.warning : theme.colors.gray400};
          border: 2px solid white;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: ${isNext ? '11px' : '10px'};
          font-weight: 600;
          ${isNext ? `box-shadow: 0 1px 3px ${theme.colors.warning}80;` : ''}
        ">
          ${parada.ordem}
        </div>
      `;
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([parada.longitude, parada.latitude])
        .addTo(mapRef.current!);
      markersRef.current.set(parada.id, marker);
    });

    // Start checkpoint
    if (startCheckpoint && startCheckpoint.id !== currentStop.id) {
      const el = document.createElement('div');
      el.innerHTML = `
        <div style="
          width: 28px;
          height: 28px;
          border-radius: 14px;
          background: white;
          border: 2px solid ${theme.colors.gray200};
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 1px 2px rgba(0,0,0,0.15);
        ">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="${theme.colors.success}">
            <path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z"/>
          </svg>
        </div>
      `;
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([startCheckpoint.longitude, startCheckpoint.latitude])
        .addTo(mapRef.current!);
      markersRef.current.set('start', marker);
    }

    // End checkpoint
    if (endCheckpoint && endCheckpoint.id !== currentStop.id) {
      const el = document.createElement('div');
      el.innerHTML = `
        <div style="
          width: 28px;
          height: 28px;
          border-radius: 14px;
          background: white;
          border: 2px solid ${theme.colors.gray200};
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 1px 2px rgba(0,0,0,0.15);
        ">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="${theme.colors.info}">
            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
          </svg>
        </div>
      `;
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([endCheckpoint.longitude, endCheckpoint.latitude])
        .addTo(mapRef.current!);
      markersRef.current.set('end', marker);
    }
  }, [currentStop, pendingStops, nextStopAfterCurrent, startCheckpoint, endCheckpoint, isEntrega, mapLoaded, theme]);

  // Add/update route polyline
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || routePath.length < 2) return;

    const map = mapRef.current;
    const sourceId = 'route-source';
    const layerId = 'route-layer';

    // Remove existing route
    if (map.getLayer(layerId)) map.removeLayer(layerId);
    if (map.getSource(sourceId)) map.removeSource(sourceId);

    // Add route
    map.addSource(sourceId, {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: routePath.map(c => [c.longitude, c.latitude]),
        },
      },
    });

    map.addLayer({
      id: layerId,
      type: 'line',
      source: sourceId,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': theme.colors.primary,
        'line-width': 4,
        'line-opacity': 1,
      },
    });

    return () => {
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    };
  }, [routePath, mapLoaded, theme.colors.primary]);

  // Recenter map on user location
  const recenterMap = useCallback(() => {
    if (mapRef.current && userLocation) {
      mapRef.current.flyTo({
        center: [userLocation.longitude, userLocation.latitude],
        zoom: 16,
      });
    }
  }, [userLocation]);

  const handleArrival = useCallback(() => {
    Alert.alert(
      'Chegou ao Destino!',
      `Você chegou em: ${currentStop.endereco}`,
      [
        { text: 'Pular', style: 'destructive', onPress: onSkip },
        { text: 'Concluir', onPress: onComplete },
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
  }, [setIsTracking, updateLocationFromCoords, showWarning]);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

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
      if (existingStyle) existingStyle.remove();
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

  const openExternalNavigation = () => {
    abrirNavegacao({
      latitude: currentStop.latitude,
      longitude: currentStop.longitude,
      endereco: currentStop.endereco,
    });
  };

  // Loading state
  if (!mapLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Carregando mapa...</Text>
      </View>
    );
  }

  // Info panel render function
  function renderInfoPanel() {
    return (
      <View style={styles.infoContainer}>
        {/* Progress Indicator */}
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
      {/* MapLibre Map */}
      <View style={styles.mapContainer}>
        <div
          ref={mapContainerRef}
          style={{ width: '100%', height: '100%' }}
        />

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
  settingsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
}));
