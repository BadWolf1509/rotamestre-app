import React from 'react';

import MapaWebMapLibre from './MapaWebMapLibre';

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
 * - Usa MapaWebMapLibre.tsx (MapLibre GL JS + OpenFreeMap - gratuito!)
 *
 * Migrado de Google Maps para alternativas gratuitas em Dez/2024.
 */
export function MapaRotas(props: MapaRotasProps) {
  return <MapaWebMapLibre paradas={props.paradas as any} />;
}
