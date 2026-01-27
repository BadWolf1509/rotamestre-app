import React from 'react';
import { Platform } from 'react-native';

import { MapaRN } from './MapaRN';
import MapaWebMapLibre from './MapaWebMapLibre';

interface Parada {
  id: string;
  endereco: string;
  latitude: number;
  longitude: number;
  ordem: number;
  status: string;
  is_checkpoint?: boolean;
}

interface MapaRotasProps {
  paradas: Parada[];
  rotaAtiva?: boolean;
}

/**
 * Componente de mapa multiplataforma
 * - Web: Usa MapaWebMapLibre.tsx (MapLibre GL JS + OpenFreeMap - gratuito!)
 * - Mobile: Usa MapaRN.tsx (react-native-maps + OSM tiles)
 *
 * Migrado de Google Maps para alternativas gratuitas em Dez/2024.
 */
export function MapaRotas(props: MapaRotasProps) {
  if (Platform.OS === 'web') {
    return <MapaWebMapLibre paradas={props.paradas as any} />;
  }

  return <MapaRN {...props} />;
}
