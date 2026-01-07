/* global google */

import { Ionicons } from '@expo/vector-icons';
import { GoogleMap, useJsApiLoader, OverlayView, Polyline } from '@react-google-maps/api';
import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { Text, TouchableOpacity, View, ActivityIndicator, Pressable } from 'react-native';

import { useRouteDirections } from '@/hooks/useRouteDirections';
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

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
const GOOGLE_MAPS_MAP_ID = process.env.EXPO_PUBLIC_GOOGLE_MAPS_MAP_ID || '';

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
  const height = expanded ? 300 : 150;
  const [_mapReady, setMapReady] = useState(false);
  const [useAdvancedMarkers, setUseAdvancedMarkers] = useState(false);
  const mapRef = useRef<google.maps.Map | null>(null);
  const advancedMarkersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);

  // Carregar Google Maps API
  const mapLibraries = useMemo(() => ['marker', 'places'] as ('marker' | 'places')[], []);
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: mapLibraries,
    version: 'beta',
  });

  // Filtrar paradas por status (excluindo checkpoints para contagem)
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

  // Usar hook para buscar rota real do Google Directions API
  const { routeCoordinates, routeInfo, isLoading: isLoadingRoute } = useRouteDirections(paradasParaRota);

  const coordsForBounds = useMemo(() => {
    if (routeCoordinates.length > 1) return routeCoordinates;
    return todasParadasComCoord;
  }, [routeCoordinates, todasParadasComCoord]);

  // Calcular centro do mapa
  const center = useMemo(() => {
    if (coordsForBounds.length === 0) {
      return { lat: -23.550520, lng: -46.633308 }; // São Paulo default
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

  // Callback quando o mapa estiver pronto
  const handleMapReady = useCallback((map: google.maps.Map) => {
    setMapReady(true);
    mapRef.current = map;
    const AdvancedMarker = google.maps.marker?.AdvancedMarkerElement;
    // AdvancedMarkerElement exige Map ID configurado
    // @ts-expect-error - getMapId existe no Maps API mas não está nos tipos
    const mapHasMapId = typeof map.getMapId === 'function' && map.getMapId();
    setUseAdvancedMarkers(Boolean(GOOGLE_MAPS_MAP_ID && AdvancedMarker && mapHasMapId));
  }, []);

  const handleMapUnmount = useCallback(() => {
    advancedMarkersRef.current.forEach((marker) => {
      marker.map = null;
    });
    advancedMarkersRef.current = [];
    mapRef.current = null;
    setUseAdvancedMarkers(false);
  }, []);

  useEffect(() => {
    if (!_mapReady || !mapRef.current) return;
    if (coordsForBounds.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    coordsForBounds.forEach((coord) => {
      bounds.extend({ lat: coord.latitude, lng: coord.longitude });
    });

    if (coordsForBounds.length === 1) {
      mapRef.current.setCenter({
        lat: coordsForBounds[0].latitude,
        lng: coordsForBounds[0].longitude,
      });
      mapRef.current.setZoom(15);
      return;
    }

    mapRef.current.fitBounds(bounds, { top: 32, right: 32, bottom: 32, left: 32 });
  }, [_mapReady, coordsForBounds]);

  const getOverlayOffset = useCallback((width: number, height: number) => ({
    x: -(width / 2),
    y: -(height / 2),
  }), []);

  useEffect(() => {
    if (!useAdvancedMarkers || !mapRef.current) return;

    const AdvancedMarker = google.maps.marker?.AdvancedMarkerElement;
    if (!AdvancedMarker) return;

    advancedMarkersRef.current.forEach((marker) => {
      marker.map = null;
    });
    advancedMarkersRef.current = [];

    const markers: google.maps.marker.AdvancedMarkerElement[] = [];
    try {

      const createCircleMarker = (options: {
        size: number;
        backgroundColor: string;
        borderColor?: string;
        text?: string;
        textColor?: string;
        fontSize?: number;
        fontWeight?: string;
        opacity?: number;
      }) => {
        const el = document.createElement('div');
        el.style.width = `${options.size}px`;
        el.style.height = `${options.size}px`;
        el.style.borderRadius = `${options.size / 2}px`;
        el.style.background = options.backgroundColor;
        el.style.border = `2px solid ${options.borderColor || theme.colors.white}`;
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.style.color = options.textColor || theme.colors.white;
        el.style.fontSize = `${options.fontSize ?? 12}px`;
        el.style.fontWeight = options.fontWeight || '700';
        el.style.boxSizing = 'border-box';
        if (options.opacity !== undefined) {
          el.style.opacity = String(options.opacity);
        }
        if (options.text) {
          el.textContent = options.text;
        }
        return el;
      };

      const createUserMarker = () => {
        const outer = document.createElement('div');
        outer.style.width = '24px';
        outer.style.height = '24px';
        outer.style.borderRadius = '12px';
        outer.style.background = withOpacity(theme.colors.info, 0.2);
        outer.style.display = 'flex';
        outer.style.alignItems = 'center';
        outer.style.justifyContent = 'center';

        const inner = document.createElement('div');
        inner.style.width = '12px';
        inner.style.height = '12px';
        inner.style.borderRadius = `${theme.borderRadius.xs}px`;
        inner.style.background = theme.colors.info;
        inner.style.border = `2px solid ${theme.colors.white}`;
        inner.style.boxSizing = 'border-box';

        outer.appendChild(inner);
        return outer;
      };

      const addMarker = (
        position: google.maps.LatLngLiteral,
        content: HTMLElement,
        title: string,
        zIndex: number
      ) => {
        markers.push(new AdvancedMarker({
          map: mapRef.current!,
          position,
          content,
          title,
          zIndex,
        }));
      };

      if (userLocation) {
        addMarker(
          { lat: userLocation.latitude, lng: userLocation.longitude },
          createUserMarker(),
          'Você está aqui',
          5
        );
      }

      paradasConcluidas.forEach((parada) => {
        addMarker(
          { lat: parada.latitude, lng: parada.longitude },
          createCircleMarker({
            size: 20,
            backgroundColor: theme.colors.success,
            opacity: 0.5,
          }),
          `Parada ${parada.ordem} concluída`,
          2
        );
      });

      paradasPendentes.forEach((parada, index) => {
        addMarker(
          { lat: parada.latitude, lng: parada.longitude },
          createCircleMarker({
            size: 28,
            backgroundColor: index === 0 ? theme.colors.warning : theme.colors.gray500,
            text: String(parada.ordem),
          }),
          `Parada ${parada.ordem}`,
          3
        );
      });

      checkpoints.forEach((checkpoint) => {
        const label = checkpoint.ordem === 0 ? 'Partida (Unidade)' : 'Chegada (Unidade)';
        addMarker(
          { lat: checkpoint.latitude, lng: checkpoint.longitude },
          createCircleMarker({
            size: 20,
            backgroundColor: theme.colors.primary,
          }),
          label,
          1
        );
      });

      advancedMarkersRef.current = markers;
    } catch {
      markers.forEach((marker) => {
        marker.map = null;
      });
      advancedMarkersRef.current = [];
      setUseAdvancedMarkers(false);
      return;
    }

    return () => {
      markers.forEach((marker) => {
        marker.map = null;
      });
      advancedMarkersRef.current = [];
    };
  }, [useAdvancedMarkers, userLocation, paradasConcluidas, paradasPendentes, checkpoints, theme]);

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

  // Converter coordenadas para formato Google Maps
  const polylinePath = useMemo(() =>
    routeCoordinates.map(coord => ({ lat: coord.latitude, lng: coord.longitude })),
    [routeCoordinates]
  );

  // Estado de loading ou erro
  if (loadError) {
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

  if (!isLoaded) {
    return (
      <View style={styles.container} testID={testID}>
        <View style={[styles.mapContainer, styles.loadingContainer, { height }]}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Carregando mapa...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container} testID={testID}>
      <Pressable
        style={[styles.mapContainer, { height }]}
        onPress={handleMapClick}
        accessibilityLabel={`Mapa da rota com ${paradasPendentes.length} paradas pendentes. Toque para abrir mapa completo`}
        accessibilityRole="link"
      >
        <View style={[styles.mapWrapper, { height }]}>
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={center}
            zoom={zoom}
            onLoad={handleMapReady}
            onUnmount={handleMapUnmount}
            options={{
              disableDefaultUI: true,
              zoomControl: false,
              scrollwheel: false,
              draggable: false,
              clickableIcons: false,
              gestureHandling: 'none',
              mapId: GOOGLE_MAPS_MAP_ID || undefined,
            }}
          >
            {/* Polyline da rota */}
            {polylinePath.length > 1 && (
              <Polyline
                path={polylinePath}
                options={{
                  strokeColor: theme.colors.primary,
                  strokeWeight: 3,
                  strokeOpacity: 0.8,
                }}
              />
            )}

            {/* Fallback para browsers sem AdvancedMarkerElement */}
            {!useAdvancedMarkers && (
              <>
                {userLocation && (
                  <OverlayView
                    position={{ lat: userLocation.latitude, lng: userLocation.longitude }}
                    mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                    getPixelPositionOffset={getOverlayOffset}
                  >
                    <View style={styles.overlayUserMarker} pointerEvents="none">
                      <View style={styles.overlayUserDot} />
                    </View>
                  </OverlayView>
                )}

                {paradasConcluidas.map((parada) => (
                  <OverlayView
                    key={`concluida-${parada.id}`}
                    position={{ lat: parada.latitude, lng: parada.longitude }}
                    mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                    getPixelPositionOffset={getOverlayOffset}
                  >
                    <View
                      style={[styles.overlayMarker, styles.overlayMarkerConcluida]}
                      pointerEvents="none"
                    />
                  </OverlayView>
                ))}

                {paradasPendentes.map((parada, index) => (
                  <OverlayView
                    key={`pendente-${parada.id}`}
                    position={{ lat: parada.latitude, lng: parada.longitude }}
                    mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                    getPixelPositionOffset={getOverlayOffset}
                  >
                    <View
                      style={[
                        styles.overlayMarker,
                        index === 0 ? styles.overlayMarkerNext : styles.overlayMarkerPending,
                      ]}
                      pointerEvents="none"
                    >
                      <Text style={styles.overlayMarkerText}>{parada.ordem}</Text>
                    </View>
                  </OverlayView>
                ))}

                {checkpoints.map((checkpoint) => (
                  <OverlayView
                    key={`checkpoint-${checkpoint.id}`}
                    position={{ lat: checkpoint.latitude, lng: checkpoint.longitude }}
                    mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                    getPixelPositionOffset={getOverlayOffset}
                  >
                    <View
                      style={[styles.overlayMarker, styles.overlayMarkerCheckpoint]}
                      pointerEvents="none"
                    />
                  </OverlayView>
                ))}
              </>
            )}
          </GoogleMap>
        </View>

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
  },
  mapWrapper: {
    width: '100%',
  },
  loadingContainer: {
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
    backgroundColor: theme.colors.primary,
    opacity: 0.9,
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
    backgroundColor: theme.colors.primary,
    opacity: 0.85,
    width: 32,
    height: 32,
    borderRadius: theme.borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.colors.white,
    backgroundColor: theme.colors.gray500,
  },
  overlayMarkerText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '700',
  },
  overlayMarkerPending: {
    backgroundColor: theme.colors.gray500,
  },
  overlayMarkerNext: {
    backgroundColor: theme.colors.warning,
  },
  overlayMarkerConcluida: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: theme.colors.success,
    opacity: 0.5,
  },
  overlayMarkerCheckpoint: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
  },
  overlayUserMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: withOpacity(theme.colors.info, 0.2),
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayUserDot: {
    width: 12,
    height: 12,
    borderRadius: theme.borderRadius.xs,
    backgroundColor: theme.colors.info,
    borderWidth: 2,
    borderColor: theme.colors.white,
  },
}));
