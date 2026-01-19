/* global google */

import { Ionicons } from '@expo/vector-icons';
import { GoogleMap, useJsApiLoader, OverlayView } from '@react-google-maps/api';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import type { ParadaData } from '@/context/RouteStatusContext';
import { abrirNavegacao } from '@/lib/navigation';
import LocationTrackingService from '@/services/locationTracking';
import { calculateHaversineDistance } from '@/services/turnByTurnNavigation';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';


import { NavigationSettings } from './NavigationSettings';

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
const mapLibraries: ('marker' | 'places')[] = ['marker', 'places'];

interface NavigationModeProps {
  currentStop: ParadaData;
  nextStop?: ParadaData | null;
  paradas: ParadaData[];
  rotaId?: string;
  onComplete: () => void;
  onSkip: () => void;
  onExit: () => void;
}

export function NavigationMode({
  currentStop,
  nextStop,
  paradas,
  rotaId: _rotaId, // Not used in web version but kept for interface compatibility
  onComplete,
  onSkip,
  onExit,
}: NavigationModeProps) {
  const { theme } = useUnistyles();
  const mapRef = useRef<google.maps.Map | null>(null);

  // Load Google Maps
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: mapLibraries,
    version: 'beta',
  });

  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [distanceToStop, setDistanceToStop] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({
    autoAdvance: true,
    soundAlerts: true,
    vibrationAlerts: true,
    proximityRadius: 50,
  });
  const { autoAdvance, proximityRadius } = settings;

  // Calculate map center
  const mapCenter = useMemo(() => {
    if (userLocation && currentStop) {
      return {
        lat: (userLocation.latitude + currentStop.latitude) / 2,
        lng: (userLocation.longitude + currentStop.longitude) / 2,
      };
    }
    return currentStop
      ? { lat: currentStop.latitude, lng: currentStop.longitude }
      : { lat: -23.5505, lng: -46.6333 }; // São Paulo default
  }, [userLocation, currentStop]);

  // Calculate zoom based on distance
  const mapZoom = useMemo(() => {
    if (!userLocation || !currentStop) return 15;
    const distance = calculateHaversineDistance(
      userLocation.latitude,
      userLocation.longitude,
      currentStop.latitude,
      currentStop.longitude
    );
    if (distance > 10000) return 11;
    if (distance > 5000) return 12;
    if (distance > 2000) return 13;
    if (distance > 1000) return 14;
    return 15;
  }, [userLocation, currentStop]);

  // Pending stops for markers
  const pendingStops = useMemo(() => {
    return paradas.filter((p) => p.id !== currentStop?.id && p.status === 'pendente');
  }, [paradas, currentStop]);

  // Load settings
  const loadSettings = useCallback(async () => {
    try {
      const prefs = await LocationTrackingService.getNavigationPreferences();
      setSettings((prev) => ({
        ...prev,
        autoAdvance: prefs.autoAdvance ?? prev.autoAdvance,
        proximityRadius: prefs.proximityRadius ?? prev.proximityRadius,
      }));
    } catch {
      // Use defaults
    }
  }, []);

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

  const checkProximityToStop = useCallback(
    (userCoords: { latitude: number; longitude: number }) => {
      if (!currentStop) return;

      const distance = calculateHaversineDistance(
        userCoords.latitude,
        userCoords.longitude,
        currentStop.latitude,
        currentStop.longitude
      );

      setDistanceToStop(distance);

      if (distance < proximityRadius && autoAdvance) {
        handleArrival();
      }
    },
    [autoAdvance, currentStop, handleArrival, proximityRadius]
  );

  const startLocationTracking = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Erro', 'Permissão de localização negada');
      return;
    }

    // Get initial location
    try {
      const location = await Location.getCurrentPositionAsync({});
      const initialCoords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      setUserLocation(initialCoords);
      checkProximityToStop(initialCoords);
    } catch (error) {
      console.warn('[NavigationMode.web] Error getting initial location:', error);
    }

    // Watch location updates
    const subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 2000,
        distanceInterval: 10,
      },
      (location) => {
        const coords = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };
        setUserLocation(coords);
        checkProximityToStop(coords);
      }
    );

    return () => {
      try {
        subscription.remove();
      } catch (error) {
        console.warn('[NavigationMode.web] Error removing subscription:', error);
      }
    };
  }, [checkProximityToStop]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

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

  // Fit map to show user and destination
  useEffect(() => {
    if (mapRef.current && userLocation && currentStop) {
      const bounds = new google.maps.LatLngBounds();
      bounds.extend({ lat: userLocation.latitude, lng: userLocation.longitude });
      bounds.extend({ lat: currentStop.latitude, lng: currentStop.longitude });
      mapRef.current.fitBounds(bounds, { top: 50, right: 50, bottom: 200, left: 50 });
    }
  }, [userLocation, currentStop]);

  const formatDistance = (meters: number): string => {
    if (meters < 1000) {
      return `${Math.round(meters)} m`;
    }
    return `${(meters / 1000).toFixed(1)} km`;
  };

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
        {/* Current Stop */}
        <View style={styles.stopInfo}>
          <View style={styles.stopHeader}>
            <View style={styles.stopIcon}>
              <Ionicons name="location" size={24} color={theme.colors.primary} />
            </View>
            <View style={styles.stopDetails}>
              <Text style={styles.stopLabel}>
                PARADA {currentStop.ordem}/{paradas.length}
              </Text>
              <Text style={styles.stopAddress} numberOfLines={2}>
                {currentStop.endereco}
              </Text>
              {distanceToStop !== null && (
                <Text style={styles.distanceText}>
                  {formatDistance(distanceToStop)}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Next Stop Preview */}
        {nextStop && (
          <View style={[styles.stopInfo, styles.nextStopInfo]}>
            <View style={styles.stopHeader}>
              <View style={[styles.stopIcon, { backgroundColor: theme.colors.gray100 }]}>
                <Ionicons name="flag-outline" size={20} color={theme.colors.gray600} />
              </View>
              <View style={styles.stopDetails}>
                <Text style={[styles.stopLabel, { fontSize: 12, color: theme.colors.gray600 }]}>
                  Próxima Parada
                </Text>
                <Text style={[styles.stopAddress, { fontSize: 14 }]} numberOfLines={1}>
                  {nextStop.endereco}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.skipButton]}
            onPress={onSkip}
          >
            <Ionicons name="arrow-forward-circle" size={24} color={theme.colors.warning} />
            <Text style={[styles.actionButtonText, { color: theme.colors.warning }]}>
              Pular
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.mapsButton]}
            onPress={openExternalNavigation}
          >
            <Ionicons name="navigate" size={24} color={theme.colors.white} />
            <Text style={[styles.actionButtonText, { color: theme.colors.white }]}>
              Navegar
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.completeButton]}
            onPress={onComplete}
          >
            <Ionicons name="checkmark-circle" size={24} color={theme.colors.white} />
            <Text style={[styles.actionButtonText, { color: theme.colors.white }]}>
              Concluir
            </Text>
          </TouchableOpacity>
        </View>

        {/* Exit Button */}
        <TouchableOpacity style={styles.exitButton} onPress={onExit}>
          <Ionicons name="close" size={20} color={theme.colors.gray600} />
          <Text style={styles.exitButtonText}>Sair da Navegação</Text>
        </TouchableOpacity>
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
              <View style={styles.userMarker}>
                <View style={styles.userMarkerInner} />
              </View>
            </OverlayView>
          )}

          {/* Current Stop Marker */}
          <OverlayView
            position={{ lat: currentStop.latitude, lng: currentStop.longitude }}
            mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
          >
            <View style={styles.destinationMarker}>
              <Ionicons name="location" size={30} color={theme.colors.error} />
            </View>
          </OverlayView>

          {/* Other Pending Stops */}
          {pendingStops.map((parada) => (
            <OverlayView
              key={parada.id}
              position={{ lat: parada.latitude, lng: parada.longitude }}
              mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
            >
              <View style={styles.otherMarker}>
                <Text style={styles.markerText}>{parada.ordem}</Text>
              </View>
            </OverlayView>
          ))}
        </GoogleMap>

        {/* Top Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.topButton} onPress={onExit}>
            <Ionicons name="close" size={24} color={theme.colors.white} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.topButton}
            onPress={() => setShowSettings(true)}
          >
            <Ionicons name="settings-outline" size={24} color={theme.colors.white} />
          </TouchableOpacity>
        </View>
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
  infoContainer: {
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: theme.spacing['5'],
    paddingBottom: 30,
    elevation: 10,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  stopInfo: {
    marginBottom: theme.spacing['4'],
  },
  nextStopInfo: {
    paddingTop: theme.spacing['4'],
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray200,
  },
  stopHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stopIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.infoBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing['3'],
  },
  stopDetails: {
    flex: 1,
  },
  stopLabel: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray500,
    marginBottom: theme.spacing['1'],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stopAddress: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: '600',
    color: theme.colors.gray900,
    marginBottom: theme.spacing['1'],
  },
  distanceText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.primary,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: theme.spacing['2'],
    marginTop: theme.spacing['5'],
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: theme.borderRadius.lg,
    gap: theme.spacing['1'],
  },
  skipButton: {
    backgroundColor: theme.colors.warningBg,
    borderWidth: 1,
    borderColor: theme.colors.secondaryLight,
  },
  mapsButton: {
    backgroundColor: theme.colors.primary,
  },
  completeButton: {
    backgroundColor: theme.colors.success,
  },
  actionButtonText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '600',
  },
  exitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing['4'],
    paddingVertical: theme.spacing['3'],
    gap: theme.spacing['2'],
  },
  exitButtonText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray500,
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
  destinationMarker: {
    backgroundColor: theme.colors.white,
    borderRadius: 20,
    padding: 4,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  otherMarker: {
    backgroundColor: theme.colors.gray500,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.white,
  },
  markerText: {
    color: theme.colors.white,
    fontSize: 11,
    fontWeight: '600',
  },
  settingsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
}));
