import React from 'react';

import MapaWeb from './MapaWeb';

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
  return <MapaWeb paradas={props.paradas} />;
}
