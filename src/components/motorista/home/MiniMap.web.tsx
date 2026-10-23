import { Ionicons } from '@expo/vector-icons';
import * as maplibregl from 'maplibre-gl';
import React, {
  useMemo,
  useCallback,
  useState,
  useEffect,
  useRef,
} from 'react';
import {
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Pressable,
} from 'react-native';

import 'maplibre-gl/dist/maplibre-gl.css';

import { useRouteDirections } from '@/hooks/useRouteDirections';
import { logger } from '@/lib/logger';
import { configureMaplibreWorker } from '@/lib/maplibreWorker';
import { temCoordenadaValida } from '@/lib/motorista/coordenadaValida';
import { montarPinosDoMiniMap } from '@/lib/motorista/pinosPorLocal';
import { montarUrlRotaGoogleMaps } from '@/lib/motorista/urlRotaGoogleMaps';
import {
  getOpenFreeMapStyle,
  installOpenFreeMapMissingImageHandler,
} from '@/lib/openFreeMapStyle';
import { withOpacity } from '@/utils/color';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

import {
  CORES_SOBRE_O_MAPA,
  MAX_FONTE_SOBRE_O_MAPA,
  rotuloParadasRestantes,
  textoDoChip,
} from './miniMapCompartilhado';

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

interface MiniMapProps {
  paradas: Parada[];
  userLocation?: { latitude: number; longitude: number };
  expanded?: boolean;
  onToggleExpand?: () => void;
  onOpenFullMap?: () => void;
  route?: Rota;
  testID?: string;
}

/**
 * Erro do maplibre que não impede o mapa: falha de um tile/fonte (o evento
 * traz `sourceId` ou `tile`) ou de sprite, glifo ou imagem do estilo.
 */
function erroNaoFatalDoMapa(e: unknown): boolean {
  const evento = (e ?? {}) as {
    sourceId?: unknown;
    tile?: unknown;
    error?: { message?: unknown };
  };
  if (evento.sourceId !== undefined || evento.tile !== undefined) return true;
  const mensagem = evento.error?.message;
  return (
    typeof mensagem === 'string' && /sprite|glyph|image|\.pbf/i.test(mensagem)
  );
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
  const { theme } = useUnistyles();
  // Altura unificada com native: 150px colapsado, 300px expandido
  const expectedHeight = expanded ? 300 : 150;
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);

  // Injetar CSS de animação de pulso para o marker do usuário
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const styleId = 'minimap-pulse-animation';
    if (document.getElementById(styleId)) return; // Já existe

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @keyframes minimap-pulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.3); opacity: 0.7; }
      }
      .minimap-user-marker-pulse {
        animation: minimap-pulse 2s ease-in-out infinite;
      }
      @media (prefers-reduced-motion: reduce) {
        .minimap-user-marker-pulse { animation: none; }
      }
    `;
    document.head.appendChild(style);

    return () => {
      const existingStyle = document.getElementById(styleId);
      if (existingStyle) {
        document.head.removeChild(existingStyle);
      }
    };
  }, []);

  // Filtrar paradas por status (excluindo checkpoints para contagem)
  // Paradas restantes = pendentes + em andamento (não concluídas e não puladas)
  const paradasRestantes = useMemo(
    () =>
      paradas.filter(
        (p) =>
          p.status !== 'concluida' &&
          p.status !== 'pulada' &&
          p.is_checkpoint !== false,
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
          p.is_checkpoint !== false &&
          temCoordenadaValida(p),
      ),
    [paradas],
  );

  // Todas as paradas com coordenadas válidas (para centralização)
  const todasParadasComCoord = useMemo(
    () => paradas.filter(temCoordenadaValida),
    [paradas],
  );

  // Checkpoints (pontos de partida/chegada da unidade)
  const checkpoints = useMemo(
    () => todasParadasComCoord.filter((p) => p.is_checkpoint === false),
    [todasParadasComCoord],
  );

  // Preparar paradas para o hook de rota
  const paradasParaRota = useMemo(() => {
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

  // Usar hook para buscar rota real via OSRM
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

  // Calcular centro do mapa
  const center = useMemo(() => {
    if (coordsForBounds.length === 0) {
      return { lng: -46.633308, lat: -23.55052 }; // São Paulo default
    }

    const lats = coordsForBounds.map((p) => p.latitude);
    const longs = coordsForBounds.map((p) => p.longitude);

    return {
      lat: (Math.min(...lats) + Math.max(...lats)) / 2,
      lng: (Math.min(...longs) + Math.max(...longs)) / 2,
    };
  }, [coordsForBounds]);

  // Calcular zoom baseado nos bounds
  const zoom = useMemo(() => {
    if (coordsForBounds.length <= 1) return 15;

    const lats = coordsForBounds.map((p) => p.latitude);
    const longs = coordsForBounds.map((p) => p.longitude);

    const latDiff = Math.max(...lats) - Math.min(...lats);
    const lngDiff = Math.max(...longs) - Math.min(...longs);
    const maxDiff = Math.max(latDiff, lngDiff);

    if (maxDiff > 0.5) return 10;
    if (maxDiff > 0.2) return 11;
    if (maxDiff > 0.1) return 12;
    if (maxDiff > 0.05) return 13;
    return 14;
  }, [coordsForBounds]);

  // Create marker element helpers
  // Cores fixas: o mapa é sempre claro, e o tema escuro inverteria o branco.
  const createUserMarkerElement = useCallback(() => {
    const outer = document.createElement('div');
    outer.className = 'minimap-user-marker-pulse';
    outer.style.cssText = `
      width: 24px;
      height: 24px;
      border-radius: 12px;
      background: ${withOpacity(CORES_SOBRE_O_MAPA.usuario, 0.2)};
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    const inner = document.createElement('div');
    inner.style.cssText = `
      width: 12px;
      height: 12px;
      border-radius: 6px;
      background: ${CORES_SOBRE_O_MAPA.usuario};
      border: 2px solid ${CORES_SOBRE_O_MAPA.branco};
      box-sizing: border-box;
    `;

    outer.appendChild(inner);
    return outer;
  }, []);

  const createStopMarkerElement = useCallback(
    (options: {
      size: number;
      backgroundColor: string;
      text?: string;
      opacity?: number;
      isNext?: boolean;
    }) => {
      // Largura mínima, não fixa: "10+11" alarga o pino em vez de cortar
      const el = document.createElement('div');
      el.style.cssText = `
      min-width: ${options.size}px;
      height: ${options.size}px;
      padding: 0 4px;
      white-space: nowrap;
      border-radius: ${options.size / 2}px;
      background: ${options.backgroundColor};
      border: ${options.isNext ? '3px' : '2px'} solid ${CORES_SOBRE_O_MAPA.branco};
      display: flex;
      align-items: center;
      justify-content: center;
      color: ${CORES_SOBRE_O_MAPA.branco};
      font-size: 12px;
      font-weight: 700;
      box-sizing: border-box;
      ${options.opacity !== undefined ? `opacity: ${options.opacity};` : ''}
      ${options.isNext ? `box-shadow: 0 0 8px 2px ${withOpacity(options.backgroundColor, 0.6)};` : ''}
    `;

      if (options.text) {
        el.textContent = options.text;
      }

      return el;
    },
    [],
  );

  // Centro/zoom só servem de ponto de partida: a câmera depois é ajustada
  // sem recriar o mapa (efeito abaixo).
  const cameraInicialRef = useRef({ center, zoom });
  cameraInicialRef.current = { center, zoom };

  // Cria o mapa UMA vez. Recriar a cada parada concluída piscava o mapa e
  // rebaixava estilo e tiles de novo.
  useEffect(() => {
    if (!mapContainerRef.current) return;

    let cancelled = false;
    let carregou = false;
    let mapInstance: maplibregl.Map | null = null;
    let removeMissingImageHandler: (() => void) | null = null;

    const initializeMap = async () => {
      try {
        const style = await getOpenFreeMapStyle();
        if (cancelled || !mapContainerRef.current) return;

        const inicial = cameraInicialRef.current;
        configureMaplibreWorker();
        mapInstance = new maplibregl.Map({
          container: mapContainerRef.current,
          style,
          center: [inicial.center.lng, inicial.center.lat],
          zoom: inicial.zoom,
          attributionControl: false,
          interactive: false, // MiniMap is not interactive
        });
        removeMissingImageHandler =
          installOpenFreeMapMissingImageHandler(mapInstance);

        mapInstance.on('load', () => {
          carregou = true;
          setMapReady(true);
          mapRef.current = mapInstance;
        });

        mapInstance.on('error', (e) => {
          // Tile, sprite, glifo ou imagem faltando não impedem o mapa, antes
          // ou depois do load; depois do load, nada mais é fatal.
          if (carregou || erroNaoFatalDoMapa(e)) {
            logger.warn('[MiniMap.web] Erro não fatal do mapa:', e);
            return;
          }
          // Antes do load (estilo, worker), o mapa não vai aparecer: descarta
          // a instância e mostra o fallback.
          logger.error('[MiniMap.web] Map error:', e);
          if (removeMissingImageHandler) {
            removeMissingImageHandler();
            removeMissingImageHandler = null;
          }
          mapInstance?.remove();
          mapInstance = null;
          mapRef.current = null;
          setMapError('Erro ao carregar mapa');
        });
      } catch (error) {
        if (cancelled) return;
        logger.error('[MiniMap.web] Failed to initialize map:', error);
        setMapError('Erro ao inicializar mapa');
      }
    };

    initializeMap();

    return () => {
      cancelled = true;
      if (removeMissingImageHandler) {
        removeMissingImageHandler();
      }
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      if (mapInstance) {
        mapInstance.remove();
      }
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  // Fit bounds when map is ready and coordinates change
  useEffect(() => {
    if (!mapRef.current || !mapReady || coordsForBounds.length === 0) return;

    // Ao expandir/recolher, o container muda de altura mas o canvas guarda a
    // antiga: sem resize, o enquadramento sai calculado no tamanho velho.
    mapRef.current.resize();

    if (coordsForBounds.length === 1) {
      mapRef.current.setCenter([
        coordsForBounds[0].longitude,
        coordsForBounds[0].latitude,
      ]);
      mapRef.current.setZoom(15);
      return;
    }

    const bounds = new maplibregl.LngLatBounds();
    coordsForBounds.forEach((coord) => {
      bounds.extend([coord.longitude, coord.latitude]);
    });

    // Padding PROPORCIONAL à altura do mapa para zoom consistente
    const topPadding = expanded ? 30 : 60;
    const bottomPadding = expanded ? 5 : 20;
    const horizontalPadding = expanded ? 20 : 45;

    mapRef.current.fitBounds(bounds, {
      padding: {
        top: topPadding,
        right: horizontalPadding,
        bottom: bottomPadding,
        left: horizontalPadding,
      },
      duration: 0,
    });
  }, [mapReady, coordsForBounds, expanded]);

  // Marcadores das paradas: só refazem quando as paradas mudam. A
  // localização do motorista chega a cada leitura do GPS e tem efeito próprio.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    paradasConcluidas.forEach((parada) => {
      const marker = new maplibregl.Marker({
        element: createStopMarkerElement({
          size: 20,
          backgroundColor: CORES_SOBRE_O_MAPA.concluida,
          opacity: 0.5,
        }),
      })
        .setLngLat([parada.longitude, parada.latitude])
        .addTo(map);
      markersRef.current.push(marker);
    });

    pinosRestantes.forEach(({ principal, rotulo, isNext }) => {
      const marker = new maplibregl.Marker({
        element: createStopMarkerElement({
          size: isNext ? 34 : 28,
          backgroundColor: isNext
            ? CORES_SOBRE_O_MAPA.proxima
            : CORES_SOBRE_O_MAPA.pendente,
          text: rotulo,
          isNext,
        }),
      })
        .setLngLat([principal.longitude, principal.latitude])
        .addTo(map);
      markersRef.current.push(marker);
    });

    checkpoints.forEach((checkpoint) => {
      const marker = new maplibregl.Marker({
        element: createStopMarkerElement({
          size: 20,
          backgroundColor: CORES_SOBRE_O_MAPA.marca,
        }),
      })
        .setLngLat([checkpoint.longitude, checkpoint.latitude])
        .addTo(map);
      markersRef.current.push(marker);
    });
  }, [
    mapReady,
    paradasConcluidas,
    pinosRestantes,
    checkpoints,
    createStopMarkerElement,
  ]);

  // Marcador do motorista: criado uma vez, movido com setLngLat.
  const userLat = userLocation?.latitude;
  const userLng = userLocation?.longitude;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (userLat == null || userLng == null) {
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      return;
    }

    if (userMarkerRef.current) {
      userMarkerRef.current.setLngLat([userLng, userLat]);
      return;
    }

    userMarkerRef.current = new maplibregl.Marker({
      element: createUserMarkerElement(),
    })
      .setLngLat([userLng, userLat])
      .addTo(map);
  }, [mapReady, userLat, userLng, createUserMarkerElement]);

  // Add route polyline
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;

    const sourceId = 'minimap-route-source';
    const layerId = 'minimap-route-layer';

    // Remove existing layer and source if they exist
    if (mapRef.current.getLayer(layerId)) {
      mapRef.current.removeLayer(layerId);
    }
    if (mapRef.current.getSource(sourceId)) {
      mapRef.current.removeSource(sourceId);
    }

    if (routeCoordinates.length < 2) return;

    // Add route source
    mapRef.current.addSource(sourceId, {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: routeCoordinates.map((c) => [c.longitude, c.latitude]),
        },
      },
    });

    // Add route layer
    mapRef.current.addLayer({
      id: layerId,
      type: 'line',
      source: sourceId,
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': CORES_SOBRE_O_MAPA.marca,
        'line-width': 3,
        'line-opacity': 0.8,
      },
    });
  }, [mapReady, routeCoordinates]);

  // Rota no Google Maps para o fallback: só o que falta fazer
  const urlGoogleMaps = useMemo(
    () => montarUrlRotaGoogleMaps(paradas),
    [paradas],
  );

  const openGoogleMaps = useCallback(() => {
    if (urlGoogleMaps && typeof window !== 'undefined') {
      window.open(urlGoogleMaps, '_blank');
    }
  }, [urlGoogleMaps]);

  // Handler para click no mapa
  const handleMapClick = useCallback(() => {
    if (onOpenFullMap) {
      onOpenFullMap();
    } else {
      openGoogleMaps();
    }
  }, [onOpenFullMap, openGoogleMaps]);

  const restantesTexto = rotuloParadasRestantes(paradasRestantes.length);
  const chip = textoDoChip({
    restantes: paradasRestantes.length,
    distanciaKm: routeInfo
      ? routeInfo.distanceMeters / 1000
      : (route?.distancia_total ?? null),
    trajetoIndisponivel: Boolean(routeError) && routeCoordinates.length < 2,
  });

  // Estado de erro
  if (mapError && !urlGoogleMaps) {
    return (
      <View style={styles.container} testID={testID}>
        <View
          style={[
            styles.mapContainer,
            styles.fallbackContainer,
            { height: 56 },
          ]}
        >
          <View style={styles.compactRow}>
            <Ionicons
              name="map-outline"
              size={20}
              color={theme.colors.gray400}
            />
            <Text style={styles.compactText}>Mapa indisponível</Text>
          </View>
        </View>
      </View>
    );
  }

  if (mapError) {
    return (
      <View style={styles.container} testID={testID}>
        <TouchableOpacity
          style={[
            styles.mapContainer,
            styles.fallbackContainer,
            { height: 56 },
          ]}
          onPress={openGoogleMaps}
          activeOpacity={0.95}
          accessibilityLabel="Abrir rota no Google Maps"
          accessibilityRole="button"
        >
          <View style={styles.compactRow}>
            <Ionicons
              name="map-outline"
              size={20}
              color={theme.colors.primary}
            />
            <Text style={styles.compactText}>Ver rota no Google Maps</Text>
            <Ionicons
              name="open-outline"
              size={16}
              color={theme.colors.gray400}
            />
          </View>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container} testID={testID}>
      <Pressable
        style={[styles.mapContainer, { height: expectedHeight }]}
        onPress={handleMapClick}
        accessibilityLabel={
          onOpenFullMap ? 'Abrir mapa completo' : 'Abrir rota no Google Maps'
        }
        accessibilityHint={`Mapa da rota. ${restantesTexto}`}
        // "link", não "button": no react-native-web "button" vira <button>, e
        // esta área contém o botão de expandir (<button> dentro de <button>).
        accessibilityRole="link"
      >
        <div
          ref={mapContainerRef}
          style={{
            width: '100%',
            height: expectedHeight,
          }}
        />

        {/* Loading overlay */}
        {!mapReady && (
          <View style={[styles.loadingOverlay, { height: expectedHeight }]}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Carregando mapa...</Text>
          </View>
        )}

        {/* Overlay com informações */}
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
            {onToggleExpand && (
              <TouchableOpacity
                style={styles.expandButton}
                onPress={(e) => {
                  e.stopPropagation();
                  onToggleExpand();
                }}
                accessibilityLabel={
                  expanded ? 'Minimizar mapa' : 'Expandir mapa'
                }
                accessibilityRole="button"
              >
                <Ionicons
                  name={expanded ? 'contract' : 'expand'}
                  size={20}
                  color={CORES_SOBRE_O_MAPA.branco}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    marginHorizontal: theme.spacing['4'],
    marginVertical: theme.spacing['4'], // Unificado com native (16px)
  },
  mapContainer: {
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    position: 'relative',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing['2'],
  },
  loadingText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray500,
  },
  fallbackContainer: {
    backgroundColor: theme.colors.white,
  },
  compactRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing['4'],
    gap: theme.spacing['2.5'],
  },
  compactText: {
    flex: 1,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '500',
    color: theme.colors.gray700,
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
    // Alvo de toque mínimo de 44×44
    width: 44,
    height: 44,
    borderRadius: theme.borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
}));
