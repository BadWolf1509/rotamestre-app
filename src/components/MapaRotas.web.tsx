import React from 'react';

import type { ParadaWithCoords } from '@/types/parada-map';

import MapaWebMapLibre from './MapaWebMapLibre';

interface MapaRotasProps {
  paradas: ParadaWithCoords[];
  rotaAtiva?: boolean;
}

/**
 * Componente de mapa para WEB
 * - Usa MapaWebMapLibre.tsx (MapLibre GL JS + OpenFreeMap - gratuito!)
 *
 * Migrado de Google Maps para alternativas gratuitas em Dez/2024.
 */
export function MapaRotas(props: MapaRotasProps) {
  return <MapaWebMapLibre paradas={props.paradas} />;
}
