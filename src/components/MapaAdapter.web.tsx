/**
 * MapaAdapter (Web) - Wrapper para plataforma Web
 *
 * Usa MapaWebMapLibre (MapLibre GL JS + OpenFreeMap - gratuito!)
 * Metro automaticamente resolve este arquivo para builds web.
 */

import React from 'react';

import type { ParadaMapItem, StatusFilter } from '@/types/parada-map';

import MapaWebMapLibre from './MapaWebMapLibre';

interface MapaAdapterProps {
  paradas: ParadaMapItem[];
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
      paradas={paradas}
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
