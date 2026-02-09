import MapLibreGL from '@maplibre/maplibre-react-native';
import React, { useMemo, useCallback } from 'react';
import { View, TouchableOpacity, Text, Linking, Platform } from 'react-native';

import { useDirectionsMobile } from '@/components/map/hooks';
import { getStatusColor } from '@/components/map/infoWindowBuilders';
import { useAlert } from '@/hooks/useAlert';
import { MAPLIBRE_RASTER_STYLE, toLineString, toLngLat, zoomFromLongitudeDelta } from '@/lib/maplibre';
import type { ParadaWithCoords as Parada } from '@/types/parada-map';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

interface MapaRNProps {
  paradas: Parada[];
  rotaAtiva?: boolean;
  onMarkerPress?: (paradaId: string) => void;
}

export function MapaRN({ paradas, rotaAtiva = false, onMarkerPress }: MapaRNProps) {
  const { theme } = useUnistyles();
  const { showError, AlertDialog } = useAlert();

  // Filter paradas with valid coordinates
  const validParadas = useMemo(
    () => paradas.filter((p) => p.latitude != null && p.longitude != null),
    [paradas]
  );

  // Use directions hook
  const { directions } = useDirectionsMobile({
    paradas: validParadas,
  });

  const routeShape = useMemo(
    () => (directions?.coordinates?.length ? toLineString(directions.coordinates) : null),
    [directions]
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
      showError({ title: 'Erro', message: 'Google Maps não está instalado no dispositivo.' });
    }
  }, [showError, validParadas]);

  // Get marker color based on status
  const getMarkerStyle = useCallback((parada: Parada) => {
    const isCheckpoint = parada.is_checkpoint === false;
    if (isCheckpoint) {
      return {
        backgroundColor: theme.colors.primary,
        isCheckpoint: true,
      };
    }
    return {
      backgroundColor: getStatusColor(parada.status),
      isCheckpoint: false,
    };
  }, [theme.colors.primary]);

  // Calculate initial camera settings (must be before any conditional returns)
  const initialCamera = useMemo(() => {
    if (validParadas.length === 0) {
      return {
        centerCoordinate: [-43.1729, -22.9068] as [number, number], // Default: Rio de Janeiro
        zoomLevel: 10,
      };
    }
    const firstParada = validParadas[0];
    return {
      centerCoordinate: toLngLat({
        latitude: firstParada.latitude,
        longitude: firstParada.longitude,
      }),
      zoomLevel: zoomFromLongitudeDelta(0.05),
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
      <MapLibreGL.MapView
        style={styles.map}
        mapStyle={MAPLIBRE_RASTER_STYLE}
        logoEnabled={false}
        attributionEnabled={false}
      >
        <MapLibreGL.Camera defaultSettings={initialCamera} />

        {/* Stop Markers */}
        {validParadas.map((parada) => {
          const markerStyle = getMarkerStyle(parada);
          return (
            <MapLibreGL.MarkerView
              key={parada.id}
              coordinate={toLngLat({
                latitude: parada.latitude,
                longitude: parada.longitude,
              })}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <TouchableOpacity
                onPress={() => onMarkerPress?.(parada.id)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={markerStyle.isCheckpoint ? 'Ponto de Partida/Chegada' : `Parada ${parada.ordem}`}
              >
                <View style={styles.markerContainer}>
                  <View style={[
                    styles.marker,
                    { backgroundColor: markerStyle.backgroundColor },
                  ]}>
                    {markerStyle.isCheckpoint ? (
                      <Text style={styles.markerIcon}>📍</Text>
                    ) : (
                      <Text style={styles.markerText}>{parada.ordem}</Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            </MapLibreGL.MarkerView>
          );
        })}

        {/* Route Polyline */}
        {routeShape && (
          <MapLibreGL.ShapeSource id="rota-gestor" shape={routeShape}>
            <MapLibreGL.LineLayer
              id="rota-gestor-line"
              style={{ lineColor: theme.colors.primary, lineWidth: 4 }}
            />
          </MapLibreGL.ShapeSource>
        )}
      </MapLibreGL.MapView>

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
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: theme.colors.surface,
  },
  markerText: {
    color: theme.colors.surface,
    fontWeight: 'bold',
    fontSize: theme.typography.fontSize.sm,
  },
  markerIcon: {
    fontSize: 16,
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
