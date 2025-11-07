import { useState, useEffect, useRef } from 'react';
import { View, Text, ActivityIndicator, Alert, TouchableOpacity, Platform } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/hooks/useUser';
import { Ionicons } from '@expo/vector-icons';

interface Parada {
  id: string;
  endereco: string;
  ordem: number;
  status: string;
  tipo: string;
  latitude: number;
  longitude: number;
  foto_url?: string | null;
}

interface Rota {
  id: string;
  status: string;
  unidades: {
    nome: string;
  };
}

export default function MapaMotorista() {
  const { theme } = useUnistyles();
  const { userData } = useUser();
  const [rota, setRota] = useState<Rota | null>(null);
  const [paradas, setParadas] = useState<Parada[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [trackingLocation, setTrackingLocation] = useState(false);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    if (userData?.id) {
      loadRotaAtiva();
      requestLocationPermission();
    }
  }, [userData]);

  async function requestLocationPermission() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      }
    } catch (error) {
      console.error('Erro ao obter localização:', error);
    }
  }

  async function loadRotaAtiva() {
    try {
      setLoading(true);

      const { data: rotasData, error: rotasError } = await supabase
        .from('rotas')
        .select('id, status, unidades(nome)')
        .eq('motorista_id', userData!.id)
        .in('status', ['pendente', 'em_andamento'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (rotasError || !rotasData) {
        setRota(null);
        setParadas([]);
        setLoading(false);
        return;
      }

      setRota(rotasData as Rota);

      const { data: paradasData, error: paradasError } = await supabase
        .from('paradas')
        .select('id, endereco, ordem, status, tipo, latitude, longitude, foto_url')
        .eq('rota_id', rotasData.id)
        .order('ordem');

      if (paradasError) throw paradasError;

      setParadas(paradasData || []);

      // Ajusta o mapa para mostrar todas as paradas
      if (paradasData && paradasData.length > 0 && mapRef.current) {
        const coordinates = paradasData.map((p) => ({
          latitude: p.latitude,
          longitude: p.longitude,
        }));

        setTimeout(() => {
          mapRef.current?.fitToCoordinates(coordinates, {
            edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
            animated: true,
          });
        }, 500);
      }
    } catch (error) {
      console.error('Erro ao carregar rota:', error);
      Alert.alert('Erro', 'Não foi possível carregar a rota');
    } finally {
      setLoading(false);
    }
  }

  function toggleLocationTracking() {
    setTrackingLocation(!trackingLocation);

    if (!trackingLocation && userLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  }

  function centerOnStops() {
    if (paradas.length > 0 && mapRef.current) {
      const coordinates = paradas.map((p) => ({
        latitude: p.latitude,
        longitude: p.longitude,
      }));

      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
        animated: true,
      });
    }
  }

  function getMarkerColor(parada: Parada): string {
    if (parada.status === 'concluida') return theme.colors.green500;
    if (parada.status === 'pulada') return theme.colors.yellow500;
    return theme.colors.red500;
  }

  function getMarkerIcon(parada: Parada): string {
    if (parada.status === 'concluida') return 'checkmark-circle';
    if (parada.status === 'pulada') return 'alert-circle';
    return 'location';
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Carregando mapa...</Text>
      </View>
    );
  }

  if (!rota || paradas.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>🗺️</Text>
        <Text style={styles.emptyTitle}>Nenhuma rota para visualizar</Text>
        <Text style={styles.emptyText}>
          Quando houver uma rota ativa, você poderá visualizar todas as paradas no mapa
        </Text>
      </View>
    );
  }

  // Calcula região inicial do mapa
  const initialRegion = paradas.length > 0 ? {
    latitude: paradas[0].latitude,
    longitude: paradas[0].longitude,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  } : undefined;

  // Prepara coordenadas para a linha de rota
  const routeCoordinates = paradas
    .filter(p => p.status !== 'pulada')
    .map((p) => ({
      latitude: p.latitude,
      longitude: p.longitude,
    }));

  return (
    <View style={styles.container}>
      {/* Header Info */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{rota.unidades.nome}</Text>
        <Text style={styles.headerSubtitle}>
          {paradas.filter(p => p.status === 'concluida').length} de {paradas.length} paradas concluídas
        </Text>
      </View>

      {/* Mapa */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={initialRegion}
        showsUserLocation={true}
        showsMyLocationButton={false}
        showsCompass={true}
        showsScale={true}
      >
        {/* Linha da rota */}
        {routeCoordinates.length > 1 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor={theme.colors.primary}
            strokeWidth={3}
            lineDashPattern={[5, 5]}
          />
        )}

        {/* Marcadores das paradas */}
        {paradas.map((parada) => (
          <Marker
            key={parada.id}
            coordinate={{
              latitude: parada.latitude,
              longitude: parada.longitude,
            }}
            title={`Parada ${parada.ordem}`}
            description={parada.endereco}
            pinColor={getMarkerColor(parada)}
          >
            <View style={[
              styles.markerContainer,
              { backgroundColor: getMarkerColor(parada) }
            ]}>
              <Text style={styles.markerText}>{parada.ordem}</Text>
            </View>
          </Marker>
        ))}

        {/* Marcador da posição do usuário (customizado) */}
        {userLocation && (
          <Marker
            coordinate={userLocation}
            title="Sua localização"
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.userMarker}>
              <View style={styles.userMarkerDot} />
            </View>
          </Marker>
        )}
      </MapView>

      {/* Controles flutuantes */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={centerOnStops}
          activeOpacity={0.7}
        >
          <Ionicons name="locate" size={24} color={theme.colors.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.controlButton,
            trackingLocation && styles.controlButtonActive
          ]}
          onPress={toggleLocationTracking}
          activeOpacity={0.7}
        >
          <Ionicons
            name={trackingLocation ? "navigate" : "navigate-outline"}
            size={24}
            color={trackingLocation ? theme.colors.white : theme.colors.primary}
          />
        </TouchableOpacity>
      </View>

      {/* Legenda */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: theme.colors.green500 }]} />
          <Text style={styles.legendText}>Concluída</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: theme.colors.yellow500 }]} />
          <Text style={styles.legendText}>Pulada</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: theme.colors.red500 }]} />
          <Text style={styles.legendText}>Pendente</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.gray50,
  },
  loadingText: {
    marginTop: 10,
    fontSize: theme.typography.sm,
    color: theme.colors.gray500,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: theme.spacing.md,
  },
  emptyTitle: {
    fontSize: theme.typography.xl,
    fontWeight: 'bold',
    color: theme.colors.gray900,
    marginBottom: theme.spacing.xs,
  },
  emptyText: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray500,
    textAlign: 'center',
  },
  header: {
    backgroundColor: theme.colors.white,
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
    zIndex: 10,
  },
  headerTitle: {
    fontSize: theme.typography.lg,
    fontWeight: 'bold',
    color: theme.colors.gray900,
  },
  headerSubtitle: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray500,
    marginTop: 4,
  },
  map: {
    flex: 1,
  },
  markerContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: theme.colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  markerText: {
    color: theme.colors.white,
    fontSize: theme.typography.sm,
    fontWeight: 'bold',
  },
  userMarker: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(66, 133, 244, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userMarkerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4285F4',
    borderWidth: 2,
    borderColor: theme.colors.white,
  },
  controls: {
    position: 'absolute',
    right: theme.spacing.md,
    top: 120,
    gap: theme.spacing.sm,
  },
  controlButton: {
    backgroundColor: theme.colors.white,
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 5,
  },
  controlButtonActive: {
    backgroundColor: theme.colors.primary,
  },
  legend: {
    position: 'absolute',
    bottom: theme.spacing.md,
    left: theme.spacing.md,
    right: theme.spacing.md,
    backgroundColor: theme.colors.white,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    flexDirection: 'row',
    justifyContent: 'space-around',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 5,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray700,
    fontWeight: '500',
  },
}));
