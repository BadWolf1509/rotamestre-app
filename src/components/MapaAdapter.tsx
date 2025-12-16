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
  tipo?: string | null;
  is_checkpoint?: boolean;
}

type StatusFilter = 'all' | 'pendente' | 'em_andamento' | 'concluida';

interface MapaAdapterProps {
  paradas: Parada[];
  selectedParadaId?: string | null;
  onMarkerPress?: (paradaId: string) => void;
  statusFilter?: StatusFilter;
  /** ID da rota para rastreamento em tempo real do motorista */
  rotaId?: string;
  /** Nome do motorista para exibir no marcador */
  motoristaNome?: string;
  /** Se true e rota em andamento, mostra posição do motorista em tempo real */
  showMotorista?: boolean;
}

/**
 * Componente principal que adapta o mapa para cada plataforma
 */
export function MapaAdapter({
  paradas,
  selectedParadaId,
  onMarkerPress,
  statusFilter,
  rotaId,
  motoristaNome,
  showMotorista,
}: MapaAdapterProps) {
  // Web: Usa MapaWeb (Google Maps JavaScript API)
  if (Platform.OS === 'web') {
    return (
      <MapaWeb
        paradas={paradas as any}
        selectedParadaId={selectedParadaId}
        onMarkerPress={onMarkerPress}
        rotaId={rotaId}
        motoristaNome={motoristaNome}
        showMotorista={showMotorista}
      />
    );
  }

  // Mobile: Usa MapaMobile (react-native-maps)
  // Metro automaticamente resolve para:
  // - Web: MapaMobile.web.tsx (stub sem react-native-maps)
  // - Native: MapaMobile.tsx (com react-native-maps completo)
  return (
    <MapaMobile
      paradas={paradas as any}
      selectedParadaId={selectedParadaId}
      onMarkerPress={onMarkerPress}
      statusFilter={statusFilter}
      rotaId={rotaId}
      motoristaNome={motoristaNome}
      showMotorista={showMotorista}
    />
  );
}

