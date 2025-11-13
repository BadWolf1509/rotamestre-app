import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { defaultTheme, useUnistyles } from '@/utils/styles';

const colors = defaultTheme.colors;

interface MiniMapProps {
  paradas: any[];
  userLocation?: { latitude: number; longitude: number };
  expanded?: boolean;
  onToggleExpand?: () => void;
  onOpenPiP?: () => void;
}

export function MiniMap({
  paradas,
  userLocation,
  expanded = false,
  onToggleExpand,
  onOpenPiP,
}: MiniMapProps) {
  const { theme } = useUnistyles();
  const height = expanded ? 300 : 150;

  // Filtrar apenas paradas pendentes
  const paradasPendentes = paradas.filter(p => p.status === 'pendente');
  const paradasConcluidas = paradas.filter(p => p.status === 'concluida');

  // Generate Google Maps URL
  const generateMapsUrl = () => {
    if (paradasPendentes.length === 0) return '#';

    const origin = userLocation
      ? `${userLocation.latitude},${userLocation.longitude}`
      : `${paradasPendentes[0].latitude},${paradasPendentes[0].longitude}`;

    const destination = paradasPendentes.length > 0
      ? `${paradasPendentes[paradasPendentes.length - 1].latitude},${paradasPendentes[paradasPendentes.length - 1].longitude}`
      : origin;

    const waypoints = paradasPendentes
      .slice(1, -1)
      .map(p => `${p.latitude},${p.longitude}`)
      .join('|');

    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypoints ? `&waypoints=${waypoints}` : ''}&travelmode=driving`;
  };

  const openGoogleMaps = () => {
    if (typeof window !== 'undefined') {
      window.open(generateMapsUrl(), '_blank');
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.mapContainer, { height }]}
        onPress={openGoogleMaps}
        activeOpacity={0.95}
      >
        {/* Map Placeholder for Web */}
        <View style={[styles.mapPlaceholder, { height }]}>
          {/* Simulated route visualization */}
          <View style={styles.routeInfo}>
            <View style={styles.routeHeader}>
              <Ionicons name="map" size={32} color={theme.colors.primary} />
              <Text style={styles.routeTitle}>Visualização de Rota</Text>
            </View>

            <View style={styles.statsContainer}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{paradasPendentes.length}</Text>
                <Text style={styles.statLabel}>Pendentes</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statValue, { color: theme.colors.success }]}>
                  {paradasConcluidas.length}
                </Text>
                <Text style={styles.statLabel}>Concluídas</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>
                  {Math.round(paradas.length * 2.5)}
                </Text>
                <Text style={styles.statLabel}>km total</Text>
              </View>
            </View>

            {expanded && (
              <View style={styles.stopsPreview}>
                <Text style={styles.stopsTitle}>Próximas Paradas:</Text>
                {paradasPendentes.slice(0, 3).map((parada, index) => (
                  <View key={parada.id} style={styles.stopItem}>
                    <View style={[
                      styles.stopMarker,
                      index === 0 && { backgroundColor: colors.warning }
                    ]}>
                      <Text style={styles.stopNumber}>{parada.ordem}</Text>
                    </View>
                    <Text style={styles.stopAddress} numberOfLines={1}>
                      {parada.endereco}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Overlay with info */}
          <View style={styles.overlay}>
            <View style={styles.infoBox}>
            <Text style={styles.infoText}>
                {paradasPendentes.length} paradas • {Math.round(paradas.length * 2.5)} km
              </Text>
            </View>

            {/* Control buttons */}
            <View style={styles.controlButtons}>
              {/* PiP button */}
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

              {/* Expand button */}
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
        </View>
      </TouchableOpacity>

      {/* Hint text */}
      <Text style={styles.hint}>Toque para abrir no Google Maps</Text>
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
    borderColor: colors.gray200,
  },
  mapPlaceholder: {
    width: '100%',
    backgroundColor: colors.gray50,
    position: 'relative',
  },
  routeInfo: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
  },
  routeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  routeTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.gray900,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  statBox: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: defaultTheme.colors.primary,
  },
  statLabel: {
    fontSize: 12,
    color: colors.gray500,
    marginTop: 4,
  },
  stopsPreview: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
  },
  stopsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray700,
    marginBottom: 8,
  },
  stopItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  stopMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.gray500,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  stopNumber: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  stopAddress: {
    flex: 1,
    fontSize: 12,
    color: colors.gray600,
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
    color: colors.white,
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
  hint: {
    fontSize: 11,
    color: colors.gray500,
    textAlign: 'center',
    marginTop: 4,
    fontStyle: 'italic',
  },
});



