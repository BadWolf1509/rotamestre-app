/**
 * MapaAdapter (Mobile) - Wrapper para plataformas nativas (iOS/Android)
 *
 * Usa MapaMobile (MapLibre Native + tiles Carto/OSM)
 * Metro automaticamente resolve este arquivo para builds native.
 *
 * Nota: A versão web está em MapaAdapter.web.tsx
 */

import React from 'react';

import type { ParadaMapItem, StatusFilter } from '@/types/parada-map';

import { MapaMobile } from './MapaMobile';

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
 * MapaAdapter para Mobile - usa MapLibre Native
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
  return (
    <MapaMobile
      paradas={paradas}
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
