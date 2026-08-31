import { Ionicons } from '@expo/vector-icons';
import * as MapLibreGL from '@maplibre/maplibre-react-native';
import React, { useMemo, useCallback } from 'react';
import { View, TouchableOpacity, Text, Linking, Platform } from 'react-native';

import { useDirectionsMobile } from '@/components/map/hooks';
import { getStatusColor } from '@/components/map/infoWindowBuilders';
import { useAlert } from '@/hooks/useAlert';
import {
  OPENFREEMAP_STYLE_URL,
  toLineString,
  toLngLat,
  zoomFromLongitudeDelta,
} from '@/lib/maplibre';
import type { ParadaWithCoords as Parada } from '@/types/parada-map';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

interface MapaRNProps {
  paradas: Parada[];
  rotaAtiva?: boolean;
  selectedParadaId?: string | null;
  onMarkerPress?: (paradaId: string) => void;
}

export function MapaRN({
  paradas,
  rotaAtiva = false,
  selectedParadaId,
  onMarkerPress,
}: MapaRNProps) {
  const { theme } = useUnistyles();
  const { showError, AlertDialog } = useAlert();

  // Filter paradas with valid coordinates
  const validParadas = useMemo(
    () => paradas.filter((p) => p.latitude != null && p.longitude != null),
    [paradas],
  );

  // Use directions hook
  const { directions } = useDirectionsMobile({
    paradas: validParadas,
  });

  const routeShape = useMemo(
    () =>
      directions?.coordinates?.length
        ? toLineString(directions.coordinates)
        : null,
    [directions],
  );

  // Start navigation handler
  const handleIniciarNavegacao = useCallback(async () => {
    if (validParadas.length < 2) return;

    const origem = validParadas[0];
    const destino = validParadas[validParadas.length - 1];

    const url = Platform.select({
      ios: `maps://app?saddr=${origem.latitude},${origem.longitude}&daddr=${destino.latitude},${destino.longitude}`,
      android: `google.navigation:q=${destino.latitude},${destino.longitude}&mode=d`,
    });

    if (!url) return;

    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      showError({
        title: 'Erro',
        message: 'Google Maps não está instalado no dispositivo.',
      });
    }
  }, [showError, validParadas]);

  // Determine first/last checkpoint for partida/chegada distinction
  const checkpointIds = useMemo(() => {
    const cps = validParadas.filter((p) => p.is_checkpoint === false);
    return { partidaId: cps[0]?.id, chegadaId: cps[cps.length - 1]?.id };
  }, [validParadas]);

  // Get marker color based on status
  const getMarkerStyle = useCallback(
    (parada: Parada) => {
      const isCheckpoint = parada.is_checkpoint === false;
      if (isCheckpoint) {
        const isPartida = parada.id === checkpointIds.partidaId;
        return {
          backgroundColor: isPartida
            ? theme.colors.success
            : theme.colors.error,
          isCheckpoint: true,
          isPartida,
        };
      }
      return {
        backgroundColor: getStatusColor(parada.status),
        isCheckpoint: false,
        isPartida: false,
      };
    },
    [theme.colors.success, theme.colors.error, checkpointIds],
  );

  // Calculate initial camera settings (must be before any conditional returns)
  const initialCamera = useMemo<MapLibreGL.InitialViewState>(() => {
    if (validParadas.length === 0) {
      return {
        center: [-43.1729, -22.9068] as [number, number], // Default: Rio de Janeiro
        zoom: 10,
      };
    }
    const firstParada = validParadas[0];
    return {
      center: toLngLat({
        latitude: firstParada.latitude,
        longitude: firstParada.longitude,
      }),
      zoom: zoomFromLongitudeDelta(0.05),
    };
  }, [validParadas]);

  if (validParadas.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Nenhuma parada para exibir</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapLibreGL.Map
        style={styles.map}
        mapStyle={OPENFREEMAP_STYLE_URL}
        logo={false}
        attribution={false}
      >
        <MapLibreGL.Camera initialViewState={initialCamera} />

        {/* Stop Markers */}
        {validParadas.map((parada) => {
          const markerStyle = getMarkerStyle(parada);
          const isSelected = parada.id === selectedParadaId;
          const isCheckpoint = markerStyle.isCheckpoint;
          const markerSize = isCheckpoint ? 44 : 40;
          const borderWidth = isSelected ? 4 : 3;
          const accessLabel = isCheckpoint
            ? markerStyle.isPartida
              ? 'Ponto de Partida'
              : 'Ponto de Chegada'
            : `Parada ${parada.ordem}`;

          return (
            <MapLibreGL.Marker
              key={parada.id}
              lngLat={toLngLat({
                latitude: parada.latitude,
                longitude: parada.longitude,
              })}
              anchor="center"
            >
              <TouchableOpacity
                onPress={() => onMarkerPress?.(parada.id)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={accessLabel}
              >
                <View style={styles.markerContainer}>
                  <View
                    style={[
                      styles.marker,
                      {
                        width: markerSize,
                        height: markerSize,
                        borderRadius: markerSize / 2,
                        borderWidth,
                        borderColor: markerStyle.backgroundColor,
                        backgroundColor: theme.colors.surface,
                      },
                      isSelected && styles.markerSelected,
                    ]}
                  >
                    {isCheckpoint ? (
                      <Ionicons
                        name={markerStyle.isPartida ? 'flag' : 'flag-outline'}
                        size={isCheckpoint ? 20 : 18}
                        color={markerStyle.backgroundColor}
                      />
                    ) : (
                      <Text
                        style={[
                          styles.markerText,
                          { color: markerStyle.backgroundColor },
                        ]}
                      >
                        {parada.ordem}
                      </Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            </MapLibreGL.Marker>
          );
        })}

        {/* Route Polyline */}
        {routeShape && (
          <MapLibreGL.GeoJSONSource id="rota-gestor" data={routeShape}>
            <MapLibreGL.Layer
              id="rota-gestor-line"
              type="line"
              paint={{ 'line-color': theme.colors.primary, 'line-width': 4 }}
            />
          </MapLibreGL.GeoJSONSource>
        )}
      </MapLibreGL.Map>

      {/* Route Info Box */}
      {directions && (
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            📍 {directions.distanceText} · ⏱️ {directions.durationText}
          </Text>
        </View>
      )}

      {/* Start Navigation Button */}
      {rotaAtiva && (
        <TouchableOpacity
          style={styles.botaoNavegar}
          onPress={handleIniciarNavegacao}
          activeOpacity={0.8}
          accessibilityLabel="Navegar para destino"
          accessibilityRole="button"
        >
          <Text style={styles.botaoTexto}>🧭 Iniciar Navegação</Text>
        </TouchableOpacity>
      )}
      {AlertDialog}
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  emptyText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textSecondary,
  },
  markerContainer: {
    alignItems: 'center',
  },
  marker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.surface,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  markerSelected: {
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
    transform: [{ scale: 1.1 }],
  },
  markerText: {
    color: theme.colors.primary,
    fontWeight: 'bold',
    fontSize: theme.typography.fontSize.base,
  },
  infoBox: {
    position: 'absolute',
    top: theme.spacing.lg,
    left: theme.spacing.lg,
    right: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.sm,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  infoText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text,
    textAlign: 'center',
  },
  botaoNavegar: {
    position: 'absolute',
    bottom: theme.spacing.xl,
    left: theme.spacing.lg,
    right: theme.spacing.lg,
    backgroundColor: theme.colors.secondary,
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  botaoTexto: {
    color: theme.colors.surface,
    fontSize: theme.typography.fontSize.lg,
    fontWeight: 'bold',
    textAlign: 'center',
  },
}));
