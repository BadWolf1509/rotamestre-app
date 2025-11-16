/**
 * MapaAdapter - Wrapper Inteligente para Mapa
 *
 * Detecta automaticamente a plataforma e renderiza o componente apropriado:
 * - Web: MapaWeb (Google Maps JavaScript API)
 * - Mobile: MapaMobile (react-native-maps)
 */

import React from 'react';
import { Platform } from 'react-native';

import { MapaMobile } from './MapaMobile';
import MapaWeb from './MapaWeb';

interface Parada {
  id: string;
  ordem: number;
  endereco: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
  tipo?: string;
  is_checkpoint?: boolean;
}

interface MapaAdapterProps {
  paradas: Parada[];
}

/**
 * Componente principal que adapta o mapa para cada plataforma
 */
export function MapaAdapter({ paradas }: MapaAdapterProps) {
  // Web: Usa MapaWeb (Google Maps JavaScript API)
  if (Platform.OS === 'web') {
    return <MapaWeb paradas={paradas} />;
  }

  // Mobile: Usa MapaMobile (react-native-maps)
  // Metro automaticamente resolve para:
  // - Web: MapaMobile.web.tsx (stub sem react-native-maps)
  // - Native: MapaMobile.tsx (com react-native-maps completo)
  return <MapaMobile paradas={paradas} />;
}

