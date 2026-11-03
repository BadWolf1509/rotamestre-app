/**
 * MapaAdapter (Web) - Wrapper para plataforma Web
 *
 * Usa MapaWebMapLibre (MapLibre GL JS + OpenFreeMap - gratuito!)
 * Metro automaticamente resolve este arquivo para builds web.
 */

import React from 'react';

import type { MapaAdapterProps } from '@/types/parada-map';

import MapaWebMapLibre from './MapaWebMapLibre';

/**
 * MapaAdapter para Web - usa MapLibre GL JS.
 * As props vão por spread: prop nova de MapaAdapterProps chega ao mapa sem
 * edição aqui.
 */
export function MapaAdapter(props: MapaAdapterProps) {
  return <MapaWebMapLibre {...props} />;
}
