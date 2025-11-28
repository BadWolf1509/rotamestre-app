import { Ionicons } from '@expo/vector-icons';
import React, { useRef, useEffect, useMemo } from 'react';
import { View, Text } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, Region } from 'react-native-maps';

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

interface MapaMobileProps {
  paradas: Parada[];
}

export function MapaMobile({ paradas }: MapaMobileProps) {
  const mapRef = useRef<MapView>(null);

  // Filtrar paradas com coordenadas válidas
  const paradasComCoord = useMemo(
    () => paradas.filter((p) => p.latitude !== null && p.longitude !== null),
    [paradas]
  );

  // Separar paradas reais de checkpoints (pontos da unidade)
  const paradasReais = useMemo(
    () => paradasComCoord.filter((p) => p.is_checkpoint !== false),
    [paradasComCoord]
  );

  const checkpoints = useMemo(
    () => paradasComCoord.filter((p) => p.is_checkpoint === false),
    [paradasComCoord]
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

  // Se não houver paradas com coordenadas
  if (paradasComCoord.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          📍 Nenhuma parada com localização disponível
        </Text>
      </View>
    );
  }

  // Calcular região inicial (centro das paradas)
  const calculateRegion = (): Region => {
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

    paradasComCoord.forEach(p => {
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
  };

  const initialRegion = calculateRegion();

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
        {/* Linha conectando todas as paradas */}
        {paradasComCoord.length > 1 && (
          <Polyline
            coordinates={paradasComCoord.map(p => ({
              latitude: p.latitude!,
              longitude: p.longitude!,
            }))}
            strokeColor="#0D5A9C"
            strokeWidth={4}
            lineDashPattern={[1]}
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

        {/* Marcadores das paradas reais (entregas/retiradas) */}
        {paradasReais.map((parada) => (
          <Marker
            key={parada.id}
            coordinate={{
              latitude: parada.latitude!,
              longitude: parada.longitude!,
            }}
            title={`Parada ${parada.ordem}`}
            description={parada.endereco}
            pinColor={getMarkerColor(parada.status)}
          >
            {/* Customizar marcador com número da ordem */}
            <View style={[
              styles.markerContainer,
              { backgroundColor: getMarkerColor(parada.status) }
            ]}>
              <Text style={styles.markerText}>{parada.ordem}</Text>
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Info Badge - mostra apenas paradas reais */}
      <View style={styles.infoBadge}>
        <Text style={styles.infoBadgeText}>
          📍 {paradasReais.length} parada{paradasReais.length !== 1 ? 's' : ''}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    height: 400,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: theme.colors.disabled,
  },
  map: {
    flex: 1,
  },
  emptyContainer: {
    height: 400,
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
  infoBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.text,
  },
}));
