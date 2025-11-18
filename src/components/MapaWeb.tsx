/* global google */

import { GoogleMap, useJsApiLoader, DirectionsRenderer } from '@react-google-maps/api';
import React, { useCallback } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';

import { StyleSheet } from '@/utils/styles';

interface Parada {
  id: string;
  ordem: number;
  endereco: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
  is_checkpoint?: boolean;
}

interface MapaWebProps {
  paradas: Parada[];
}

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
const GOOGLE_MAPS_MAP_ID = process.env.EXPO_PUBLIC_GOOGLE_MAPS_MAP_ID || '';

const containerStyle = {
  width: '100%',
  height: '100%',
};

function getStatusColor(status?: string) {
  switch (status) {
    case 'concluida':
      return '#10b981';
    case 'em_andamento':
      return '#3b82f6';
    case 'cancelada':
      return '#ef4444';
    default:
      return '#f59e0b';
  }
}

function createMarkerContent(parada: Parada) {
  // Checkpoint (partida/chegada): ícone de pin azul primário (#284093)
  if (parada.is_checkpoint === false) {
    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.alignItems = 'center';
    wrapper.innerHTML = `
      <svg width="32" height="40" viewBox="0 0 24 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 0C7.03 0 3 3.47 3 7.75C3 13.56 12 24 12 24C12 24 21 13.56 21 7.75C21 3.47 16.97 0 12 0ZM12 10.5C10.62 10.5 9.5 9.38 9.5 8C9.5 6.62 10.62 5.5 12 5.5C13.38 5.5 14.5 6.62 14.5 8C14.5 9.38 13.38 10.5 12 10.5Z" fill="#284093"/>
      </svg>
    `;
    return wrapper;
  }

  // Parada normal: círculo com número
  const wrapper = document.createElement('div');
  wrapper.style.width = '34px';
  wrapper.style.height = '34px';
  wrapper.style.borderRadius = '17px';
  wrapper.style.display = 'flex';
  wrapper.style.alignItems = 'center';
  wrapper.style.justifyContent = 'center';
  wrapper.style.backgroundColor = getStatusColor(parada.status);
  wrapper.style.color = '#ffffff';
  wrapper.style.fontWeight = '700';
  wrapper.style.fontSize = '14px';
  wrapper.style.border = '2px solid #ffffff';
  wrapper.style.boxShadow = '0 3px 8px rgba(0,0,0,0.25)';

  const label = document.createElement('span');
  label.textContent = String(parada.ordem);
  wrapper.appendChild(label);

  return wrapper;
}

export default function MapaWeb({ paradas }: MapaWebProps) {
  const [directions, setDirections] = React.useState<google.maps.DirectionsResult | null>(null);
  const mapRef = React.useRef<google.maps.Map | null>(null);
  const advancedMarkersRef = React.useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const fallbackMarkersRef = React.useRef<google.maps.Marker[]>([]);
  const [mapReady, setMapReady] = React.useState(false);

  const mapLibraries = React.useMemo(() => ['marker'] as google.maps.libraryName[], []);

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: mapLibraries,
  });

  const paradasComCoord = React.useMemo(
    () => paradas.filter((p) => p.latitude != null && p.longitude != null),
    [paradas]
  );

  // Calcular centro do mapa
  const center = React.useMemo(() => {
    if (paradasComCoord.length === 0) {
      return { lat: -15.7942, lng: -47.8822 }; // Brasília
    }
    return {
      lat: paradasComCoord[0].latitude!,
      lng: paradasComCoord[0].longitude!,
    };
  }, [paradasComCoord]);

  const onLoad = useCallback(
    (mapInstance: google.maps.Map) => {
      mapRef.current = mapInstance;
      setMapReady(true);
      // Ajustar bounds para mostrar todas as paradas
      if (paradasComCoord.length > 0) {
        const bounds = new window.google.maps.LatLngBounds();
        paradasComCoord.forEach((p) => {
          bounds.extend({ lat: p.latitude!, lng: p.longitude! });
        });
        mapInstance.fitBounds(bounds);
      }
    },
    [paradasComCoord]
  );

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

  React.useEffect(() => {
    if (!isLoaded || !mapReady || !mapRef.current) return;

    clearMarkers();

    if (paradasComCoord.length === 0) return;

    const AdvancedMarker = google.maps.marker?.AdvancedMarkerElement;
    const canUseAdvancedMarkers = Boolean(GOOGLE_MAPS_MAP_ID && AdvancedMarker);

    if (canUseAdvancedMarkers && AdvancedMarker) {
      advancedMarkersRef.current = paradasComCoord.map((parada) => {
        const marker = new AdvancedMarker({
          map: mapRef.current!,
          position: { lat: parada.latitude!, lng: parada.longitude! },
          title: `Parada ${parada.ordem}: ${parada.endereco}`,
          content: createMarkerContent(parada),
        });
        return marker;
      });
      return;
    }

    // Fallback para browsers que ainda não suportam AdvancedMarkerElement
    fallbackMarkersRef.current = paradasComCoord.map((parada) => {
      // Checkpoint (partida/chegada): marcador azul primário
      if (parada.is_checkpoint === false) {
        return new google.maps.Marker({
          map: mapRef.current!,
          position: { lat: parada.latitude!, lng: parada.longitude! },
          title: parada.ordem === 1 ? 'Ponto de Partida' : 'Ponto de Chegada',
          icon: {
            url: 'https://maps.google.com/mapfiles/ms/icons/blue.png',
          },
        });
      }

      // Parada normal: círculo colorido com número
      return new google.maps.Marker({
        map: mapRef.current!,
        position: { lat: parada.latitude!, lng: parada.longitude! },
        title: `Parada ${parada.ordem}: ${parada.endereco}`,
        label: {
          text: String(parada.ordem),
          color: '#ffffff',
          fontWeight: '700',
        },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: getStatusColor(parada.status),
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
          scale: 16,
        },
      });
    });
  }, [isLoaded, mapReady, paradasComCoord, clearMarkers]);

  React.useEffect(
    () => () => {
      clearMarkers();
    },
    [clearMarkers]
  );

  // Calcular direções
  React.useEffect(() => {
    if (!isLoaded || paradasComCoord.length < 2) return;

    const DirectionsService = new google.maps.DirectionsService();

    const origin = {
      lat: paradasComCoord[0].latitude!,
      lng: paradasComCoord[0].longitude!,
    };

    const destination = {
      lat: paradasComCoord[paradasComCoord.length - 1].latitude!,
      lng: paradasComCoord[paradasComCoord.length - 1].longitude!,
    };

    const waypoints = paradasComCoord.slice(1, -1).map(p => ({
      location: { lat: p.latitude!, lng: p.longitude! },
      stopover: true,
    }));

    DirectionsService.route(
      {
        origin,
        destination,
        waypoints: waypoints.length > 0 ? waypoints : undefined,
        travelMode: google.maps.TravelMode.DRIVING,
        optimizeWaypoints: false,
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          setDirections(result);
        } else {
          console.error('Erro ao calcular direções:', status);
        }
      }
    );
  }, [isLoaded, paradasComCoord]);

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
        <ActivityIndicator size="large" color="#0D5A9C" />
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
      options={{
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: true,
        mapId: GOOGLE_MAPS_MAP_ID || undefined,
      }}
    >
      {/* Direções */}
      {directions && (
        <DirectionsRenderer
          directions={directions}
          options={{
            suppressMarkers: true,
            polylineOptions: {
              strokeColor: '#0D5A9C',
              strokeWeight: 4,
            },
          }}
        />
      )}
    </GoogleMap>
  );
}

const styles = StyleSheet.create(theme => ({
  loadingContainer: {
    height: 400,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.disabled,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  errorContainer: {
    height: 400,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.errorLight,
  },
  errorText: {
    fontSize: 14,
    color: theme.colors.error,
  },
}));
