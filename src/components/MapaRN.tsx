import React, { useMemo, useCallback } from 'react';
import { View, TouchableOpacity, Text, Linking, Platform, Alert } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

import { useDirectionsMobile } from '@/components/map/hooks';
import { getStatusColor } from '@/components/map/infoWindowBuilders';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

interface Parada {
  id: string;
  endereco: string;
  latitude: number;
  longitude: number;
  ordem: number;
  status: string;
  is_checkpoint?: boolean;
}

interface MapaRNProps {
  paradas: Parada[];
  rotaAtiva?: boolean;
  onMarkerPress?: (paradaId: string) => void;
}

export function MapaRN({ paradas, rotaAtiva = false, onMarkerPress }: MapaRNProps) {
  const { theme } = useUnistyles();

  // Filter paradas with valid coordinates
  const validParadas = useMemo(
    () => paradas.filter((p) => p.latitude != null && p.longitude != null),
    [paradas]
  );

  // Use directions hook
  const { directions } = useDirectionsMobile({
    paradas: validParadas,
  });

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
      Alert.alert('Erro', 'Google Maps não está instalado no dispositivo.');
    }
  }, [validParadas]);

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

  if (validParadas.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Nenhuma parada para exibir</Text>
      </View>
    );
  }

  const region = {
    latitude: validParadas[0].latitude,
    longitude: validParadas[0].longitude,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={region}
      >
        {/* Stop Markers */}
        {validParadas.map((parada) => {
          const markerStyle = getMarkerStyle(parada);
          return (
            <Marker
              key={parada.id}
              coordinate={{
                latitude: parada.latitude,
                longitude: parada.longitude,
              }}
              title={markerStyle.isCheckpoint ? 'Ponto de Partida/Chegada' : `Parada ${parada.ordem}`}
              description={parada.endereco}
              onPress={() => onMarkerPress?.(parada.id)}
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
            </Marker>
          );
        })}

        {/* Route Polyline */}
        {directions && directions.coordinates.length > 0 && (
          <Polyline
            coordinates={directions.coordinates}
            strokeColor={theme.colors.primary}
            strokeWidth={4}
          />
        )}
      </MapView>

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
