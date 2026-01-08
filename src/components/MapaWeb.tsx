/* global google */

import { GoogleMap, useJsApiLoader, DirectionsRenderer } from '@react-google-maps/api';
import React, { useCallback, useMemo } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';

import {
  useMotoristaTracking,
  useDirections,
  useMapControls,
} from '@/components/map/hooks';
import {
  buildParadaHeader,
  buildInfoContent,
  buildCheckpointHeader,
  buildCheckpointInfoContent,
} from '@/components/map/infoWindowBuilders';
import {
  createMarkerContent,
  createFallbackCheckpointIcon,
  createFallbackParadaIcon,
} from '@/components/map/MarkerFactory';
import { logger } from '@/lib/logger';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

interface Parada {
  id: string;
  ordem: number;
  endereco: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
  destinatario?: string;
  telefone?: string;
  tipo?: string;
  is_checkpoint?: boolean;
}

type StatusFilter = 'all' | 'pendente' | 'em_andamento' | 'concluida';

interface MapaWebProps {
  paradas: Parada[];
  selectedParadaId?: string | null;
  onMarkerPress?: (paradaId: string) => void;
  onMapPress?: () => void;
  statusFilter?: StatusFilter;
  rotaId?: string;
  motoristaNome?: string;
  showMotorista?: boolean;
  unidadeNome?: string;
}

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
const GOOGLE_MAPS_MAP_ID = process.env.EXPO_PUBLIC_GOOGLE_MAPS_MAP_ID || '';

const containerStyle = {
  width: '100%',
  height: '100%',
};

export default function MapaWeb({
  paradas,
  selectedParadaId,
  onMarkerPress,
  onMapPress,
  statusFilter = 'all',
  rotaId,
  motoristaNome,
  showMotorista = false,
  unidadeNome,
}: MapaWebProps) {
  const { theme } = useUnistyles();
  const mapRef = React.useRef<google.maps.Map | null>(null);
  const advancedMarkersRef = React.useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const fallbackMarkersRef = React.useRef<google.maps.Marker[]>([]);
  const markerMapRef = React.useRef<Map<string, google.maps.marker.AdvancedMarkerElement | google.maps.Marker>>(new Map());
  const infoWindowRef = React.useRef<google.maps.InfoWindow | null>(null);
  const [mapReady, setMapReady] = React.useState(false);
  const boundsRef = React.useRef<google.maps.LatLngBounds | null>(null);

  const mapLibraries = useMemo(() => ['marker', 'places'] as ('marker' | 'places')[], []);

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: mapLibraries,
    version: 'beta',
  });

  // Paradas with valid coordinates
  const paradasComCoord = useMemo(
    () => paradas.filter((p) => p.latitude != null && p.longitude != null),
    [paradas]
  );

  // Separate real paradas from checkpoints
  const paradasReais = useMemo(
    () => paradasComCoord.filter((p) => p.is_checkpoint !== false),
    [paradasComCoord]
  );

  // Checkpoints (departure/arrival) - always visible
  const checkpoints = useMemo(
    () => paradasComCoord.filter((p) => p.is_checkpoint === false),
    [paradasComCoord]
  );

  // Filtered paradas by status
  const paradasFiltradas = useMemo(() => {
    if (statusFilter === 'all') return paradasReais;
    return paradasReais.filter((p) => p.status === statusFilter);
  }, [paradasReais, statusFilter]);

  // Calculate map center
  const center = useMemo(() => {
    if (paradasComCoord.length === 0) {
      return { lat: -15.7942, lng: -47.8822 }; // Brasília
    }
    return {
      lat: paradasComCoord[0].latitude!,
      lng: paradasComCoord[0].longitude!,
    };
  }, [paradasComCoord]);

  // Use extracted hooks
  const { directions } = useDirections({
    paradas: paradasComCoord,
    isLoaded,
  });

  useMotoristaTracking({
    rotaId,
    showMotorista,
    motoristaNome,
    mapRef,
    isLoaded,
    mapReady,
    theme,
    mapId: GOOGLE_MAPS_MAP_ID,
  });

  useMapControls({
    mapRef,
    boundsRef,
    center,
    theme,
    isLoaded,
    mapReady,
    hasParadas: paradasComCoord.length > 0,
  });

  const onLoad = useCallback((mapInstance: google.maps.Map) => {
    mapRef.current = mapInstance;
    setMapReady(true);
  }, []);

  const clearMarkers = useCallback(() => {
    advancedMarkersRef.current.forEach((marker) => {
      marker.map = null;
    });
    advancedMarkersRef.current = [];

    fallbackMarkersRef.current.forEach((marker) => {
      marker.setMap(null);
    });
    fallbackMarkersRef.current = [];
  }, []);

  const openInfoWindow = useCallback(
    (parada: Parada, marker: google.maps.marker.AdvancedMarkerElement | google.maps.Marker | null, isCheckpoint?: boolean, isPartida?: boolean) => {
      if (!marker || !mapRef.current) return;
      if (!infoWindowRef.current) infoWindowRef.current = new google.maps.InfoWindow();

      if (isCheckpoint) {
        infoWindowRef.current.setHeaderContent?.(buildCheckpointHeader(isPartida ?? false));
        infoWindowRef.current.setContent(buildCheckpointInfoContent(parada, unidadeNome));
      } else {
        infoWindowRef.current.setHeaderContent?.(buildParadaHeader(parada));
        infoWindowRef.current.setContent(buildInfoContent(parada));
      }

      infoWindowRef.current.open(mapRef.current, marker);

      google.maps.event.addListenerOnce(infoWindowRef.current, 'domready', () => {
        const copyBtn = document.getElementById(`copy-checkpoint-${parada.id}`);
        if (copyBtn) {
          copyBtn.addEventListener('click', async () => {
            try {
              await navigator.clipboard.writeText(parada.endereco);
              copyBtn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="${theme.colors.success}"/>
                </svg>
                Copiado!
              `;
              copyBtn.style.color = theme.colors.success;
              setTimeout(() => {
                copyBtn.innerHTML = `
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" fill="currentColor"/>
                  </svg>
                  Copiar endereço
                `;
                copyBtn.style.color = theme.colors.gray600;
              }, 2000);
            } catch {
              logger.warn('Could not copy address');
            }
          });
        }
      });
    },
    [theme, unidadeNome]
  );

  // Create markers effect
  React.useEffect(() => {
    if (!isLoaded || !mapReady || !mapRef.current) return;

    clearMarkers();

    if (paradasComCoord.length === 0) return;
    boundsRef.current = new window.google.maps.LatLngBounds();

    paradasComCoord.forEach((p) => {
      boundsRef.current?.extend({ lat: p.latitude!, lng: p.longitude! });
    });

    const paradasParaExibir = [...checkpoints, ...paradasFiltradas];

    const AdvancedMarker = google.maps.marker?.AdvancedMarkerElement;
    // @ts-expect-error - getMapId() exists in Maps API but not in types
    const mapHasMapId = mapRef.current && typeof mapRef.current.getMapId === 'function' && mapRef.current.getMapId();
    const canUseAdvancedMarkers = Boolean(GOOGLE_MAPS_MAP_ID && AdvancedMarker && mapHasMapId);

    const checkpointIds = checkpoints.map(c => c.id);
    const partidaId = checkpointIds[0];

    if (canUseAdvancedMarkers && AdvancedMarker) {
      try {
        advancedMarkersRef.current = paradasParaExibir.map((parada) => {
          const isCheckpoint = parada.is_checkpoint === false;
          const isPartida = isCheckpoint && parada.id === partidaId;

          const handleMarkerActivation = () => {
            if (isCheckpoint) {
              onMapPress?.();
            } else {
              onMarkerPress?.(parada.id);
            }
            const markerInstance = markerMapRef.current.get(parada.id);
            if (markerInstance) {
              openInfoWindow(parada, markerInstance, isCheckpoint, isPartida);
            }
          };

          const markerTitle = isCheckpoint
            ? (isPartida ? 'Ponto de Partida' : 'Ponto de Chegada')
            : `Parada ${parada.ordem}: ${parada.endereco}`;

          const marker = new AdvancedMarker({
            map: mapRef.current!,
            position: { lat: parada.latitude!, lng: parada.longitude! },
            title: markerTitle,
            content: createMarkerContent(parada, theme, handleMarkerActivation, isPartida),
          });
          markerMapRef.current.set(parada.id, marker);
          marker.addListener('gmp-click', handleMarkerActivation);
          return marker;
        });
        return;
      } catch (error) {
        logger.warn('[MapaWeb] AdvancedMarkerElement failed, using fallback:', error);
        clearMarkers();
      }
    }

    // Fallback for browsers without AdvancedMarkerElement support
    fallbackMarkersRef.current = paradasParaExibir.map((parada) => {
      const isCheckpoint = parada.is_checkpoint === false;
      const isPartida = isCheckpoint && parada.id === partidaId;

      if (isCheckpoint) {
        const marker = new google.maps.Marker({
          map: mapRef.current!,
          position: { lat: parada.latitude!, lng: parada.longitude! },
          title: isPartida ? 'Ponto de Partida' : 'Ponto de Chegada',
          icon: createFallbackCheckpointIcon(theme, isPartida),
        });
        markerMapRef.current.set(parada.id, marker);
        marker.addListener('click', () => {
          onMapPress?.();
          openInfoWindow(parada, marker, true, isPartida);
        });
        return marker;
      }

      const marker = new google.maps.Marker({
        map: mapRef.current!,
        position: { lat: parada.latitude!, lng: parada.longitude! },
        title: `Parada ${parada.ordem}: ${parada.endereco}`,
        label: {
          text: String(parada.ordem),
          color: theme.colors.white,
          fontWeight: '700',
        },
        icon: createFallbackParadaIcon(parada, theme),
      });
      markerMapRef.current.set(parada.id, marker);
      marker.addListener('click', () => {
        onMarkerPress?.(parada.id);
        openInfoWindow(parada, marker, false, false);
      });
      return marker;
    });

    if (boundsRef.current && !boundsRef.current.isEmpty() && mapRef.current) {
      mapRef.current.fitBounds(boundsRef.current);
    }
  }, [isLoaded, mapReady, paradasComCoord, checkpoints, paradasFiltradas, statusFilter, clearMarkers, onMarkerPress, onMapPress, openInfoWindow, theme]);

  // Cleanup markers on unmount
  React.useEffect(
    () => () => {
      clearMarkers();
    },
    [clearMarkers]
  );

  // Handle selected parada
  React.useEffect(() => {
    if (!selectedParadaId || !mapRef.current) return;
    const marker = markerMapRef.current.get(selectedParadaId);
    const parada = paradasComCoord.find((p) => p.id === selectedParadaId);
    if (!marker || !parada) return;

    const isCheckpoint = parada.is_checkpoint === false;
    const checkpointIds = checkpoints.map(c => c.id);
    const partidaId = checkpointIds[0];
    const isPartida = isCheckpoint && parada.id === partidaId;

    openInfoWindow(parada, marker, isCheckpoint, isPartida);
  }, [selectedParadaId, paradasComCoord, checkpoints, openInfoWindow]);

  // Handle map click
  const handleMapClick = useCallback(() => {
    if (infoWindowRef.current) {
      infoWindowRef.current.close();
    }
    onMapPress?.();
  }, [onMapPress]);

  if (loadError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Erro ao carregar o Google Maps</Text>
      </View>
    );
  }

  if (!isLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Carregando mapa...</Text>
      </View>
    );
  }

  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={center}
      zoom={13}
      onLoad={onLoad}
      onClick={handleMapClick}
      options={{
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: true,
        mapId: GOOGLE_MAPS_MAP_ID || undefined,
      }}
    >
      {directions && (
        <DirectionsRenderer
          directions={directions}
          options={{
            suppressMarkers: true,
            polylineOptions: {
              strokeColor: theme.colors.primary,
              strokeWeight: 4,
            },
          }}
        />
      )}
    </GoogleMap>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  loadingContainer: {
    height: 400,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.disabled,
  },
  loadingText: {
    marginTop: theme.spacing['2.5'],
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  errorContainer: {
    height: 400,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.errorLight,
  },
  errorText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.error,
  },
}));
