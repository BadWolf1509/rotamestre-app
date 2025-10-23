import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Linking, Platform, Alert } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { colors } from '@/lib/design-tokens';

interface Parada {
  id: string;
  endereco: string;
  latitude: number;
  longitude: number;
  ordem: number;
  status: string;
}

interface MapaRNProps {
  paradas: Parada[];
  rotaAtiva?: boolean;
}

export function MapaRN({ paradas, rotaAtiva = false }: MapaRNProps) {
  const [directions, setDirections] = useState<{latitude: number; longitude: number}[]>([]);
  const [distancia, setDistancia] = useState<string>('');
  const [duracao, setDuracao] = useState<string>('');

  useEffect(() => {
    if (paradas.length >= 2) {
      fetchDirections();
    }
  }, [paradas]);

  async function fetchDirections() {
    try {
      const origem = paradas[0];
      const destino = paradas[paradas.length - 1];
      const waypoints = paradas.slice(1, -1);

      const waypointsParam = waypoints.length > 0
        ? `&waypoints=${waypoints.map(w => `${w.latitude},${w.longitude}`).join('|')}`
        : '';

      const url =
        `https://maps.googleapis.com/maps/api/directions/json?` +
        `origin=${origem.latitude},${origem.longitude}` +
        `&destination=${destino.latitude},${destino.longitude}` +
        `${waypointsParam}` +
        `&key=${process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];

        // Decodificar polyline
        const points = decodePolyline(route.overview_polyline.points);
        setDirections(points);

        // Extrair distância e tempo
        setDistancia(route.legs.reduce((acc: number, leg: any) => acc + leg.distance.value, 0) / 1000 + ' km');
        setDuracao(Math.ceil(route.legs.reduce((acc: number, leg: any) => acc + leg.duration.value, 0) / 60) + ' min');
      }
    } catch (error) {
      console.error('Erro ao buscar direções:', error);
    }
  }

  // Decode Google Polyline
  function decodePolyline(encoded: string) {
    const points: {latitude: number; longitude: number}[] = [];
    let index = 0, lat = 0, lng = 0;

    while (index < encoded.length) {
      let b, shift = 0, result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lng += dlng;

      points.push({
        latitude: lat / 1e5,
        longitude: lng / 1e5,
      });
    }

    return points;
  }

  async function handleIniciarNavegacao() {
    const origem = paradas[0];
    const destino = paradas[paradas.length - 1];

    const url = Platform.select({
      ios: `maps://app?saddr=${origem.latitude},${origem.longitude}&daddr=${destino.latitude},${destino.longitude}`,
      android: `google.navigation:q=${destino.latitude},${destino.longitude}&mode=d`,
    });

    if (!url) return;

    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert('Erro', 'Google Maps não está instalado no dispositivo.');
    }
  }

  if (paradas.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Nenhuma parada para exibir</Text>
      </View>
    );
  }

  const region = {
    latitude: paradas[0].latitude,
    longitude: paradas[0].longitude,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={region}
      >
        {/* Marcadores de Paradas */}
        {paradas.map((parada, index) => (
          <Marker
            key={parada.id}
            coordinate={{
              latitude: parada.latitude,
              longitude: parada.longitude,
            }}
            title={`Parada ${parada.ordem}`}
            description={parada.endereco}
            pinColor={parada.status === 'concluida' ? colors.success : colors.primary.main}
          >
            <View style={styles.markerContainer}>
              <View style={[
                styles.marker,
                parada.status === 'concluida' && styles.markerConcluida
              ]}>
                <Text style={styles.markerText}>{parada.ordem}</Text>
              </View>
            </View>
          </Marker>
        ))}

        {/* Polyline da Rota */}
        {directions.length > 0 && (
          <Polyline
            coordinates={directions}
            strokeColor={colors.primary.main}
            strokeWidth={4}
          />
        )}
      </MapView>

      {/* Info da Rota */}
      {(distancia || duracao) && (
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            📍 {distancia} · ⏱️ {duracao}
          </Text>
        </View>
      )}

      {/* Botão Iniciar Navegação */}
      {rotaAtiva && (
        <TouchableOpacity
          style={styles.botaoNavegar}
          onPress={handleIniciarNavegacao}
          activeOpacity={0.8}
        >
          <Text style={styles.botaoTexto}>🧭 Iniciar Navegação</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
  },
  emptyText: {
    fontSize: 16,
    color: colors.gray[500],
  },
  markerContainer: {
    alignItems: 'center',
  },
  marker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary.main,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.white,
  },
  markerConcluida: {
    backgroundColor: colors.success,
  },
  markerText: {
    color: colors.white,
    fontWeight: 'bold',
    fontSize: 14,
  },
  infoBox: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    backgroundColor: colors.white,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  infoText: {
    fontSize: 14,
    color: colors.gray[700],
    textAlign: 'center',
  },
  botaoNavegar: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: colors.secondary.main,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  botaoTexto: {
    color: colors.white,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
