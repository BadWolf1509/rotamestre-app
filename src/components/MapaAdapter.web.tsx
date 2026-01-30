/**
 * MapaAdapter (Web) - Wrapper para plataforma Web
 *
 * Usa MapaWebMapLibre (MapLibre GL JS + OpenFreeMap - gratuito!)
 * Metro automaticamente resolve este arquivo para builds web.
 */

import React from 'react';

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
  onMapPress?: () => void;
  onMarkerLongPress?: (paradaId: string) => void;
  statusFilter?: StatusFilter;
  rotaId?: string;
  motoristaNome?: string;
  showMotorista?: boolean;
  unidadeNome?: string;
}

/**
 * MapaAdapter para Web - usa MapLibre GL JS
 */
export function MapaAdapter({
  paradas,
  selectedParadaId,
  onMarkerPress,
  onMapPress,
  statusFilter,
  rotaId,
  motoristaNome,
  showMotorista,
  unidadeNome,
}: MapaAdapterProps) {
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
