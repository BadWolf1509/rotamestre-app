import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

import { useRouteDirections } from '@/hooks/useRouteDirections';
import { withOpacity } from '@/utils/color';
import { defaultTheme } from '@/utils/styles';

const colors = defaultTheme.colors;

interface Parada {
  id: string;
  ordem: number;
  endereco: string;
  latitude: number;
  longitude: number;
  status: string;
  is_checkpoint?: boolean;
}

interface Rota {
  id: string;
  distancia_total?: number;
}

interface MiniMapProps {
  paradas: Parada[];
  userLocation?: { latitude: number; longitude: number };
  expanded?: boolean;
  onToggleExpand?: () => void;
  onOpenFullMap?: () => void;
  onOpenPiP?: () => void;
  route?: Rota;
  testID?: string;
}

export function MiniMap({
  paradas,
  userLocation,
  expanded = false,
  onToggleExpand,
  onOpenFullMap,
  onOpenPiP,
  route,
  testID,
}: MiniMapProps) {
  const height = expanded ? 300 : 150;
  const mapRef = useRef<MapView>(null);
  const [mapReady, setMapReady] = useState(false);

  // Filtrar paradas por status (excluindo checkpoints)
  const paradasPendentes = useMemo(
    () => paradas.filter(p => p.status === 'pendente' && p.is_checkpoint !== false),
    [paradas]
  );
  const paradasConcluidas = useMemo(
    () => paradas.filter(p => p.status === 'concluida' && p.is_checkpoint !== false),
    [paradas]
  );

  // Todas as paradas com coordenadas válidas (para centralização)
  const todasParadasComCoord = useMemo(
    () => paradas.filter(p => p.latitude && p.longitude && !isNaN(p.latitude) && !isNaN(p.longitude)),
    [paradas]
  );

  // Checkpoints (pontos de partida/chegada da unidade) - NÃO são paradas de entrega
  const checkpoints = useMemo(
    () => todasParadasComCoord.filter(p => p.is_checkpoint === false),
    [todasParadasComCoord]
  );

  // Preparar paradas para o hook de rota
  // INCLUI checkpoints (partida/chegada da unidade) para calcular a rota completa
  const paradasParaRota = useMemo(() => {
    // Usar TODAS as paradas com coordenadas (incluindo checkpoints) para a rota
    const todasOrdenadas = [...todasParadasComCoord].sort((a, b) => a.ordem - b.ordem);

    return todasOrdenadas.map((p, idx) => ({
      id: p.id,
      ordem: idx,
      latitude: p.latitude,
      longitude: p.longitude,
    }));
  }, [todasParadasComCoord]);

  // Usar hook para buscar rota real do Google Directions API
  const { routeCoordinates, routeInfo, isLoading: isLoadingRoute } = useRouteDirections(paradasParaRota);

  // Calcular região do mapa baseada APENAS nas paradas (não na localização do usuário)
  const mapRegion = useMemo(() => {
    // Se não tem paradas, usar localização padrão (São Paulo)
    if (todasParadasComCoord.length === 0) {
      return {
        latitude: -23.550520,
        longitude: -46.633308,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };
    }

    // Centralizar APENAS nas paradas, não na localização do usuário
    // Isso evita que o mapa faça zoom out quando o usuário está longe das paradas
    const lats = todasParadasComCoord.map(p => p.latitude);
    const longs = todasParadasComCoord.map(p => p.longitude);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLong = Math.min(...longs);
    const maxLong = Math.max(...longs);

    // Calcular deltas com padding mínimo
    const latDelta = Math.max((maxLat - minLat) * 1.5, 0.01);
    const longDelta = Math.max((maxLong - minLong) * 1.5, 0.01);

    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLong + maxLong) / 2,
      latitudeDelta: latDelta,
      longitudeDelta: longDelta,
    };
  }, [todasParadasComCoord]);

  // Função para centralizar o mapa nas paradas (SEM incluir userLocation)
  const fitMapToParadas = useCallback(() => {
    if (todasParadasComCoord.length === 0 || !mapRef.current) return;

    // Centralizar APENAS nas paradas, não na localização do usuário
    // Isso evita zoom out excessivo quando o usuário está longe das paradas
    const coordinates = todasParadasComCoord.map(p => ({
      latitude: p.latitude,
      longitude: p.longitude,
    }));

    mapRef.current.fitToCoordinates(coordinates, {
      edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
      animated: false,
    });
  }, [todasParadasComCoord]);

  // Ajustar mapa quando estiver pronto E quando paradas carregarem
  useEffect(() => {
    if (mapReady && todasParadasComCoord.length > 0) {
      // Pequeno delay para garantir que o mapa está totalmente renderizado
      const timer = setTimeout(fitMapToParadas, 200);
      return () => clearTimeout(timer);
    }
  }, [mapReady, todasParadasComCoord, fitMapToParadas]);

  // Callback quando o mapa estiver pronto
  const handleMapReady = useCallback(() => {
    setMapReady(true);
  }, []);

  return (
    <View style={styles.container} testID={testID}>
      <TouchableOpacity
        style={[styles.mapContainer, { height }]}
        onPress={onOpenFullMap}
        activeOpacity={0.95}
      >
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={[styles.map, { height }]}
          initialRegion={mapRegion}
          onMapReady={handleMapReady}
          scrollEnabled={false}
          zoomEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
        >
          {userLocation && (
            <Marker
              coordinate={userLocation}
              title="Você está aqui"
              tracksViewChanges={false}
            >
              <View style={styles.userMarker}>
                <View style={styles.userMarkerDot} />
              </View>
            </Marker>
          )}

          {paradasConcluidas.map((parada) => (
            <Marker
              key={`concluida-${parada.id}`}
              coordinate={{
                latitude: parada.latitude,
                longitude: parada.longitude,
              }}
              opacity={0.5}
              tracksViewChanges={false}
            >
              <View style={[styles.marker, styles.markerConcluida]}>
                <Ionicons name="checkmark" size={12} color={colors.white} />
              </View>
            </Marker>
          ))}

          {paradasPendentes.map((parada, index) => (
            <Marker
              key={`pendente-${parada.id}`}
              coordinate={{
                latitude: parada.latitude,
                longitude: parada.longitude,
              }}
              title={`Parada ${parada.ordem}`}
              description={parada.endereco}
              tracksViewChanges={false}
            >
              <View style={[
                styles.marker,
                index === 0 ? styles.markerNext : styles.markerPending
              ]}>
                <Text style={styles.markerText}>{parada.ordem}</Text>
              </View>
            </Marker>
          ))}

          {/* Checkpoints - Pontos de partida/chegada da unidade (não são paradas de entrega) */}
          {checkpoints.map((checkpoint) => (
            <Marker
              key={`checkpoint-${checkpoint.id}`}
              coordinate={{
                latitude: checkpoint.latitude,
                longitude: checkpoint.longitude,
              }}
              title={checkpoint.ordem === 0 ? 'Partida (Unidade)' : 'Chegada (Unidade)'}
              description={checkpoint.endereco}
              tracksViewChanges={false}
            >
              <View style={styles.checkpointMarker}>
                <Ionicons
                  name={checkpoint.ordem === 0 ? 'location' : 'flag'}
                  size={20}
                  color={colors.primary}
                />
              </View>
            </Marker>
          ))}

          {routeCoordinates.length > 1 && (
            <Polyline
              coordinates={routeCoordinates}
              strokeColor={defaultTheme.colors.primary}
              strokeWidth={3}
            />
          )}
        </MapView>

        <View style={styles.overlay}>
          <View style={styles.infoBox}>
            {isLoadingRoute ? (
              <View style={styles.infoBoxLoading}>
                <ActivityIndicator size="small" color={colors.white} />
                <Text style={styles.infoText}>Calculando...</Text>
              </View>
            ) : (
              <Text style={styles.infoText}>
                {paradasPendentes.length} paradas
                {routeInfo
                  ? ` • ${(routeInfo.distanceMeters / 1000).toFixed(1)} km • ${Math.round(routeInfo.durationSeconds / 60)} min`
                  : route?.distancia_total
                    ? ` • ${Math.round(route.distancia_total)} km`
                    : ''}
              </Text>
            )}
          </View>

          <View style={styles.controlButtons}>
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
                color={colors.white}
              />
            </TouchableOpacity>

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
              color={colors.white}
            />
          </TouchableOpacity>
          </View>
        </View>

      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 16, // Unificado para 16px (8pt grid system)
  },
  mapContainer: {
    borderRadius: 16, // Aumentado de 12 para 16 (consistência)
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.gray200,
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
    backgroundColor: colors.primary,
    opacity: 0.9,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  infoBoxLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  controlButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  expandButton: {
    backgroundColor: withOpacity(colors.black, 0.5),
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pipButton: {
    backgroundColor: colors.primary,
    opacity: 0.85,
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
    backgroundColor: withOpacity(colors.info, 0.2),
    justifyContent: 'center',
    alignItems: 'center',
  },
  userMarkerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.info,
    borderWidth: 2,
    borderColor: colors.white,
  },
  marker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  markerNext: {
    backgroundColor: colors.warning,
  },
  markerPending: {
    backgroundColor: colors.gray500,
  },
  markerConcluida: {
    backgroundColor: colors.success,
  },
  markerText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  checkpointMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
});
