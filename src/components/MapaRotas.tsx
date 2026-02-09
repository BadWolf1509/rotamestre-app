import React from 'react';
import { Platform } from 'react-native';

import type { ParadaWithCoords } from '@/types/parada-map';

import { MapaRN } from './MapaRN';
import MapaWebMapLibre from './MapaWebMapLibre';

interface MapaRotasProps {
  paradas: ParadaWithCoords[];
  rotaAtiva?: boolean;
}

/**
 * Componente de mapa multiplataforma
 * - Web: Usa MapaWebMapLibre.tsx (MapLibre GL JS + OpenFreeMap - gratuito!)
 * - Mobile: Usa MapaRN.tsx (MapLibre Native + tiles Carto/OSM)
 *
 * Migrado de Google Maps para alternativas gratuitas em Dez/2024.
 */
export function MapaRotas(props: MapaRotasProps) {
  if (Platform.OS === 'web') {
    return <MapaWebMapLibre paradas={props.paradas} />;
  }

  return <MapaRN {...props} />;
}
