import { Ionicons } from '@expo/vector-icons';
import maplibregl from 'maplibre-gl';
import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { Text, TouchableOpacity, View, ActivityIndicator, Pressable } from 'react-native';

import 'maplibre-gl/dist/maplibre-gl.css';

import { useRouteDirections } from '@/hooks/useRouteDirections';
import { logger } from '@/lib/logger';
import { getOpenFreeMapStyle, installOpenFreeMapMissingImageHandler } from '@/lib/openFreeMapStyle';
import { withOpacity } from '@/utils/color';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

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

/**
 * Verifica se as coordenadas estão em range válido
 */
const isValidCoordinate = (lat: number, lng: number): boolean =>
  !isNaN(lat) && !isNaN(lng) &&
  lat >= -90 && lat <= 90 &&
  lng >= -180 && lng <= 180;

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
  // Altura unificada com native: 150px colapsado, 300px expandido
  const expectedHeight = expanded ? 300 : 150;
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  // Extrair cores do theme para ref estável (evita recriação de markers a cada mudança de tema)
  const themeColorsRef = useRef(theme.colors);
  const themeBorderRadiusRef = useRef(theme.borderRadius);
  useEffect(() => {
    themeColorsRef.current = theme.colors;
    themeBorderRadiusRef.current = theme.borderRadius;
  }, [theme.colors, theme.borderRadius]);

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
    () => paradas.filter(p =>
      p.status !== 'concluida' && p.status !== 'pulada' && p.is_checkpoint !== false
    ),
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

  // Checkpoints (pontos de partida/chegada da unidade)
  const checkpoints = useMemo(
    () => todasParadasComCoord.filter(p => p.is_checkpoint === false),
    [todasParadasComCoord]
  );

  // Preparar paradas para o hook de rota
  const paradasParaRota = useMemo(() => {
    const todasOrdenadas = [...todasParadasComCoord].sort((a, b) => a.ordem - b.ordem);
    return todasOrdenadas.map((p, idx) => ({
      id: p.id,
      ordem: idx,
      latitude: p.latitude,
      longitude: p.longitude,
    }));
  }, [todasParadasComCoord]);

  // Usar hook para buscar rota real via OSRM
  const { routeCoordinates, routeInfo, isLoading: isLoadingRoute } = useRouteDirections(paradasParaRota);

  // Coordenadas das paradas restantes para calcular bounds do zoom
  // Foca o mapa nas paradas que ainda precisam ser visitadas
  const coordsParadasRestantes = useMemo(() => {
    const restantes = paradas.filter(p =>
      p.status !== 'concluida' && p.status !== 'pulada' &&
      isValidCoordinate(p.latitude, p.longitude)
    );
    return restantes.map(p => ({
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
    return todasParadasComCoord.map(p => ({
      latitude: p.latitude,
      longitude: p.longitude,
    }));
  }, [coordsParadasRestantes, routeCoordinates, todasParadasComCoord]);

  // Calcular centro do mapa
  const center = useMemo(() => {
    if (coordsForBounds.length === 0) {
      return { lng: -46.633308, lat: -23.550520 }; // São Paulo default
    }

    const lats = coordsForBounds.map(p => p.latitude);
    const longs = coordsForBounds.map(p => p.longitude);

    return {
      lat: (Math.min(...lats) + Math.max(...lats)) / 2,
      lng: (Math.min(...longs) + Math.max(...longs)) / 2,
    };
  }, [coordsForBounds]);

  // Calcular zoom baseado nos bounds
  const zoom = useMemo(() => {
    if (coordsForBounds.length <= 1) return 15;

    const lats = coordsForBounds.map(p => p.latitude);
    const longs = coordsForBounds.map(p => p.longitude);

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
  const createUserMarkerElement = useCallback(() => {
    const colors = themeColorsRef.current;
    const borderRadius = themeBorderRadiusRef.current;

    const outer = document.createElement('div');
    outer.className = 'minimap-user-marker-pulse';
    outer.style.cssText = `
      width: 24px;
      height: 24px;
      border-radius: 12px;
      background: ${withOpacity(colors.info, 0.2)};
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    const inner = document.createElement('div');
    inner.style.cssText = `
      width: 12px;
      height: 12px;
      border-radius: ${borderRadius.xs}px;
      background: ${colors.info};
      border: 2px solid ${colors.white};
      box-sizing: border-box;
    `;

    outer.appendChild(inner);
    return outer;
  }, []);

  const createStopMarkerElement = useCallback((options: {
    size: number;
    backgroundColor: string;
    text?: string;
    opacity?: number;
    isNext?: boolean;
  }) => {
    const colors = themeColorsRef.current;

    const el = document.createElement('div');
    el.style.cssText = `
      width: ${options.size}px;
      height: ${options.size}px;
      border-radius: ${options.size / 2}px;
      background: ${options.backgroundColor};
      border: ${options.isNext ? '3px' : '2px'} solid ${colors.white};
      display: flex;
      align-items: center;
      justify-content: center;
      color: ${colors.white};
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
  }, []);

  // Initialize MapLibre map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Clean up existing map
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    let cancelled = false;
    let mapInstance: maplibregl.Map | null = null;
    let removeMissingImageHandler: (() => void) | null = null;

    const initializeMap = async () => {
      try {
        const style = await getOpenFreeMapStyle();
        if (cancelled || !mapContainerRef.current) return;

        mapInstance = new maplibregl.Map({
          container: mapContainerRef.current,
          style,
          center: [center.lng, center.lat],
          zoom,
          attributionControl: false,
          interactive: false, // MiniMap is not interactive
        });
        removeMissingImageHandler = installOpenFreeMapMissingImageHandler(mapInstance);

        mapInstance.on('load', () => {
          setMapReady(true);
          mapRef.current = mapInstance;
        });

        mapInstance.on('error', (e) => {
          logger.error('[MiniMap.web] Map error:', e);
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
      // Clean up markers
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current = [];
      if (mapInstance) {
        mapInstance.remove();
      }
      mapRef.current = null;
      setMapReady(false);
    };
  }, [center.lat, center.lng, zoom]);

  // Fit bounds when map is ready and coordinates change
  useEffect(() => {
    if (!mapRef.current || !mapReady || coordsForBounds.length === 0) return;

    if (coordsForBounds.length === 1) {
      mapRef.current.setCenter([coordsForBounds[0].longitude, coordsForBounds[0].latitude]);
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

  // Add markers
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;

    const colors = themeColorsRef.current;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Add user marker
    if (userLocation) {
      const userMarker = new maplibregl.Marker({ element: createUserMarkerElement() })
        .setLngLat([userLocation.longitude, userLocation.latitude])
        .addTo(mapRef.current);
      markersRef.current.push(userMarker);
    }

    // Add completed stop markers
    paradasConcluidas.forEach((parada) => {
      const marker = new maplibregl.Marker({
        element: createStopMarkerElement({
          size: 20,
          backgroundColor: colors.success,
          opacity: 0.5,
        }),
      })
        .setLngLat([parada.longitude, parada.latitude])
        .addTo(mapRef.current!);
      markersRef.current.push(marker);
    });

    // Add pending stop markers
    paradasRestantes.forEach((parada, index) => {
      const isNext = index === 0;
      const marker = new maplibregl.Marker({
        element: createStopMarkerElement({
          size: isNext ? 34 : 28,
          backgroundColor: isNext ? colors.warning : colors.gray500,
          text: String(parada.ordem),
          isNext,
        }),
      })
        .setLngLat([parada.longitude, parada.latitude])
        .addTo(mapRef.current!);
      markersRef.current.push(marker);
    });

    // Add checkpoint markers
    checkpoints.forEach((checkpoint) => {
      const marker = new maplibregl.Marker({
        element: createStopMarkerElement({
          size: 20,
          backgroundColor: colors.primary,
        }),
      })
        .setLngLat([checkpoint.longitude, checkpoint.latitude])
        .addTo(mapRef.current!);
      markersRef.current.push(marker);
    });
  }, [mapReady, userLocation, paradasConcluidas, paradasRestantes, checkpoints, createUserMarkerElement, createStopMarkerElement]);

  // Add route polyline
  useEffect(() => {
    if (!mapRef.current || !mapReady || routeCoordinates.length < 2) return;

    const sourceId = 'minimap-route-source';
    const layerId = 'minimap-route-layer';

    // Remove existing layer and source if they exist
    if (mapRef.current.getLayer(layerId)) {
      mapRef.current.removeLayer(layerId);
    }
    if (mapRef.current.getSource(sourceId)) {
      mapRef.current.removeSource(sourceId);
    }

    // Add route source
    mapRef.current.addSource(sourceId, {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: routeCoordinates.map(c => [c.longitude, c.latitude]),
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
        'line-color': theme.colors.primary,
        'line-width': 3,
        'line-opacity': 0.8,
      },
    });
  }, [mapReady, routeCoordinates, theme.colors.primary]);

  // Gerar URL do Google Maps para fallback
  const generateMapsUrl = useCallback(() => {
    const todasParadas = [...paradas].sort((a, b) => a.ordem - b.ordem);
    if (todasParadas.length === 0) return '#';

    const origin = `${todasParadas[0].latitude},${todasParadas[0].longitude}`;
    const destination = `${todasParadas[todasParadas.length - 1].latitude},${todasParadas[todasParadas.length - 1].longitude}`;
    const waypoints = todasParadas
      .slice(1, -1)
      .map(p => `${p.latitude},${p.longitude}`)
      .join('|');

    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypoints ? `&waypoints=${waypoints}` : ''}&travelmode=driving`;
  }, [paradas]);

  const openGoogleMaps = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.open(generateMapsUrl(), '_blank');
    }
  }, [generateMapsUrl]);

  // Handler para click no mapa
  const handleMapClick = useCallback(() => {
    if (onOpenFullMap) {
      onOpenFullMap();
    } else {
      openGoogleMaps();
    }
  }, [onOpenFullMap, openGoogleMaps]);

  // Estado de erro
  if (mapError) {
    return (
      <View style={styles.container} testID={testID}>
        <TouchableOpacity
          style={[styles.mapContainer, styles.fallbackContainer, { height: 56 }]}
          onPress={openGoogleMaps}
          activeOpacity={0.95}
          accessibilityLabel="Abrir rota no Google Maps"
          accessibilityRole="button"
        >
          <View style={styles.compactRow}>
            <Ionicons name="map-outline" size={20} color={theme.colors.primary} />
            <Text style={styles.compactText}>Ver rota no Google Maps</Text>
            <Ionicons name="open-outline" size={16} color={theme.colors.gray400} />
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
        accessibilityLabel={`Mapa da rota com ${paradasRestantes.length} paradas restantes. Toque para expandir`}
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
              </Text>
            )}
          </View>

          <View style={styles.controlButtons}>
            {onOpenPiP && (
              <TouchableOpacity
                style={styles.pipButton}
                onPress={(e) => {
                  e.stopPropagation();
                  onOpenPiP();
                }}
                accessibilityLabel="Abrir mapa flutuante"
                accessibilityRole="button"
              >
                <Ionicons
                  name="copy-outline"
                  size={18}
                  color={theme.colors.white}
                />
              </TouchableOpacity>
            )}

            {onToggleExpand && (
              <TouchableOpacity
                style={styles.expandButton}
                onPress={(e) => {
                  e.stopPropagation();
                  onToggleExpand();
                }}
                accessibilityLabel={expanded ? 'Minimizar mapa' : 'Expandir mapa'}
                accessibilityRole="button"
              >
                <Ionicons
                  name={expanded ? 'contract' : 'expand'}
                  size={20}
                  color={theme.colors.white}
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
}));
