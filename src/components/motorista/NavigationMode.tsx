import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import LocationTrackingService from '@/services/locationTracking';
import { TurnByTurnNavigation } from './TurnByTurnNavigation';
import { useUnistyles } from '@/utils/styles';
import { abrirNavegacao } from '@/lib/navigation';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface NavigationModeProps {
  currentStop: any;
  nextStop?: any;
  paradas: any[];
  onComplete: () => void;
  onSkip: () => void;
  onExit: () => void;
}

export function NavigationMode({
  currentStop,
  nextStop,
  paradas,
  onComplete,
  onSkip,
  onExit,
}: NavigationModeProps) {
  const { theme } = useUnistyles();
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
    heading?: number;
  } | null>(null);
  const [speed, setSpeed] = useState(0);
  const [distance, setDistance] = useState<number | null>(null);
  const [eta, setEta] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [navigationMode, setNavigationMode] = useState<'map' | 'turn-by-turn'>('map');
  const [internalNavEnabled, setInternalNavEnabled] = useState(false);
  const mapRef = React.useRef<MapView>(null);

  useEffect(() => {
    startNavigation();
    checkInternalNavPreference();
    return () => {
      stopNavigation();
    };
  }, [currentStop]);

  useEffect(() => {
    // Watch position updates
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
          const coords = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            heading: location.coords.heading || undefined,
          };
          setUserLocation(coords);
          setSpeed(Math.round((location.coords.speed || 0) * 3.6)); // m/s to km/h

          // Calculate distance to destination
          if (currentStop) {
            const dist = calculateDistance(
              coords.latitude,
              coords.longitude,
              currentStop.latitude,
              currentStop.longitude
            );
            setDistance(dist);

            // Estimate time of arrival
            if (location.coords.speed && location.coords.speed > 0) {
              const timeInSeconds = dist / location.coords.speed;
              const minutes = Math.ceil(timeInSeconds / 60);
              setEta(`${minutes} min`);
            }
          }
        }
      );
    })();

    return () => {
      subscription?.remove();
    };
  }, [currentStop]);

  const startNavigation = async () => {
    if (!currentStop) return;

    const tracking = await LocationTrackingService.startTracking(
      currentStop.rota_id,
      currentStop.id,
      nextStop?.id
    );
    setIsTracking(tracking);
  };

  const stopNavigation = async () => {
    await LocationTrackingService.stopTracking();
    setIsTracking(false);
  };

  const checkInternalNavPreference = async () => {
    try {
      const prefs = await AsyncStorage.getItem('navigationPreferences');
      if (prefs) {
        const parsed = JSON.parse(prefs);
        setInternalNavEnabled(parsed.internalNavigation || false);
        if (parsed.internalNavigation) {
          setNavigationMode('turn-by-turn');
        }
      }
    } catch (error) {
      console.log('Error loading nav preferences:', error);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371000; // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  const handleOpenInMaps = () => {
    if (!currentStop) return;

    // If internal nav is enabled, switch to turn-by-turn mode
    if (internalNavEnabled) {
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

  const toggleNavigationMode = () => {
    setNavigationMode(prev => prev === 'map' ? 'turn-by-turn' : 'map');
  };

  const handleCompleteStop = () => {
    Alert.alert(
      'Confirmar Entrega',
      `Confirma a entrega em:\n${currentStop.endereco}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: () => {
            onComplete();
          },
        },
      ]
    );
  };

  const handleSkipStop = () => {
    Alert.alert(
      'Pular Parada',
      `Deseja pular esta parada?\n${currentStop.endereco}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Pular',
          style: 'destructive',
          onPress: () => {
            onSkip();
          },
        },
      ]
    );
  };

  const handleExitNavigation = () => {
    Alert.alert(
      'Sair da Navegação',
      'Deseja sair do modo de navegação?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: async () => {
            await stopNavigation();
            onExit();
          },
        },
      ]
    );
  };

  const formatDistance = (meters: number): string => {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
  };

  const getRegion = () => {
    if (userLocation && currentStop) {
      const minLat = Math.min(userLocation.latitude, currentStop.latitude);
      const maxLat = Math.max(userLocation.latitude, currentStop.latitude);
      const minLon = Math.min(userLocation.longitude, currentStop.longitude);
      const maxLon = Math.max(userLocation.longitude, currentStop.longitude);

      return {
        latitude: (minLat + maxLat) / 2,
        longitude: (minLon + maxLon) / 2,
        latitudeDelta: Math.max(0.01, (maxLat - minLat) * 1.5),
        longitudeDelta: Math.max(0.01, (maxLon - minLon) * 1.5),
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
  };

  const region = getRegion();

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
        onArrive={handleCompleteStop}
        onExit={() => setNavigationMode('map')}
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        region={region}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        rotateEnabled={false}
        toolbarEnabled={false}
      >
        {/* Destination Marker */}
        <Marker
          coordinate={{
            latitude: currentStop.latitude,
            longitude: currentStop.longitude,
          }}
          title={currentStop.endereco}
          description={currentStop.observacoes}
        >
          <View style={styles.destinationMarker}>
            <Ionicons name="location" size={30} color="#dc2626" />
          </View>
        </Marker>

        {/* Other stops */}
        {paradas
          .filter((p) => p.id !== currentStop.id && p.status === 'pendente')
          .map((parada) => (
            <Marker
              key={parada.id}
              coordinate={{
                latitude: parada.latitude,
                longitude: parada.longitude,
              }}
              opacity={0.6}
            >
              <View style={styles.otherMarker}>
                <Text style={styles.markerText}>{parada.ordem}</Text>
              </View>
            </Marker>
          ))}
      </MapView>

      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.exitButton} onPress={handleExitNavigation}>
          <Ionicons name="close" size={24} color="#fff" />
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
          <Ionicons name="settings-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Navigation Info Panel */}
      <View style={styles.infoPanel}>
        {/* Distance and ETA */}
        <View style={styles.mainInfo}>
          <View style={styles.distanceContainer}>
            <Text style={styles.distanceValue}>
              {distance ? formatDistance(distance) : '--'}
            </Text>
            <Text style={styles.distanceLabel}>distância</Text>
          </View>

          <View style={styles.separator} />

          <View style={styles.etaContainer}>
            <Text style={styles.etaValue}>{eta || '--'}</Text>
            <Text style={styles.etaLabel}>chegada</Text>
          </View>

          <View style={styles.separator} />

          <View style={styles.speedContainer}>
            <Text style={styles.speedValue}>{speed}</Text>
            <Text style={styles.speedUnit}>km/h</Text>
          </View>
        </View>

        {/* Current Destination */}
        <View style={styles.destinationInfo}>
          <View style={styles.destinationHeader}>
            <Text style={styles.destinationLabel}>
              PARADA {currentStop.ordem}/{paradas.length}
            </Text>
            {nextStop && (
              <Text style={styles.nextStopHint}>
                Próxima: {nextStop.endereco.split(',')[0]}
              </Text>
            )}
          </View>
          <Text style={styles.destinationAddress}>{currentStop.endereco}</Text>

          {currentStop.destinatario && (
            <View style={styles.recipientInfo}>
              <Ionicons name="person-outline" size={14} color="#6b7280" />
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
          <TouchableOpacity
            style={[styles.actionButton, styles.skipButton]}
            onPress={handleSkipStop}
          >
            <Ionicons name="arrow-forward-circle-outline" size={20} color="#f59e0b" />
            <Text style={styles.skipButtonText}>Pular</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.mapsButton]}
            onPress={handleOpenInMaps}
          >
            <Ionicons name="navigate" size={20} color="#fff" />
            <Text style={styles.mapsButtonText}>
              {internalNavEnabled ? 'Navegar' : 'Abrir no Maps'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.completeButton]}
            onPress={handleCompleteStop}
          >
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.completeButtonText}>Concluir</Text>
          </TouchableOpacity>
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
    </View>
  );
}

// Import NavigationSettings component
import { NavigationSettings } from './NavigationSettings';

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  exitButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  trackingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  trackingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  trackingText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  infoPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  mainInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  distanceContainer: {
    alignItems: 'center',
  },
  distanceValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111827',
  },
  distanceLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  separator: {
    width: 1,
    height: 40,
    backgroundColor: '#e5e7eb',
  },
  etaContainer: {
    alignItems: 'center',
  },
  etaValue: {
    fontSize: 24,
    fontWeight: '600',
    color: '#111827',
  },
  etaLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  speedContainer: {
    alignItems: 'center',
  },
  speedValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  speedUnit: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  destinationInfo: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  destinationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  destinationLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6b7280',
    letterSpacing: 0.5,
  },
  nextStopHint: {
    fontSize: 10,
    color: '#9ca3af',
  },
  destinationAddress: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  recipientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  recipientText: {
    fontSize: 14,
    color: '#6b7280',
  },
  observationBox: {
    backgroundColor: '#fef3c7',
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  observationText: {
    fontSize: 12,
    color: '#92400e',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 8,
  },
  skipButton: {
    backgroundColor: '#fef3c7',
  },
  skipButtonText: {
    color: '#f59e0b',
    fontWeight: '600',
    fontSize: 14,
  },
  mapsButton: {
    backgroundColor: '#1e5aa8',
  },
  mapsButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  completeButton: {
    backgroundColor: '#10b981',
  },
  completeButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  destinationMarker: {
    backgroundColor: '#fff',
    borderRadius: 25,
    padding: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  otherMarker: {
    backgroundColor: '#6b7280',
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  markerText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  settingsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});