import { Ionicons } from '@expo/vector-icons';
import * as MapLibreGL from '@maplibre/maplibre-react-native';
import React, {
  useMemo,
  useRef,
  useEffect,
  useState,
  useCallback,
} from 'react';
import {
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  InteractionManager,
  Animated,
} from 'react-native';

import { useRouteDirections } from '@/hooks/useRouteDirections';
import {
  MAPLIBRE_RASTER_STYLE_JSON,
  getBounds,
  toLineString,
  toLngLat,
  zoomFromLongitudeDelta,
} from '@/lib/maplibre';
import { withOpacity } from '@/utils/color';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

import type {
  CameraRef,
  InitialViewState,
} from '@maplibre/maplibre-react-native';

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
  tempo_total?: number;
  polyline?: string | null;
}

/**
 * Verifica se as coordenadas estão em range válido
 */
const isValidCoordinate = (lat: number, lng: number): boolean =>
  !isNaN(lat) &&
  !isNaN(lng) &&
  lat >= -90 &&
  lat <= 90 &&
  lng >= -180 &&
  lng <= 180;

/**
 * Determina se uma parada é um ponto de entrega (não é checkpoint de unidade)
 *
 * ATENÇÃO: A lógica de is_checkpoint é invertida:
 * - is_checkpoint === false → É checkpoint (partida/chegada da unidade)
 * - is_checkpoint === true ou undefined → É parada de entrega normal
 */
const isDeliveryStop = (p: Parada): boolean => p.is_checkpoint !== false;

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
  const { theme } = useUnistyles();
  const expectedHeight = expanded ? 300 : 150;
  const cameraRef = useRef<CameraRef>(null);
  const [mapReady, setMapReady] = useState(false);
  const [actualMapHeight, setActualMapHeight] = useState(0);

  // Animação de pulso para o marker do usuário
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.3,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  // Filtrar paradas por status (usando helper isDeliveryStop para clareza)
  // Paradas restantes = pendentes + em andamento (não concluídas e não puladas)
  const paradasRestantes = useMemo(
    () =>
      paradas.filter(
        (p) =>
          p.status !== 'concluida' &&
          p.status !== 'pulada' &&
          isDeliveryStop(p),
      ),
    [paradas],
  );
  const paradasConcluidas = useMemo(
    () => paradas.filter((p) => p.status === 'concluida' && isDeliveryStop(p)),
    [paradas],
  );

  // Todas as paradas com coordenadas válidas (para centralização)
  const todasParadasComCoord = useMemo(
    () => paradas.filter((p) => isValidCoordinate(p.latitude, p.longitude)),
    [paradas],
  );

  // Checkpoints (pontos de partida/chegada da unidade) - NÃO são paradas de entrega
  const checkpoints = useMemo(
    () => todasParadasComCoord.filter((p) => !isDeliveryStop(p)),
    [todasParadasComCoord],
  );

  // Preparar paradas para o hook de rota
  // INCLUI checkpoints (partida/chegada da unidade) para calcular a rota completa
  const paradasParaRota = useMemo(() => {
    // Usar TODAS as paradas com coordenadas (incluindo checkpoints) para a rota
    const todasOrdenadas = [...todasParadasComCoord].sort(
      (a, b) => a.ordem - b.ordem,
    );

    return todasOrdenadas.map((p, idx) => ({
      id: p.id,
      ordem: idx,
      latitude: p.latitude,
      longitude: p.longitude,
    }));
  }, [todasParadasComCoord]);

  // Prioriza a geometria persistida; consulta OSRM apenas quando necessário.
  const {
    routeCoordinates,
    routeInfo,
    isLoading: isLoadingRoute,
    error: routeError,
  } = useRouteDirections(paradasParaRota, {
    encodedPolyline: route?.polyline,
    storedRouteInfo:
      route?.distancia_total != null && route?.tempo_total != null
        ? {
            distanceMeters: route.distancia_total * 1000,
            durationSeconds: route.tempo_total * 60,
          }
        : null,
  });

  const routeShape = useMemo(
    () => (routeCoordinates.length > 1 ? toLineString(routeCoordinates) : null),
    [routeCoordinates],
  );

  // Coordenadas das paradas restantes para calcular bounds do zoom
  // Foca o mapa nas paradas que ainda precisam ser visitadas
  const coordsParadasRestantes = useMemo(() => {
    const restantes = paradas.filter(
      (p) =>
        p.status !== 'concluida' &&
        p.status !== 'pulada' &&
        isValidCoordinate(p.latitude, p.longitude),
    );
    return restantes.map((p) => ({
      latitude: p.latitude,
      longitude: p.longitude,
    }));
  }, [paradas]);

  // Coordenadas para bounds: prioriza paradas restantes, fallback para rota completa
  const coordsForBounds = useMemo(() => {
    // Se tem paradas restantes, focar nelas
    if (coordsParadasRestantes.length > 0) return coordsParadasRestantes;
    // Fallback para rota completa se todas as paradas foram concluídas
    if (routeCoordinates.length > 1) return routeCoordinates;
    return todasParadasComCoord.map((p) => ({
      latitude: p.latitude,
      longitude: p.longitude,
    }));
  }, [coordsParadasRestantes, routeCoordinates, todasParadasComCoord]);

  // Calcular região do mapa baseada na rota (ou nas paradas quando não há rota)
  const mapRegion = useMemo(() => {
    // Se não tem paradas, usar localização padrão (São Paulo)
    if (coordsForBounds.length === 0) {
      return {
        latitude: -23.55052,
        longitude: -46.633308,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };
    }

    // Centralizar APENAS nas paradas, não na localização do usuário
    // Isso evita que o mapa faça zoom out quando o usuário está longe das paradas
    const lats = coordsForBounds.map((p) => p.latitude);
    const longs = coordsForBounds.map((p) => p.longitude);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLong = Math.min(...longs);
    const maxLong = Math.max(...longs);

    // Calcular deltas com padding adequado para visualização
    // Usar multiplicador de 1.3 (30% de margem) para zoom mais próximo da rota
    // Mínimo de 0.008 para rotas concentradas (permite ver detalhes dos markers)
    const latDelta = Math.max((maxLat - minLat) * 1.3, 0.008);
    const longDelta = Math.max((maxLong - minLong) * 1.3, 0.008);

    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLong + maxLong) / 2,
      latitudeDelta: latDelta,
      longitudeDelta: longDelta,
    };
  }, [coordsForBounds]);

  const initialCamera = useMemo<InitialViewState>(
    () => ({
      center: toLngLat({
        latitude: mapRegion.latitude,
        longitude: mapRegion.longitude,
      }),
      zoom: zoomFromLongitudeDelta(mapRegion.longitudeDelta),
    }),
    [mapRegion],
  );

  // Função para centralizar o mapa nas paradas (SEM incluir userLocation)
  const fitMapToParadas = useCallback(() => {
    if (coordsForBounds.length === 0 || !cameraRef.current) return;

    const bounds = getBounds(coordsForBounds);
    if (!bounds) return;

    // Padding PROPORCIONAL à altura do mapa para zoom consistente:
    // - Mapa colapsado (150px): padding maior proporcional → zoom OUT para ver rota toda
    // - Mapa expandido (300px): padding menor proporcional → zoom IN para ver detalhes
    //
    // Usando porcentagens da altura do mapa para diferença mais visível:
    // - Colapsado: ~40% vertical, ~30% horizontal (bem afastado)
    // - Expandido: ~12% vertical, ~8% horizontal (bem próximo)
    const topPadding = expanded ? 30 : 60; // 10% vs 40% da altura
    const bottomPadding = expanded ? 5 : 20; // ~2% vs ~13% da altura
    const horizontalPadding = expanded ? 20 : 45; // ~7% vs ~30% da largura típica

    cameraRef.current.fitBounds(
      [bounds.sw[0], bounds.sw[1], bounds.ne[0], bounds.ne[1]],
      {
        padding: {
          top: topPadding,
          right: horizontalPadding,
          bottom: bottomPadding,
          left: horizontalPadding,
        },
        duration: 500,
      },
    );
  }, [coordsForBounds, expanded]);

  // Callback quando o layout do mapa mudar (detecta redimensionamento real)
  const handleMapLayout = useCallback(
    (event: { nativeEvent: { layout: { height: number } } }) => {
      const { height } = event.nativeEvent.layout;
      setActualMapHeight(height);
    },
    [],
  );

  // Ajustar mapa quando:
  // 1. O mapa estiver pronto
  // 2. Tiver coordenadas para mostrar
  // 3. A altura real do mapa estiver próxima da esperada (tolerância de 10px para variações)
  useEffect(() => {
    const heightMatches = Math.abs(actualMapHeight - expectedHeight) < 10;

    if (mapReady && coordsForBounds.length > 0 && heightMatches) {
      // Usar InteractionManager para aguardar animações concluírem
      const handle = InteractionManager.runAfterInteractions(() => {
        fitMapToParadas();
      });
      return () => handle.cancel();
    }
  }, [
    mapReady,
    coordsForBounds,
    actualMapHeight,
    expectedHeight,
    fitMapToParadas,
  ]);

  // Trigger adicional quando expanded muda - aguarda um frame para o layout atualizar
  useEffect(() => {
    if (!mapReady || coordsForBounds.length === 0) return;

    // Aguardar um pouco para o layout atualizar e então fazer o fit
    const timeoutId = setTimeout(() => {
      fitMapToParadas();
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [expanded, mapReady, coordsForBounds.length, fitMapToParadas]);

  // Callback quando o mapa estiver pronto
  const handleMapReady = useCallback(() => {
    setMapReady(true);
  }, []);

  return (
    <View style={styles.container} testID={testID}>
      <TouchableOpacity
        style={[styles.mapContainer, { height: expectedHeight }]}
        onPress={onOpenFullMap}
        activeOpacity={0.95}
        accessibilityLabel={`Mapa da rota com ${paradasRestantes.length} paradas restantes. Toque para expandir`}
        accessibilityRole="button"
      >
        <View style={{ flex: 1 }} onLayout={handleMapLayout}>
          <MapLibreGL.Map
            testID="map-view"
            style={[styles.map, { height: expectedHeight }]}
            mapStyle={MAPLIBRE_RASTER_STYLE_JSON}
            onDidFinishLoadingMap={handleMapReady}
            dragPan={false}
            touchZoom={false}
            touchRotate={false}
            touchPitch={false}
            logo={false}
            attribution={false}
          >
            <MapLibreGL.Camera
              ref={cameraRef}
              initialViewState={initialCamera}
            />

            {userLocation && (
              <MapLibreGL.Marker
                lngLat={toLngLat(userLocation)}
                anchor="center"
              >
                <Animated.View
                  testID="marker"
                  style={[
                    styles.userMarker,
                    { transform: [{ scale: pulseAnim }] },
                  ]}
                >
                  <View style={styles.userMarkerDot} />
                </Animated.View>
              </MapLibreGL.Marker>
            )}

            {paradasConcluidas.map((parada) => (
              <MapLibreGL.Marker
                key={`concluida-${parada.id}`}
                lngLat={toLngLat({
                  latitude: parada.latitude,
                  longitude: parada.longitude,
                })}
                anchor="center"
              >
                <View
                  testID="marker"
                  style={[
                    styles.marker,
                    styles.markerConcluida,
                    { opacity: 0.5 },
                  ]}
                >
                  <Ionicons
                    name="checkmark"
                    size={12}
                    color={theme.colors.white}
                  />
                </View>
              </MapLibreGL.Marker>
            ))}

            {paradasRestantes.map((parada, index) => (
              <MapLibreGL.Marker
                key={`pendente-${parada.id}`}
                lngLat={toLngLat({
                  latitude: parada.latitude,
                  longitude: parada.longitude,
                })}
                anchor="center"
              >
                <View
                  testID="marker"
                  style={[
                    styles.marker,
                    index === 0 ? styles.markerNext : styles.markerPending,
                  ]}
                >
                  <Text style={styles.markerText}>{parada.ordem}</Text>
                </View>
              </MapLibreGL.Marker>
            ))}

            {/* Checkpoints - Pontos de partida/chegada da unidade (não são paradas de entrega) */}
            {checkpoints.map((checkpoint) => (
              <MapLibreGL.Marker
                key={`checkpoint-${checkpoint.id}`}
                lngLat={toLngLat({
                  latitude: checkpoint.latitude,
                  longitude: checkpoint.longitude,
                })}
                anchor="center"
              >
                <View style={styles.checkpointMarker}>
                  <Ionicons
                    name={checkpoint.ordem === 0 ? 'location' : 'flag'}
                    size={20}
                    color={theme.colors.primary}
                  />
                </View>
              </MapLibreGL.Marker>
            ))}

            {routeShape && (
              <MapLibreGL.GeoJSONSource id="rota-mini" data={routeShape}>
                <MapLibreGL.Layer
                  id="rota-mini-line"
                  type="line"
                  paint={{
                    'line-color': theme.colors.primary,
                    'line-width': 3,
                  }}
                />
              </MapLibreGL.GeoJSONSource>
            )}
          </MapLibreGL.Map>
        </View>

        <View style={styles.overlay}>
          <View style={styles.infoBox}>
            {isLoadingRoute ? (
              <View style={styles.infoBoxLoading}>
                <ActivityIndicator size="small" color={theme.colors.white} />
                <Text style={styles.infoText}>Calculando...</Text>
              </View>
            ) : (
              <Text style={styles.infoText}>
                {paradasRestantes.length} restantes
                {routeInfo
                  ? ` • ${(routeInfo.distanceMeters / 1000).toFixed(1)} km total`
                  : route?.distancia_total
                    ? ` • ${Math.round(route.distancia_total)} km total`
                    : ''}
                {routeError && routeCoordinates.length < 2
                  ? ' • trajeto indisponível'
                  : ''}
              </Text>
            )}
          </View>

          <View style={styles.controlButtons}>
            <TouchableOpacity
              style={styles.pipButton}
              onPress={(e) => {
                e?.stopPropagation?.();
                onOpenPiP?.();
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Abrir mapa flutuante"
              accessibilityRole="button"
            >
              <Ionicons
                name="copy-outline"
                size={18}
                color={theme.colors.white}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.expandButton}
              onPress={(e) => {
                e?.stopPropagation?.();
                onToggleExpand?.();
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel={expanded ? 'Minimizar mapa' : 'Expandir mapa'}
              accessibilityRole="button"
            >
              <Ionicons
                name={expanded ? 'contract' : 'expand'}
                size={20}
                color={theme.colors.white}
              />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    marginHorizontal: theme.spacing['4'],
    marginVertical: theme.spacing['4'], // Unificado para 16px (8pt grid system)
  },
  mapContainer: {
    borderRadius: theme.borderRadius.xl, // Aumentado de 12 para 16 (consistência)
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.gray200,
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
    padding: theme.spacing['2'],
  },
  infoBox: {
    backgroundColor: withOpacity(theme.colors.primary, 0.9),
    paddingHorizontal: theme.spacing['3'],
    paddingVertical: theme.spacing['1.5'],
    borderRadius: theme.borderRadius.xs,
  },
  infoBoxLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing['1.5'],
  },
  infoText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '600',
  },
  controlButtons: {
    flexDirection: 'row',
    gap: theme.spacing['2'],
  },
  expandButton: {
    backgroundColor: withOpacity(theme.colors.black, 0.5),
    width: 32,
    height: 32,
    borderRadius: theme.borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pipButton: {
    backgroundColor: withOpacity(theme.colors.primary, 0.85),
    width: 32,
    height: 32,
    borderRadius: theme.borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userMarker: {
    width: 24,
    height: 24,
    borderRadius: theme.borderRadius.full,
    backgroundColor: withOpacity(theme.colors.info, 0.2),
    justifyContent: 'center',
    alignItems: 'center',
  },
  userMarkerDot: {
    width: 12,
    height: 12,
    borderRadius: 6, // Metade de 12px para círculo perfeito
    backgroundColor: theme.colors.info,
    borderWidth: 2,
    borderColor: theme.colors.white,
  },
  marker: {
    width: 28,
    height: 28,
    borderRadius: theme.borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.white,
  },
  markerNext: {
    backgroundColor: theme.colors.warning,
    width: 34, // Maior que os outros (28)
    height: 34,
    borderWidth: 3, // Borda mais grossa
    shadowColor: theme.colors.warning,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 6,
  },
  markerPending: {
    backgroundColor: theme.colors.gray500,
  },
  markerConcluida: {
    backgroundColor: theme.colors.success,
  },
  markerText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '700',
  },
  checkpointMarker: {
    width: 32,
    height: 32,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.primary,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
}));
