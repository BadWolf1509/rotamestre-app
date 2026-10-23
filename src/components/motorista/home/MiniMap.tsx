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
  AccessibilityInfo,
} from 'react-native';

import { useRouteDirections } from '@/hooks/useRouteDirections';
import {
  OPENFREEMAP_STYLE_URL,
  getBounds,
  toLineString,
  toLngLat,
  zoomFromLongitudeDelta,
} from '@/lib/maplibre';
import { temCoordenadaValida } from '@/lib/motorista/coordenadaValida';
import { montarPinosDoMiniMap } from '@/lib/motorista/pinosPorLocal';
import { withOpacity } from '@/utils/color';
import { StyleSheet, type Theme } from '@/utils/styles';

import {
  CORES_SOBRE_O_MAPA,
  MAX_FONTE_SOBRE_O_MAPA,
  rotuloParadasRestantes,
  textoDoChip,
} from './miniMapCompartilhado';

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
  route?: Rota;
  testID?: string;
}

export function MiniMap({
  paradas,
  userLocation,
  expanded = false,
  onToggleExpand,
  onOpenFullMap,
  route,
  testID,
}: MiniMapProps) {
  const expectedHeight = expanded ? 300 : 150;
  const cameraRef = useRef<CameraRef>(null);
  const [mapReady, setMapReady] = useState(false);
  const [actualMapHeight, setActualMapHeight] = useState(0);

  // Animação de pulso para o marker do usuário
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // "Reduzir movimento" do sistema: sem pulso. `null` enquanto não se sabe,
  // para não começar a pulsar e parar logo em seguida.
  const [reduzirMovimento, setReduzirMovimento] = useState<boolean | null>(
    null,
  );
  useEffect(() => {
    let ativo = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((valor) => {
        if (ativo) setReduzirMovimento(valor);
      })
      .catch(() => {
        // Sem a resposta do sistema, segue o padrão (com animação).
        if (ativo) setReduzirMovimento(false);
      });
    const assinatura = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduzirMovimento,
    );
    return () => {
      ativo = false;
      assinatura?.remove();
    };
  }, []);

  useEffect(() => {
    if (reduzirMovimento !== false) {
      pulseAnim.setValue(1);
      return;
    }
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
  }, [pulseAnim, reduzirMovimento]);

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
  // Um pino por local: entrega + retirada no mesmo ponto saem como "2+3".
  // A contagem do chip segue com todas as restantes; pino só com coordenada.
  const pinosRestantes = useMemo(
    () => montarPinosDoMiniMap(paradasRestantes.filter(temCoordenadaValida)),
    [paradasRestantes],
  );
  const paradasConcluidas = useMemo(
    () =>
      paradas.filter(
        (p) =>
          p.status === 'concluida' &&
          isDeliveryStop(p) &&
          temCoordenadaValida(p),
      ),
    [paradas],
  );

  // Todas as paradas com coordenadas válidas (para centralização)
  const todasParadasComCoord = useMemo(
    () => paradas.filter(temCoordenadaValida),
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
        temCoordenadaValida(p),
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

  const restantesTexto = rotuloParadasRestantes(paradasRestantes.length);
  const chip = textoDoChip({
    restantes: paradasRestantes.length,
    distanciaKm: routeInfo
      ? routeInfo.distanceMeters / 1000
      : (route?.distancia_total ?? null),
    trajetoIndisponivel: Boolean(routeError) && routeCoordinates.length < 2,
  });

  return (
    <View style={styles.container} testID={testID}>
      <TouchableOpacity
        style={[styles.mapContainer, { height: expectedHeight }]}
        onPress={onOpenFullMap}
        activeOpacity={0.95}
        accessibilityLabel="Abrir mapa completo"
        accessibilityHint={`Mostra a rota na aba Mapa. ${restantesTexto}`}
        accessibilityRole="button"
      >
        <View style={{ flex: 1 }} onLayout={handleMapLayout}>
          <MapLibreGL.Map
            testID="map-view"
            style={[styles.map, { height: expectedHeight }]}
            mapStyle={OPENFREEMAP_STYLE_URL}
            onDidFinishLoadingMap={handleMapReady}
            dragPan={false}
            touchZoom={false}
            touchRotate={false}
            touchPitch={false}
            logo={false}
            attribution={true}
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
                    color={CORES_SOBRE_O_MAPA.branco}
                  />
                </View>
              </MapLibreGL.Marker>
            ))}

            {pinosRestantes.map(({ principal, chave, rotulo, isNext }) => (
              <MapLibreGL.Marker
                key={`pendente-${chave}`}
                lngLat={toLngLat({
                  latitude: principal.latitude,
                  longitude: principal.longitude,
                })}
                anchor="center"
              >
                <View
                  testID="marker"
                  style={[
                    styles.marker,
                    isNext ? styles.markerNext : styles.markerPending,
                  ]}
                >
                  <Text
                    style={styles.markerText}
                    numberOfLines={1}
                    maxFontSizeMultiplier={MAX_FONTE_SOBRE_O_MAPA}
                  >
                    {rotulo}
                  </Text>
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
                    color={CORES_SOBRE_O_MAPA.marca}
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
                    'line-color': CORES_SOBRE_O_MAPA.marca,
                    'line-width': 3,
                  }}
                />
              </MapLibreGL.GeoJSONSource>
            )}
          </MapLibreGL.Map>
        </View>

        <View style={styles.overlay}>
          <View style={styles.infoBox} testID="mini-mapa-chip">
            {isLoadingRoute ? (
              <View style={styles.infoBoxLoading}>
                <ActivityIndicator
                  size="small"
                  color={CORES_SOBRE_O_MAPA.branco}
                />
                <Text
                  style={styles.infoText}
                  numberOfLines={1}
                  maxFontSizeMultiplier={MAX_FONTE_SOBRE_O_MAPA}
                >
                  Calculando...
                </Text>
              </View>
            ) : (
              <Text
                style={styles.infoText}
                numberOfLines={1}
                maxFontSizeMultiplier={MAX_FONTE_SOBRE_O_MAPA}
              >
                {chip}
              </Text>
            )}
          </View>

          <View style={styles.controlButtons}>
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
                color={CORES_SOBRE_O_MAPA.branco}
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
    flexShrink: 1,
    backgroundColor: withOpacity(CORES_SOBRE_O_MAPA.marca, 0.9),
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
    color: CORES_SOBRE_O_MAPA.branco,
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '600',
  },
  controlButtons: {
    flexDirection: 'row',
    gap: theme.spacing['2'],
  },
  expandButton: {
    backgroundColor: withOpacity(CORES_SOBRE_O_MAPA.sombra, 0.5),
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
    backgroundColor: withOpacity(CORES_SOBRE_O_MAPA.usuario, 0.2),
    justifyContent: 'center',
    alignItems: 'center',
  },
  userMarkerDot: {
    width: 12,
    height: 12,
    borderRadius: 6, // Metade de 12px para círculo perfeito
    backgroundColor: CORES_SOBRE_O_MAPA.usuario,
    borderWidth: 2,
    borderColor: CORES_SOBRE_O_MAPA.branco,
  },
  // Largura mínima, não fixa: "10+11" alarga o pino em vez de cortar
  marker: {
    minWidth: 28,
    height: 28,
    paddingHorizontal: 4,
    borderRadius: theme.borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: CORES_SOBRE_O_MAPA.branco,
  },
  markerNext: {
    backgroundColor: CORES_SOBRE_O_MAPA.proxima,
    minWidth: 34, // Maior que os outros (28)
    height: 34,
    borderWidth: 3, // Borda mais grossa
    shadowColor: CORES_SOBRE_O_MAPA.proxima,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 6,
  },
  markerPending: {
    backgroundColor: CORES_SOBRE_O_MAPA.pendente,
  },
  markerConcluida: {
    backgroundColor: CORES_SOBRE_O_MAPA.concluida,
  },
  markerText: {
    color: CORES_SOBRE_O_MAPA.branco,
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '700',
  },
  checkpointMarker: {
    width: 32,
    height: 32,
    borderRadius: theme.borderRadius.full,
    backgroundColor: CORES_SOBRE_O_MAPA.branco,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: CORES_SOBRE_O_MAPA.marca,
    shadowColor: CORES_SOBRE_O_MAPA.sombra,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
}));
