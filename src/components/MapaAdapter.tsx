/**
 * MapaAdapter (Mobile) - Wrapper para plataformas nativas (iOS/Android)
 *
 * Usa MapaMobile (MapLibre Native + tiles OpenFreeMap)
 * Metro automaticamente resolve este arquivo para builds native.
 *
 * Nota: A versão web está em MapaAdapter.web.tsx
 */

import React from 'react';

import type { MapaAdapterProps } from '@/types/parada-map';

import { MapaMobile } from './MapaMobile';

/**
 * MapaAdapter para Mobile - usa MapLibre Native.
 * As props vão por spread: prop nova de MapaAdapterProps chega ao mapa sem
 * edição aqui.
 */
export function MapaAdapter(props: MapaAdapterProps) {
  return <MapaMobile {...props} />;
}
