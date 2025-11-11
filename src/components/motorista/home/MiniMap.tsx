import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useUnistyles } from '@/utils/styles';

const { width: screenWidth } = Dimensions.get('window');

interface MiniMapProps {
  paradas: any[];
  userLocation?: { latitude: number; longitude: number };
  expanded?: boolean;
  onToggleExpand?: () => void;
  onOpenFullMap?: () => void;
  onOpenPiP?: () => void;
}

export function MiniMap({
  paradas,
  userLocation,
  expanded = false,
  onToggleExpand,
  onOpenFullMap,
  onOpenPiP,
}: MiniMapProps) {
  const { theme } = useUnistyles();
  const height = expanded ? 300 : 150;

  // Filtrar apenas paradas pendentes
  const paradasPendentes = paradas.filter(p => p.status === 'pendente');
  const paradasConcluidas = paradas.filter(p => p.status === 'concluida');

  // Calcular região do mapa
  const getMapRegion = () => {
    if (paradasPendentes.length === 0) {
      return {
        latitude: userLocation?.latitude || -23.550520,
        longitude: userLocation?.longitude || -46.633308,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };
    }

    const lats = paradasPendentes.map(p => p.latitude);
    const longs = paradasPendentes.map(p => p.longitude);

    if (userLocation) {
      lats.push(userLocation.latitude);
      longs.push(userLocation.longitude);
    }

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLong = Math.min(...longs);
    const maxLong = Math.max(...longs);

    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLong + maxLong) / 2,
      latitudeDelta: (maxLat - minLat) * 1.5,
      longitudeDelta: (maxLong - minLong) * 1.5,
    };
  };

  // Criar polyline para rota
  const getRouteCoordinates = () => {
    const coords = [];

    if (userLocation) {
      coords.push(userLocation);
    }

    paradasPendentes
      .sort((a, b) => a.ordem - b.ordem)
      .forEach(p => {
        coords.push({
          latitude: p.latitude,
          longitude: p.longitude,
        });
      });

    return coords;
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.mapContainer, { height }]}
        onPress={onOpenFullMap}
        activeOpacity={0.95}
      >
        <MapView
          provider={PROVIDER_GOOGLE}
          style={[styles.map, { height }]}
          initialRegion={getMapRegion()}
          scrollEnabled={false}
          zoomEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
        >
          {/* Marcador da localização atual */}
          {userLocation && (
            <Marker
              coordinate={userLocation}
              title="Você está aqui"
            >
              <View style={styles.userMarker}>
                <View style={styles.userMarkerDot} />
              </View>
            </Marker>
          )}

          {/* Marcadores das paradas concluídas */}
          {paradasConcluidas.map((parada, index) => (
            <Marker
              key={`concluida-${parada.id}`}
              coordinate={{
                latitude: parada.latitude,
                longitude: parada.longitude,
              }}
              opacity={0.5}
            >
              <View style={[styles.marker, styles.markerConcluida]}>
                <Ionicons name="checkmark" size={12} color="#fff" />
              </View>
            </Marker>
          ))}

          {/* Marcadores das paradas pendentes */}
          {paradasPendentes.map((parada, index) => (
            <Marker
              key={`pendente-${parada.id}`}
              coordinate={{
                latitude: parada.latitude,
                longitude: parada.longitude,
              }}
              title={`Parada ${parada.ordem}`}
              description={parada.endereco}
            >
              <View style={[
                styles.marker,
                index === 0 ? styles.markerNext : styles.markerPending
              ]}>
                <Text style={styles.markerText}>{parada.ordem}</Text>
              </View>
            </Marker>
          ))}

          {/* Linha da rota */}
          {getRouteCoordinates().length > 1 && (
            <Polyline
              coordinates={getRouteCoordinates()}
              strokeColor="#1e5aa8"
              strokeWidth={3}
              lineDashPattern={[10, 5]}
            />
          )}
        </MapView>

        {/* Overlay com informações */}
        <View style={styles.overlay}>
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              {paradasPendentes.length} paradas • {Math.round(paradas.length * 2.5)} km
            </Text>
          </View>

          {/* Botões de controle */}
          <View style={styles.controlButtons}>
            {/* Botão PiP */}
            <TouchableOpacity
              style={styles.pipButton}
              onPress={(e) => {
                e.stopPropagation();
                onOpenPiP?.();
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name="copy-outline"
                size={18}
                color="#fff"
              />
            </TouchableOpacity>

            {/* Botão de expandir */}
            <TouchableOpacity
              style={styles.expandButton}
              onPress={(e) => {
                e.stopPropagation();
                onToggleExpand?.();
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name={expanded ? 'contract' : 'expand'}
                size={20}
              color="#fff"
            />
          </TouchableOpacity>
          </View>
        </View>

      </TouchableOpacity>

      {/* Hint text */}
      <Text style={styles.hint}>Toque para abrir o mapa completo</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 8,
  },
  mapContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  map: {
    width: '100%',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 8,
  },
  infoBox: {
    backgroundColor: 'rgba(30, 90, 168, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  infoText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  controlButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  expandButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pipButton: {
    backgroundColor: 'rgba(30, 90, 168, 0.8)',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userMarkerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#3b82f6',
    borderWidth: 2,
    borderColor: '#fff',
  },
  marker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  markerNext: {
    backgroundColor: '#f59e0b',
  },
  markerPending: {
    backgroundColor: '#6b7280',
  },
  markerConcluida: {
    backgroundColor: '#10b981',
  },
  markerText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  hint: {
    fontSize: 11,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 4,
    fontStyle: 'italic',
  },
});