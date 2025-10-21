import React, { useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { GoogleMap, useJsApiLoader, Marker, DirectionsRenderer } from '@react-google-maps/api';

interface Parada {
  id: string;
  ordem: number;
  endereco: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
}

interface MapaWebProps {
  paradas: Parada[];
}

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

const containerStyle = {
  width: '100%',
  height: '400px',
};

export default function MapaWeb({ paradas }: MapaWebProps) {
  const [directions, setDirections] = React.useState<google.maps.DirectionsResult | null>(null);

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  const [map, setMap] = React.useState<google.maps.Map | null>(null);

  // Calcular centro do mapa
  const center = React.useMemo(() => {
    const paradasComCoord = paradas.filter(p => p.latitude && p.longitude);
    if (paradasComCoord.length === 0) {
      return { lat: -15.7942, lng: -47.8822 }; // Brasília
    }
    return {
      lat: paradasComCoord[0].latitude!,
      lng: paradasComCoord[0].longitude!,
    };
  }, [paradas]);

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);

    // Ajustar bounds para mostrar todas as paradas
    const paradasComCoord = paradas.filter(p => p.latitude && p.longitude);
    if (paradasComCoord.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      paradasComCoord.forEach(p => {
        bounds.extend({ lat: p.latitude!, lng: p.longitude! });
      });
      map.fitBounds(bounds);
    }
  }, [paradas]);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  // Calcular direções
  React.useEffect(() => {
    if (!isLoaded || paradas.length < 2) return;

    const paradasComCoord = paradas.filter(p => p.latitude && p.longitude);
    if (paradasComCoord.length < 2) return;

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
  }, [isLoaded, paradas]);

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

  const paradasComCoord = paradas.filter(p => p.latitude && p.longitude);

  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={center}
      zoom={13}
      onLoad={onLoad}
      onUnmount={onUnmount}
      options={{
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: true,
      }}
    >
      {/* Marcadores */}
      {!directions && paradasComCoord.map((parada) => (
        <Marker
          key={parada.id}
          position={{
            lat: parada.latitude!,
            lng: parada.longitude!,
          }}
          label={{
            text: String(parada.ordem),
            color: '#fff',
            fontWeight: 'bold',
          }}
          icon={{
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: parada.status === 'concluida' ? '#10b981' : parada.status === 'em_andamento' ? '#3b82f6' : '#f59e0b',
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 2,
            scale: 15,
          }}
          title={`Parada ${parada.ordem}: ${parada.endereco}`}
        />
      ))}

      {/* Direções */}
      {directions && (
        <DirectionsRenderer
          directions={directions}
          options={{
            suppressMarkers: false,
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

const styles = StyleSheet.create({
  loadingContainer: {
    height: 400,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#6b7280',
  },
  errorContainer: {
    height: 400,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
  },
  errorText: {
    fontSize: 14,
    color: '#ef4444',
  },
});
