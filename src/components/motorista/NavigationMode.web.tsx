import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { abrirNavegacao } from '@/lib/navigation';
import LocationTrackingService from '@/services/locationTracking';
import { defaultTheme, useUnistyles } from '@/utils/styles';

const colors = defaultTheme.colors;

interface NavigationModeProps {
  currentStop: any;
  nextStop?: any;
  onComplete: () => void;
  onSkip: () => void;
  onExit: () => void;
}

export function NavigationMode({
  currentStop,
  nextStop,
  onComplete,
  onSkip,
  onExit,
}: NavigationModeProps) {
  const { theme } = useUnistyles();
  const [distanceToStop, setDistanceToStop] = useState<number | null>(null);
  const [settings, setSettings] = useState({
    autoAdvance: true,
    soundAlerts: true,
    vibrationAlerts: true,
    proximityRadius: 50,
  });
  const { autoAdvance, proximityRadius } = settings;

  // Declare helper functions BEFORE they are used to avoid "used before declaration" errors
  const loadSettings = useCallback(async () => {
    const prefs = await LocationTrackingService.getNavigationPreferences();
    setSettings(prefs as any);
  }, []);

  const calculateDistance = useCallback(
    (lat1: number, lon1: number, lat2: number, lon2: number): number => {
      const EARTH_RADIUS = 6371000;
      const phi1 = (lat1 * Math.PI) / 180;
      const phi2 = (lat2 * Math.PI) / 180;
      const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
      const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

      const a =
        Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
        Math.cos(phi1) *
          Math.cos(phi2) *
          Math.sin(deltaLambda / 2) *
          Math.sin(deltaLambda / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

      return EARTH_RADIUS * c;
    },
    []
  );

  const handleArrival = useCallback(() => {
    Alert.alert(
      'Chegou ao Destino!',
      `Voce chegou em: ${currentStop.endereco}`,
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

      const distance = calculateDistance(
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
    [autoAdvance, calculateDistance, currentStop, handleArrival, proximityRadius]
  );

  const startLocationTracking = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Erro', 'Permissão de localização negada');
      return;
    }

    // Get initial location
    const location = await Location.getCurrentPositionAsync({});
    const initialCoords = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
    checkProximityToStop(initialCoords);

    // Watch location updates
    const subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 1000,
        distanceInterval: 10,
      },
      (location) => {
        const coords = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };
        checkProximityToStop(coords);
      }
    );

    return () => {
      try {
        subscription.remove();
      } catch (error) {
        // expo-location remove() não funciona corretamente na web
        console.warn('[NavigationMode] Error removing subscription:', error);
      }
    };
  }, [checkProximityToStop]);

  useEffect(() => {
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // loadSettings é estável (useCallback com deps vazias)

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const initialize = async () => {
      cleanup = await startLocationTracking();
    };

    initialize();

    return () => {
      cleanup?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // startLocationTracking é estável (useCallback)

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

  return (
    <View style={styles.container}>
      {/* Map Placeholder for Web */}
      <View style={styles.mapContainer}>
        <View style={styles.mapPlaceholder}>
          <Ionicons name="map-outline" size={80} color={theme.colors.gray400} />
          <Text style={styles.mapPlaceholderText}>
            Mapa não disponível na versão web
          </Text>
          <TouchableOpacity
            style={styles.openMapButton}
            onPress={openExternalNavigation}
          >
            <Text style={styles.openMapButtonText}>Abrir no Google Maps</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Navigation Info */}
      <View style={styles.infoContainer}>
        {/* Current Stop */}
        <View style={styles.stopInfo}>
          <View style={styles.stopHeader}>
            <View style={styles.stopIcon}>
              <Ionicons name="location" size={24} color={theme.colors.primary} />
            </View>
            <View style={styles.stopDetails}>
              <Text style={styles.stopLabel}>Destino Atual</Text>
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
            style={[styles.actionButton, styles.completeButton]}
            onPress={onComplete}
          >
            <Ionicons name="checkmark-circle" size={24} color={colors.white} />
            <Text style={[styles.actionButtonText, { color: '#fff' }]}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black,
  },
  mapContainer: {
    flex: 1,
    backgroundColor: colors.gray100,
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.gray50,
  },
  mapPlaceholderText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.gray500,
  },
  openMapButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: defaultTheme.colors.primary,
    borderRadius: 8,
  },
  openMapButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoContainer: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 30,
    elevation: 10,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  stopInfo: {
    marginBottom: 16,
  },
  nextStopInfo: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
  },
  stopHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stopIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.infoBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stopDetails: {
    flex: 1,
  },
  stopLabel: {
    fontSize: 12,
    color: colors.gray500,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stopAddress: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray900,
    marginBottom: 4,
  },
  distanceText: {
    fontSize: 14,
    color: defaultTheme.colors.primary,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  skipButton: {
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: colors.secondaryLight,
  },
  completeButton: {
    backgroundColor: colors.success,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  exitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingVertical: 12,
    gap: 8,
  },
  exitButtonText: {
    fontSize: 14,
    color: colors.gray500,
  },
});

