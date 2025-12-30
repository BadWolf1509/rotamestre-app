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
  route?: any;
  testID?: string;
}

export function MiniMap({
  paradas,
  userLocation: _userLocation,
  expanded = false,
  onToggleExpand,
  onOpenPiP: _onOpenPiP,
  route: _route,
  testID,
}: MiniMapProps) {
  const { theme } = useUnistyles();
  // Altura compacta (56px) igual ao botão Iniciar Rota, expandido mostra paradas
  const height = expanded ? 200 : 56;

  // Filtrar paradas por status (mas manter checkpoints separados)
  const paradasPendentes = paradas.filter(p => p.status === 'pendente' && p.is_checkpoint !== false);
  const _paradasConcluidas = paradas.filter(p => p.status === 'concluida' && p.is_checkpoint !== false);

  // Generate Google Maps URL - incluindo checkpoints (partida e chegada)
  const generateMapsUrl = () => {
    // Buscar todas as paradas ordenadas (incluindo checkpoints)
    const todasParadas = [...paradas].sort((a, b) => a.ordem - b.ordem);

    if (todasParadas.length === 0) {
      return '#';
    }

    // Origem: SEMPRE o primeiro ponto (checkpoint de partida ou primeira parada)
    const origin = `${todasParadas[0].latitude},${todasParadas[0].longitude}`;

    // Destino: SEMPRE o último ponto (checkpoint de chegada ou última parada)
    const destination = `${todasParadas[todasParadas.length - 1].latitude},${todasParadas[todasParadas.length - 1].longitude}`;

    // Waypoints: TODAS as paradas intermediárias (entre primeira e última)
    const waypoints = todasParadas
      .slice(1, -1)
      .map(p => `${p.latitude},${p.longitude}`)
      .join('|');

    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypoints ? `&waypoints=${waypoints}` : ''}&travelmode=driving`;

    return url;
  };

  const openGoogleMaps = () => {
    if (typeof window !== 'undefined') {
      window.open(generateMapsUrl(), '_blank');
    }
  };

  return (
    <View style={styles.container} testID={testID}>
      <TouchableOpacity
        style={[styles.mapContainer, { height }]}
        onPress={openGoogleMaps}
        activeOpacity={0.95}
      >
        <View style={[styles.mapPlaceholder, { height }]}>
          {/* Layout compacto inline quando não expandido */}
          {!expanded ? (
            <View style={styles.compactRow}>
              <Ionicons name="map-outline" size={20} color={theme.colors.primary} />
              <Text style={styles.compactText}>Ver rota no Google Maps</Text>
              <TouchableOpacity
                style={styles.expandChevron}
                onPress={(e) => {
                  e.stopPropagation();
                  onToggleExpand?.();
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="chevron-down" size={18} color={colors.gray400} />
              </TouchableOpacity>
            </View>
          ) : (
            /* Layout expandido com preview de paradas */
            <View style={styles.expandedContent}>
              <View style={styles.routeHeader}>
                <Ionicons name="map" size={24} color={theme.colors.primary} />
                <View style={styles.routeHeaderText}>
                  <Text style={styles.routeTitle}>Visualizar no Google Maps</Text>
                  <Text style={styles.routeSubtitle}>Toque para ver a rota</Text>
                </View>
                <TouchableOpacity
                  style={styles.collapseButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    onToggleExpand?.();
                  }}
                >
                  <Ionicons name="chevron-up" size={18} color={colors.gray400} />
                </TouchableOpacity>
              </View>

              {/* Preview de paradas */}
              {paradasPendentes.length > 0 && (
                <View style={styles.stopsPreview}>
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
                  {paradasPendentes.length > 3 && (
                    <Text style={styles.moreStops}>
                      +{paradasPendentes.length - 3} mais...
                    </Text>
                  )}
                </View>
              )}
            </View>
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 0,
    marginBottom: 8,
  },
  mapContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.gray200,
    backgroundColor: colors.white,
  },
  mapPlaceholder: {
    width: '100%',
    backgroundColor: colors.white,
  },
  // Layout compacto (56px)
  compactRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 10,
  },
  compactText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: colors.gray700,
  },
  expandChevron: {
    padding: 4,
  },
  // Layout expandido
  expandedContent: {
    flex: 1,
    padding: 12,
  },
  routeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  routeHeaderText: {
    flex: 1,
  },
  routeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray900,
  },
  routeSubtitle: {
    fontSize: 11,
    color: colors.gray500,
    marginTop: 1,
  },
  collapseButton: {
    padding: 4,
  },
  stopsPreview: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
  },
  stopItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 3,
  },
  stopMarker: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.gray500,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  stopNumber: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '700',
  },
  stopAddress: {
    flex: 1,
    fontSize: 12,
    color: colors.gray700,
  },
  moreStops: {
    fontSize: 11,
    color: colors.gray500,
    fontStyle: 'italic',
    marginTop: 2,
    marginLeft: 28,
  },
});



