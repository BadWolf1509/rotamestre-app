import React from 'react';
import { Platform } from 'react-native';
import { MapaWeb } from './MapaWeb';
import { MapaRN } from './MapaRN';

interface Parada {
  id: string;
  endereco: string;
  latitude: number;
  longitude: number;
  ordem: number;
  status: string;
}

interface MapaRotasProps {
  paradas: Parada[];
  rotaAtiva?: boolean;
}

/**
 * Componente de mapa multiplataforma
 * - Web: Usa MapaWeb.tsx (Google Maps JavaScript API)
 * - Mobile: Usa MapaRN.tsx (react-native-maps)
 */
export function MapaRotas(props: MapaRotasProps) {
  if (Platform.OS === 'web') {
    // Transformar para formato do MapaWeb
    const { paradas } = props;
    const origem = paradas[0] ? { latitude: paradas[0].latitude, longitude: paradas[0].longitude } : undefined;
    const destino = paradas[paradas.length - 1]
      ? { latitude: paradas[paradas.length - 1].latitude, longitude: paradas[paradas.length - 1].longitude }
      : undefined;
    const waypoints = paradas.slice(1, -1).map(p => ({
      latitude: p.latitude,
      longitude: p.longitude,
    }));

    if (!origem || !destino) return null;

    return <MapaWeb origem={origem} destino={destino} waypoints={waypoints} />;
  }

  return <MapaRN {...props} />;
}
