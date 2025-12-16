import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import React, { useRef, useEffect, useMemo, useCallback, useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, Region, Callout } from 'react-native-maps';

import { MotoristaMarker } from '@/components/MotoristaMarker';
import { useRouteDirections } from '@/hooks/useRouteDirections';
import { showNavigationOptions } from '@/utils/navigation';
import { StyleSheet, type Theme } from '@/utils/styles';

interface Parada {
  id: string;
  ordem: number;
  endereco: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
  is_checkpoint?: boolean;
}

type StatusFilter = 'all' | 'pendente' | 'em_andamento' | 'concluida';

interface MapaMobileProps {
  paradas: Parada[];
  selectedParadaId?: string | null;
  onMarkerPress?: (paradaId: string) => void;
  statusFilter?: StatusFilter;
  /** ID da rota para rastreamento em tempo real do motorista */
  rotaId?: string;
  /** Nome do motorista para exibir no marcador */
  motoristaNome?: string;
  /** Se true e rota em andamento, mostra posição do motorista em tempo real */
  showMotorista?: boolean;
}

export function MapaMobile({
  paradas,
  selectedParadaId,
  onMarkerPress,
  statusFilter = 'all',
  rotaId,
  motoristaNome,
  showMotorista = false,
}: MapaMobileProps) {
  const mapRef = useRef<MapView>(null);
  const [isLocating, setIsLocating] = useState(false);

  // Filtrar paradas com coordenadas válidas
  const paradasComCoord = useMemo(
    () => paradas.filter((p) => p.latitude !== null && p.longitude !== null),
    [paradas]
  );
  const hasParadasComCoordenadas = paradasComCoord.length > 0;

  // Separar paradas reais de checkpoints (pontos da unidade)
  const paradasReais = useMemo(
    () => paradasComCoord.filter((p) => p.is_checkpoint !== false),
    [paradasComCoord]
  );

  // Paradas filtradas por status
  const paradasFiltradas = useMemo(() => {
    if (statusFilter === 'all') return paradasReais;
    return paradasReais.filter((p) => p.status === statusFilter);
  }, [paradasReais, statusFilter]);

  const checkpoints = useMemo(
    () => paradasComCoord.filter((p) => p.is_checkpoint === false),
    [paradasComCoord]
  );

  // Buscar rota real usando Google Directions API
  const { routeCoordinates, routeInfo, isLoading: isLoadingRoute } = useRouteDirections(
    paradasComCoord as Parada[]
  );

    // Ajustar mapa para mostrar todas as paradas após carregar
  useEffect(() => {
    if (paradasComCoord.length > 1 && mapRef.current) {
      const timer = setTimeout(() => {
        mapRef.current?.fitToCoordinates(
          paradasComCoord.map((p) => ({
            latitude: p.latitude!,
            longitude: p.longitude!,
          })),
          {
            edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
            animated: true,
          }
        );
      }, 500);

      return () => clearTimeout(timer);
    }
    return undefined;
  }, [paradasComCoord]);

  // Calcular região inicial (centro das paradas)
  const initialRegion = useMemo<Region>(() => {
    if (!hasParadasComCoordenadas) {
      return {
        latitude: 0,
        longitude: 0,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
    }

    if (paradasComCoord.length === 1) {
      return {
        latitude: paradasComCoord[0].latitude!,
        longitude: paradasComCoord[0].longitude!,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }

    // Calcular bounds de todas as paradas
    let minLat = paradasComCoord[0].latitude!;
    let maxLat = paradasComCoord[0].latitude!;
    let minLng = paradasComCoord[0].longitude!;
    let maxLng = paradasComCoord[0].longitude!;

    paradasComCoord.forEach((p) => {
      minLat = Math.min(minLat, p.latitude!);
      maxLat = Math.max(maxLat, p.latitude!);
      minLng = Math.min(minLng, p.longitude!);
      maxLng = Math.max(maxLng, p.longitude!);
    });

    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;
    const deltaLat = (maxLat - minLat) * 1.5; // 1.5x para margem
    const deltaLng = (maxLng - minLng) * 1.5;

    return {
      latitude: centerLat,
      longitude: centerLng,
      latitudeDelta: Math.max(deltaLat, 0.01),
      longitudeDelta: Math.max(deltaLng, 0.01),
    };
  }, [hasParadasComCoordenadas, paradasComCoord]);

// Função para determinar cor do marcador baseado no status
  const getMarkerColor = (status: string): string => {
    switch (status) {
      case 'concluida':
        return '#10b981'; // Verde
      case 'em_andamento':
        return '#3b82f6'; // Azul
      case 'pendente':
        return '#f59e0b'; // Amarelo
      default:
        return '#6b7280'; // Cinza
    }
  };

  // Próxima parada pendente (para navegação)
  const proximaParadaPendente = useMemo(() => {
    return paradasReais
      .filter((p) => p.status === 'pendente' || p.status === 'em_andamento')
      .sort((a, b) => a.ordem - b.ordem)[0];
  }, [paradasReais]);

  // Centralizar no usuário
  const handleCenterOnUser = useCallback(async () => {
    setIsLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão negada', 'Permita o acesso à localização para usar esta função.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const newUserLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      mapRef.current?.animateToRegion({
        ...newUserLocation,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 500);
    } catch (error) {
      console.error('[MapaMobile] Erro ao obter localização:', error);
      Alert.alert('Erro', 'Não foi possível obter sua localização.');
    } finally {
      setIsLocating(false);
    }
  }, []);

  // Navegar para próxima parada usando app externo
  const handleNavigate = useCallback(() => {
    if (!proximaParadaPendente) {
      Alert.alert('Nenhuma parada', 'Não há paradas pendentes para navegar.');
      return;
    }

    showNavigationOptions({
      latitude: proximaParadaPendente.latitude!,
      longitude: proximaParadaPendente.longitude!,
      label: `Parada ${proximaParadaPendente.ordem} - ${proximaParadaPendente.endereco}`,
    });
  }, [proximaParadaPendente]);

  // Ajustar mapa para mostrar todas as paradas
  const handleFitAll = useCallback(() => {
    if (paradasComCoord.length > 0 && mapRef.current) {
      mapRef.current.fitToCoordinates(
        paradasComCoord.map((p) => ({
          latitude: p.latitude!,
          longitude: p.longitude!,
        })),
        {
          edgePadding: { top: 80, right: 50, bottom: 120, left: 50 },
          animated: true,
        }
      );
    }
  }, [paradasComCoord]);

  if (!hasParadasComCoordenadas) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          📍 Nenhuma parada com localização disponível
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation={true}
        showsMyLocationButton={true}
        showsCompass={true}
        loadingEnabled={true}
        loadingIndicatorColor="#0D5A9C"
        loadingBackgroundColor="#ffffff"
      >
        {/* Rota real (via Google Directions API) ou fallback para linhas retas */}
        {routeCoordinates.length > 1 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor="#0D5A9C"
            strokeWidth={4}
          />
        )}

        {/* Marcadores dos checkpoints (pontos da unidade - partida/chegada) */}
        {checkpoints.map((parada) => (
          <Marker
            key={parada.id}
            coordinate={{
              latitude: parada.latitude!,
              longitude: parada.longitude!,
            }}
            title={parada.ordem === 0 ? 'Ponto de Partida' : 'Ponto de Chegada'}
            description={parada.endereco}
            tracksViewChanges={false}
          >
            {/* Marcador especial para checkpoints (pin azul) */}
            <View style={styles.checkpointMarker}>
              <Ionicons
                name={parada.ordem === 0 ? 'location' : 'flag'}
                size={24}
                color="#284093"
              />
            </View>
          </Marker>
        ))}

        {/* Marcadores das paradas reais (entregas/retiradas) - filtradas por status */}
        {paradasFiltradas.map((parada) => (
          <Marker
            key={parada.id}
            coordinate={{
              latitude: parada.latitude!,
              longitude: parada.longitude!,
            }}
            onPress={() => onMarkerPress?.(parada.id)}
            tracksViewChanges={false}
          >
            {/* Customizar marcador com número da ordem */}
            <View style={[
              styles.markerContainer,
              { backgroundColor: getMarkerColor(parada.status) },
              selectedParadaId === parada.id && styles.markerSelected,
            ]}>
              <Text style={styles.markerText}>{parada.ordem}</Text>
            </View>
            {/* Callout com informações da parada */}
            <Callout
              tooltip
              onPress={() => onMarkerPress?.(parada.id)}
            >
              <View style={styles.calloutContainer}>
                <Text style={styles.calloutTitle}>Parada {parada.ordem}</Text>
                <Text style={styles.calloutAddress} numberOfLines={2}>{parada.endereco}</Text>
                <View style={[styles.calloutStatus, { backgroundColor: `${getMarkerColor(parada.status)}20` }]}>
                  <Text style={[styles.calloutStatusText, { color: getMarkerColor(parada.status) }]}>
                    {parada.status === 'concluida' ? 'Concluída' : parada.status === 'em_andamento' ? 'Em andamento' : 'Pendente'}
                  </Text>
                </View>
              </View>
            </Callout>
          </Marker>
        ))}

        {/* Marcador do motorista em tempo real */}
        {showMotorista && rotaId && (
          <MotoristaMarker
            rotaId={rotaId}
            motoristaNome={motoristaNome}
            realtime={true}
          />
        )}
      </MapView>

      {/* Info Badge - mostra paradas e info da rota */}
      <View style={styles.infoBadge}>
        {isLoadingRoute ? (
          <View style={styles.infoBadgeLoading}>
            <ActivityIndicator size="small" color="#0D5A9C" />
            <Text style={styles.infoBadgeText}>Calculando rota...</Text>
          </View>
        ) : (
          <Text style={styles.infoBadgeText}>
            📍 {paradasFiltradas.length}{statusFilter !== 'all' ? `/${paradasReais.length}` : ''} parada{paradasFiltradas.length !== 1 ? 's' : ''}
            {routeInfo && ` • ${(routeInfo.distanceMeters / 1000).toFixed(1)} km • ${Math.round(routeInfo.durationSeconds / 60)} min`}
          </Text>
        )}
      </View>

      {/* Botões flutuantes (FABs) */}
      <View style={styles.fabContainer}>
        {/* Botão de ajustar para mostrar todas as paradas */}
        <TouchableOpacity
          style={styles.fabSecondary}
          onPress={handleFitAll}
          activeOpacity={0.8}
        >
          <Ionicons name="scan-outline" size={22} color="#0D5A9C" />
        </TouchableOpacity>

        {/* Botão de centralizar no usuário */}
        <TouchableOpacity
          style={styles.fabSecondary}
          onPress={handleCenterOnUser}
          activeOpacity={0.8}
          disabled={isLocating}
        >
          {isLocating ? (
            <ActivityIndicator size="small" color="#0D5A9C" />
          ) : (
            <Ionicons name="locate" size={22} color="#0D5A9C" />
          )}
        </TouchableOpacity>

        {/* Botão principal de navegação */}
        {proximaParadaPendente && (
          <TouchableOpacity
            style={styles.fabPrimary}
            onPress={handleNavigate}
            activeOpacity={0.8}
          >
            <Ionicons name="navigate" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    flex: 1,
    minHeight: 300,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: theme.colors.disabled,
  },
  map: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    minHeight: 300,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.disabled,
    borderRadius: 12,
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  markerContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: theme.colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  checkpointMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(40, 64, 147, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#284093',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  markerText: {
    color: theme.colors.surface,
    fontSize: 14,
    fontWeight: 'bold',
  },
  markerSelected: {
    borderWidth: 4,
    borderColor: '#0D5A9C',
    transform: [{ scale: 1.2 }],
  },
  calloutContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 12,
    minWidth: 200,
    maxWidth: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  calloutTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 4,
  },
  calloutAddress: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: 8,
    lineHeight: 18,
  },
  calloutStatus: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  calloutStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  infoBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoBadgeLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.text,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 20,
    right: 16,
    gap: 12,
  },
  fabPrimary: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0D5A9C',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  fabSecondary: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
}));
