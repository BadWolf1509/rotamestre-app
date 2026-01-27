/**
 * MapaAdapter - Wrapper Inteligente para Mapa
 *
 * Detecta automaticamente a plataforma e renderiza o componente apropriado:
 * - Web: MapaWebMapLibre (MapLibre GL JS + OpenFreeMap - gratuito!)
 * - Mobile: MapaMobile (react-native-maps + OSM tiles)
 *
 * Migrado de Google Maps para alternativas gratuitas em Dez/2024.
 */

import React from 'react';
import { Platform } from 'react-native';

import { MapaMobile } from './MapaMobile';
import MapaWebMapLibre from './MapaWebMapLibre';

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
  /** Callback quando toca/clica fora dos marcadores (deselecionar) */
  onMapPress?: () => void;
  /** Callback para long-press no marcador (ações rápidas) - apenas mobile */
  onMarkerLongPress?: (paradaId: string) => void;
  statusFilter?: StatusFilter;
  /** ID da rota para rastreamento em tempo real do motorista */
  rotaId?: string;
  /** Nome do motorista para exibir no marcador */
  motoristaNome?: string;
  /** Se true e rota em andamento, mostra posição do motorista em tempo real */
  showMotorista?: boolean;
  /** Nome da unidade para exibir nos checkpoints (PARTIDA/CHEGADA) */
  unidadeNome?: string;
}

/**
 * Componente principal que adapta o mapa para cada plataforma
 */
export function MapaAdapter({
  paradas,
  selectedParadaId,
  onMarkerPress,
  onMapPress,
  onMarkerLongPress,
  statusFilter,
  rotaId,
  motoristaNome,
  showMotorista,
  unidadeNome,
}: MapaAdapterProps) {
  // Web: Usa MapaWebMapLibre (MapLibre GL JS + OpenFreeMap - gratuito!)
  if (Platform.OS === 'web') {
    return (
      <MapaWebMapLibre
        paradas={paradas as any}
        selectedParadaId={selectedParadaId}
        onMarkerPress={onMarkerPress}
        onMapPress={onMapPress}
        statusFilter={statusFilter}
        rotaId={rotaId}
        motoristaNome={motoristaNome}
        showMotorista={showMotorista}
        unidadeNome={unidadeNome}
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
      onMapPress={onMapPress}
      onMarkerLongPress={onMarkerLongPress}
      statusFilter={statusFilter}
      rotaId={rotaId}
      motoristaNome={motoristaNome}
      showMotorista={showMotorista}
      unidadeNome={unidadeNome}
    />
  );
}

