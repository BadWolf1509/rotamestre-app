/* global google */

import {
  type PlaceSuggestion,
  type GoogleAddressComponent,
  type DistanceMatrixRow,
  type DistanceMatrixElement,
  handleDirectionsError,
  parseGoogleError,
  RouteResult,
  success,
  failure,
} from './google-shared';
import { logger } from './logger';
import { getOptimizedDirections as osrmGetDirections } from './osrm';
import { formatErrorForLog } from './routeErrors';
import { supabase } from './supabase';
import { Coordenadas, EnderecoGeocodificado } from '../types/endereco';
import { GoogleDirectionsResult } from '../types/google-directions';

// Re-export polyline utilities for backwards compatibility
export { decodePolyline, encodePolyline, mergePolylines } from './polyline';
// Re-export shared utilities for backwards compatibility
export { RoutesAPIResponse, adaptRoutesAPIResponse, mapRoutesAPIError, parseDuration } from './google-shared';

// PlaceSuggestion is now exported from google-shared.ts
export type { PlaceSuggestion } from './google-shared';

// Aguardar Google Maps JavaScript API (carregada pelo MapaWeb.tsx via useJsApiLoader)
// NÃO criar script duplicado - usar a API já carregada

let waitingForGooglePromise: Promise<void> | null = null;

/**
 * Aguarda a Google Maps API estar disponível.
 * A API é carregada pelo MapaWeb.tsx via @react-google-maps/api useJsApiLoader.
 * Esta função apenas espera que google.maps esteja disponível, sem criar script duplicado.
 */
async function waitForGoogleMapsAPI(): Promise<void> {
  if (typeof window === 'undefined') {
    throw new Error('Window not available');
  }

  // Se já está carregada, retornar imediatamente
  if (window.google?.maps) {
    return;
  }

  // Se já está aguardando, retornar a mesma promise
  if (waitingForGooglePromise) {
    return waitingForGooglePromise;
  }

  // Aguardar a API ser carregada (por MapaWeb ou outro componente)
  waitingForGooglePromise = new Promise((resolve, reject) => {
    const maxWaitTime = 15000; // 15 segundos max
    const checkInterval = 100; // Verificar a cada 100ms
    let elapsed = 0;

    const checkLoaded = () => {
      if (window.google?.maps) {
        waitingForGooglePromise = null;
        resolve();
        return;
      }

      elapsed += checkInterval;
      if (elapsed >= maxWaitTime) {
        waitingForGooglePromise = null;
        reject(new Error('Timeout waiting for Google Maps API. Ensure MapaWeb is rendered.'));
        return;
      }

      setTimeout(checkLoaded, checkInterval);
    };

    checkLoaded();
  });

  return waitingForGooglePromise;
}

export const googleMapsService = {
  // Autocomplete usando Edge Function (não depende da JS API estar carregada)
  // Usa Supabase Edge Function para evitar CORS e funcionar sem MapaWeb renderizado
  async autocompleteAddress(input: string, sessionToken?: string): Promise<PlaceSuggestion[]> {
    if (input.length < 3) {
      return [];
    }

    try {
      // Chamar Edge Function do Supabase (não precisa da JS API)
      const { data, error } = await supabase.functions.invoke('google-places-autocomplete', {
        body: { input, sessionToken },
      });

      if (error) {
        logger.error('[Google.web] Erro no autocomplete (Edge Function)', error);
        return [];
      }

      return data?.predictions || [];
    } catch (error) {
      logger.error('[Google.web] Erro no autocomplete', error);
      return [];
    }
  },

  // Obter detalhes usando Edge Function (não depende da JS API estar carregada)
  async getPlaceDetails(placeId: string, sessionToken?: string): Promise<EnderecoGeocodificado | null> {
    try {
      // Chamar Edge Function do Supabase
      const { data, error } = await supabase.functions.invoke('google-place-details', {
        body: { placeId, sessionToken },
      });

      if (error) {
        logger.error('[Google.web] Erro ao obter detalhes do place (Edge Function)', error);
        return null;
      }

      return data || null;
    } catch (error) {
      logger.error('[Google.web] Erro ao obter detalhes do place', error);
      return null;
    }
  },

  // Geocodificar endereço (endereço -> coordenadas)
  async geocodeAddress(endereco: string): Promise<EnderecoGeocodificado | null> {
    try {
      await waitForGoogleMapsAPI();

      const geocoder = new google.maps.Geocoder();

      return new Promise((resolve) => {
        geocoder.geocode(
          {
            address: endereco,
            componentRestrictions: { country: 'BR' },
            language: 'pt-BR',
          },
          (results, status) => {
            if (status === 'OK' && results && results.length > 0) {
              const result = results[0];
              const location = result.geometry.location;

              const addressComponents: GoogleAddressComponent[] = result.address_components;
              const getComponent = (type: string) =>
                addressComponents.find((c) => c.types.includes(type))?.long_name || '';

              resolve({
                logradouro: getComponent('route'),
                numero: getComponent('street_number'),
                bairro: getComponent('sublocality') || getComponent('neighborhood'),
                cidade: getComponent('locality') || getComponent('administrative_area_level_2'),
                estado: getComponent('administrative_area_level_1'),
                cep: getComponent('postal_code'),
                coordenadas: {
                  latitude: location.lat(),
                  longitude: location.lng(),
                },
                formatted_address: result.formatted_address,
              });
            } else {
              logger.error('[Google.web] Geocoding error', { status });
              resolve(null);
            }
          }
        );
      });
    } catch (error) {
      logger.error('[Google.web] Erro no geocoding', error);
      return null;
    }
  },

  // Geocodificar reverso (coordenadas -> endereço)
  async reverseGeocode(coords: Coordenadas): Promise<string | null> {
    try {
      await waitForGoogleMapsAPI();

      const geocoder = new google.maps.Geocoder();

      return new Promise((resolve) => {
        geocoder.geocode(
          {
            location: { lat: coords.latitude, lng: coords.longitude },
            language: 'pt-BR',
          },
          (results, status) => {
            if (status === 'OK' && results && results.length > 0) {
              resolve(results[0].formatted_address);
            } else {
              logger.error('[Google.web] Reverse geocoding error', { status });
              resolve(null);
            }
          }
        );
      });
    } catch (error) {
      logger.error('[Google.web] Erro no reverse geocoding', error);
      return null;
    }
  },

  // Calcular rota entre pontos usando Edge Function (evita dependência da JS API)
  // Retorna RouteResult com erro detalhado ou resultado
  async getDirections(
    origin: Coordenadas,
    destination: Coordenadas,
    waypoints?: Coordenadas[],
    optimize: boolean = true
  ): Promise<GoogleDirectionsResult | null> {
    return this.getDirectionsWithError(origin, destination, waypoints, optimize)
      .then(result => result.success ? result.data! : null);
  },

  // MIGRADO PARA OSRM - Gratuito! (vs Edge Function → Google Routes API)
  async getDirectionsWithError(
    origin: Coordenadas,
    destination: Coordenadas,
    waypoints?: Coordenadas[],
    optimize: boolean = true
  ): Promise<RouteResult<GoogleDirectionsResult>> {
    try {
      // Usar OSRM (gratuito!) em vez de Edge Function → Google Routes API
      const osrmResult = await osrmGetDirections(
        { latitude: origin.latitude, longitude: origin.longitude },
        { latitude: destination.latitude, longitude: destination.longitude },
        waypoints?.map(wp => ({ latitude: wp.latitude, longitude: wp.longitude })),
        optimize
      );

      if (!osrmResult) {
        return failure(parseGoogleError('ZERO_RESULTS', 'Não foi possível calcular a rota'));
      }

      // Converter formato OSRM para formato Google (compatibilidade)
      const googleResult: GoogleDirectionsResult = {
        polyline: osrmResult.polyline,
        distancia_total_metros: osrmResult.distancia_total_metros,
        duracao_total_segundos: osrmResult.duracao_total_segundos,
        ordem_otimizada: osrmResult.ordem_otimizada,
        legs: osrmResult.legs.map(leg => ({
          distancia_metros: leg.distancia_metros,
          duracao_segundos: leg.duracao_segundos,
          endereco_inicio: leg.endereco_inicio,
          endereco_fim: leg.endereco_fim,
          coordenadas_inicio: {
            latitude: leg.coordenadas_inicio.latitude,
            longitude: leg.coordenadas_inicio.longitude,
          },
          coordenadas_fim: {
            latitude: leg.coordenadas_fim.latitude,
            longitude: leg.coordenadas_fim.longitude,
          },
        })),
      };

      return success(googleResult);
    } catch (err) {
      const error = handleDirectionsError(err);
      logger.error('[OSRM.web] ' + formatErrorForLog(error));
      return failure(error);
    }
  },

  // Calcular rota segmento por segmento usando Edge Function (respeita ordem manual)
  async getDirectionsSequential(
    origin: Coordenadas,
    destination: Coordenadas,
    waypoints: Coordenadas[]
  ): Promise<GoogleDirectionsResult | null> {
    return this.getDirectionsSequentialWithError(origin, destination, waypoints)
      .then(result => result.success ? result.data! : null);
  },

  // MIGRADO PARA OSRM - Usa optimize=false para manter ordem manual
  async getDirectionsSequentialWithError(
    origin: Coordenadas,
    destination: Coordenadas,
    waypoints: Coordenadas[]
  ): Promise<RouteResult<GoogleDirectionsResult>> {
    try {
      // Usar OSRM com optimize=false para manter a ordem
      const osrmResult = await osrmGetDirections(
        { latitude: origin.latitude, longitude: origin.longitude },
        { latitude: destination.latitude, longitude: destination.longitude },
        waypoints.map(wp => ({ latitude: wp.latitude, longitude: wp.longitude })),
        false // Não otimizar - manter ordem manual
      );

      if (!osrmResult) {
        return failure(parseGoogleError('ZERO_RESULTS', 'Não foi possível calcular a rota sequencial'));
      }

      // Converter formato OSRM para formato Google
      const googleResult: GoogleDirectionsResult = {
        polyline: osrmResult.polyline,
        distancia_total_metros: osrmResult.distancia_total_metros,
        duracao_total_segundos: osrmResult.duracao_total_segundos,
        ordem_otimizada: [], // Vazio porque não otimizou
        legs: osrmResult.legs.map(leg => ({
          distancia_metros: leg.distancia_metros,
          duracao_segundos: leg.duracao_segundos,
          endereco_inicio: leg.endereco_inicio,
          endereco_fim: leg.endereco_fim,
          coordenadas_inicio: {
            latitude: leg.coordenadas_inicio.latitude,
            longitude: leg.coordenadas_inicio.longitude,
          },
          coordenadas_fim: {
            latitude: leg.coordenadas_fim.latitude,
            longitude: leg.coordenadas_fim.longitude,
          },
        })),
      };

      return success(googleResult);
    } catch (err) {
      const error = handleDirectionsError(err);
      logger.error('[OSRM.web Sequential] ' + formatErrorForLog(error));
      return failure(error);
    }
  },
  // Calcular matriz de distâncias usando Edge Function (não depende da JS API)
  async getDistanceMatrix(origins: Coordenadas[], destinations: Coordenadas[]) {
    try {
      // Converter coordenadas para formato da API (lat,lng|lat,lng)
      const originsStr = origins.map((o) => `${o.latitude},${o.longitude}`).join('|');
      const destinationsStr = destinations.map((d) => `${d.latitude},${d.longitude}`).join('|');

      // Usar Edge Function do Supabase (evita CORS e não depende da JS API)
      const { data, error: invokeError } = await supabase.functions.invoke('google-distance-matrix', {
        body: {
          origins: originsStr,
          destinations: destinationsStr,
          mode: 'driving',
        },
      });

      if (invokeError) {
        logger.error('[Google.web] DistanceMatrix Edge Function error', invokeError);
        return null;
      }

      // Processar resposta da Distance Matrix API
      if (data?.status === 'OK' && data?.rows) {
        const matrix = (data.rows as DistanceMatrixRow[]).map((row, i: number) => ({
          origem: origins[i],
          destinos: row.elements.map((element: DistanceMatrixElement, j: number) => ({
            destino: destinations[j],
            distancia: element.distance?.value || 0,
            tempo: element.duration_in_traffic?.value || element.duration?.value || 0,
          })),
        }));
        return matrix;
      }

      logger.error('[Google.web] DistanceMatrix API Error', { status: data?.status || 'Unknown error' });
      return null;
    } catch (error) {
      logger.error('[Google.web] Erro na matriz de distâncias', error);
      return null;
    }
  },
};

// Helper function: retorna apenas as coordenadas (simplificado)
export async function getCoordinates(endereco: string): Promise<{ lat: number; lng: number } | null> {
  const result = await googleMapsService.geocodeAddress(endereco);
  if (result) {
    return {
      lat: result.coordenadas.latitude,
      lng: result.coordenadas.longitude,
    };
  }
  return null;
}
