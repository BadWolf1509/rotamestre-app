import React from 'react';

import { MapaWeb } from './MapaWeb';

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
 * Componente de mapa para WEB
 * - Usa MapaWeb.tsx (Google Maps JavaScript API)
 */
export function MapaRotas(props: MapaRotasProps) {
  const { paradas } = props;

  const origem = paradas[0]
    ? { latitude: paradas[0].latitude, longitude: paradas[0].longitude }
    : undefined;

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
