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
  rotaId?: string;
  motoristaNome?: string;
  showMotoristaMarker?: boolean;
  selectedParadaId?: string | null;
  onMarkerPress?: (paradaId: string) => void;
}

/**
 * Componente principal que adapta o mapa para cada plataforma
 */
export function MapaAdapter({
  paradas,
  rotaId,
  motoristaNome,
  showMotoristaMarker = false,
  selectedParadaId,
  onMarkerPress,
}: MapaAdapterProps) {
  // Web: Usa MapaWeb (Google Maps JavaScript API)
  if (Platform.OS === 'web') {
    return (
      <MapaWeb
        paradas={paradas}
        rotaId={rotaId}
        motoristaNome={motoristaNome}
        showMotoristaMarker={showMotoristaMarker}
        selectedParadaId={selectedParadaId}
        onMarkerPress={onMarkerPress}
      />
    );
  }

  // Mobile: Usa MapaMobile (react-native-maps)
  // Metro automaticamente resolve para:
  // - Web: MapaMobile.web.tsx (stub sem react-native-maps)
  // - Native: MapaMobile.tsx (com react-native-maps completo)
  return (
    <MapaMobile
      paradas={paradas}
      rotaId={rotaId}
      motoristaNome={motoristaNome}
      showMotoristaMarker={showMotoristaMarker}
    />
  );
}

