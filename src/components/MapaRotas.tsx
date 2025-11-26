import React from 'react';
import { Platform } from 'react-native';

import { MapaRN } from './MapaRN';
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
 * Componente de mapa multiplataforma
 * - Web: Usa MapaWeb.tsx (Google Maps JavaScript API)
 * - Mobile: Usa MapaRN.tsx (react-native-maps)
 */
export function MapaRotas(props: MapaRotasProps) {
  if (Platform.OS === 'web') {
    return <MapaWeb paradas={props.paradas} />;
  }

  return <MapaRN {...props} />;
}
