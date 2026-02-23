/**
 * Route directions service (historical name from Google Maps API migration).
 * Internally uses OSRM (free) for route optimization and directions.
 * See also: google-shared.ts for types, osrm/ for backend implementation.
 */

import { logger } from '@/lib/logger';
import { getOptimizedDirections as osrmGetDirections } from '@/lib/osrm';

import {
  type PlaceSuggestion,
  type GoogleAddressComponent,
  type GoogleAutocompletePrediction,
  type RouteMatrixElement,
  handleDirectionsError,
  RouteResult,
  parseGoogleError,
  success,
  failure,
} from './google-shared';
import { formatErrorForLog } from './routeErrors';
import { Coordenadas, EnderecoGeocodificado } from '../types/endereco';
import { GoogleDirectionsResult } from '../types/google-directions';

// Re-export polyline utilities for backwards compatibility
export { decodePolyline, encodePolyline, mergePolylines } from '@/lib/polyline';
// Re-export shared utilities for backwards compatibility
export { RoutesAPIResponse, adaptRoutesAPIResponse, mapRoutesAPIError, parseDuration } from './google-shared';

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

// ============================================================================
// GEOCODING
// ============================================================================

// Helper function: retorna apenas as coordenadas (simplificado)
export async function getCoordinates(endereco: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        endereco
      )}&key=${GOOGLE_MAPS_API_KEY}`
    );

    const data = await response.json();

    if (data.status === 'OK' && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      return {
        lat: location.lat,
        lng: location.lng,
      };
    }

    return null;
  } catch (error) {
    logger.error('[Google] Erro ao obter coordenadas', error);
    return null;
  }
}

// PlaceSuggestion is now exported from google-shared.ts
export type { PlaceSuggestion } from './google-shared';

export const googleMapsService = {
  // Autocomplete de endereços (Google Places Autocomplete API)
  async autocompleteAddress(input: string, sessionToken?: string): Promise<PlaceSuggestion[]> {
    if (input.length < 3) {
      return [];
    }

    try {
      // Usar sessionToken para agrupar chamadas e reduzir custos
      const sessionParam = sessionToken ? `&sessiontoken=${sessionToken}` : '';

      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
          input
        )}&key=${GOOGLE_MAPS_API_KEY}&language=pt-BR&components=country:br${sessionParam}`
      );

      const data = await response.json();

      if (data.status === 'OK' && data.predictions) {
        return data.predictions.map((prediction: GoogleAutocompletePrediction) => ({
          place_id: prediction.place_id,
          description: prediction.description,
          structured_formatting: {
            main_text: prediction.structured_formatting.main_text,
            secondary_text: prediction.structured_formatting.secondary_text || '',
          },
        }));
      }

      return [];
    } catch (error) {
      logger.error('[Google] Erro no autocomplete', error);
      return [];
    }
  },

  // Obter detalhes de um place_id (retorna endereço completo + coordenadas)
  async getPlaceDetails(placeId: string, sessionToken?: string): Promise<EnderecoGeocodificado | null> {
    try {
      const sessionParam = sessionToken ? `&sessiontoken=${sessionToken}` : '';

      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${GOOGLE_MAPS_API_KEY}&language=pt-BR&fields=formatted_address,geometry,address_components${sessionParam}`
      );

      const data = await response.json();

      if (data.status === 'OK' && data.result) {
        const result = data.result;
        const location = result.geometry.location;

        // Extrair componentes do endereço
        const addressComponents: GoogleAddressComponent[] = result.address_components || [];
        const getComponent = (type: string) =>
          addressComponents.find((c) => c.types.includes(type))?.long_name || '';

        return {
          logradouro: getComponent('route'),
          numero: getComponent('street_number'),
          bairro: getComponent('sublocality') || getComponent('neighborhood'),
          cidade: getComponent('locality') || getComponent('administrative_area_level_2'),
          estado: getComponent('administrative_area_level_1'),
          cep: getComponent('postal_code'),
          coordenadas: {
            latitude: location.lat,
            longitude: location.lng,
          },
          formatted_address: result.formatted_address,
        };
      }

      return null;
    } catch (error) {
      logger.error('[Google] Erro ao obter detalhes do place', error);
      return null;
    }
  },

  // Geocodificar endereço (endereço -> coordenadas)
  async geocodeAddress(endereco: string): Promise<EnderecoGeocodificado | null> {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
          endereco
        )}&key=${GOOGLE_MAPS_API_KEY}`
      );

      const data = await response.json();

      if (data.status === 'OK' && data.results.length > 0) {
        const result = data.results[0];
        const location = result.geometry.location;

        // Extrair componentes do endereço
        const addressComponents: GoogleAddressComponent[] = result.address_components;
        const getComponent = (type: string) =>
          addressComponents.find((c) => c.types.includes(type))?.long_name || '';

        return {
          logradouro: getComponent('route'),
          numero: getComponent('street_number'),
          bairro: getComponent('sublocality') || getComponent('neighborhood'),
          cidade: getComponent('locality') || getComponent('administrative_area_level_2'),
          estado: getComponent('administrative_area_level_1'),
          cep: getComponent('postal_code'),
          coordenadas: {
            latitude: location.lat,
            longitude: location.lng,
          },
          formatted_address: result.formatted_address,
        };
      }

      return null;
    } catch (error) {
      logger.error('[Google] Erro no geocoding', error);
      return null;
    }
  },

  // Geocodificar reverso (coordenadas -> endereço)
  async reverseGeocode(coords: Coordenadas): Promise<string | null> {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${coords.latitude},${coords.longitude}&key=${GOOGLE_MAPS_API_KEY}`
      );

      const data = await response.json();

      if (data.status === 'OK' && data.results.length > 0) {
        return data.results[0].formatted_address;
      }

      return null;
    } catch (error) {
      logger.error('[Google] Erro no reverse geocoding', error);
      return null;
    }
  },

  // Calcular rota entre pontos
  // MIGRADO PARA OSRM - Gratuito! (vs ~R$900/mês do Google Routes API)
  // optimize: true = reordena waypoints para menor distância (padrão)
  // optimize: false = mantém a ordem fornecida dos waypoints
  async getDirections(
    origin: Coordenadas,
    destination: Coordenadas,
    waypoints?: Coordenadas[],
    optimize: boolean = true
  ): Promise<GoogleDirectionsResult | null> {
    return this.getDirectionsWithError(origin, destination, waypoints, optimize)
      .then(result => result.success ? result.data! : null);
  },

  // Versão com erro detalhado
  // MIGRADO PARA OSRM - Economia de ~R$900/mês!
  // Usa OSRM Trip API para otimização (TSP) - solução ÓTIMA para <10 waypoints
  async getDirectionsWithError(
    origin: Coordenadas,
    destination: Coordenadas,
    waypoints?: Coordenadas[],
    optimize: boolean = true
  ): Promise<RouteResult<GoogleDirectionsResult>> {
    try {
      // Usar OSRM (gratuito!) em vez de Google Routes API (~R$900/mês)
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
      logger.error('[OSRM] ' + formatErrorForLog(error));
      return failure(error);
    }
  },

  // Calcular rota segmento por segmento (garante ordem manual)
  // MIGRADO PARA OSRM - Gratuito!
  // Útil quando queremos manter a ordem exata dos waypoints
  async getDirectionsSequential(
    origin: Coordenadas,
    destination: Coordenadas,
    waypoints: Coordenadas[]
  ): Promise<GoogleDirectionsResult | null> {
    return this.getDirectionsSequentialWithError(origin, destination, waypoints)
      .then(result => result.success ? result.data! : null);
  },

  // Versão com erro detalhado para rota sequencial
  // MIGRADO PARA OSRM - Usa optimize=false para manter ordem
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
      logger.error('[OSRM Sequential] ' + formatErrorForLog(error));
      return failure(error);
    }
  },

  // Calcular matriz de distâncias usando Routes API (Compute Route Matrix)
  // Migrado da Distance Matrix API (deprecated em 01/03/2025)
  async getDistanceMatrix(origins: Coordenadas[], destinations: Coordenadas[]) {
    try {
      // Construir request body para Routes API
      const requestBody = {
        origins: origins.map((coord) => ({
          waypoint: {
            location: {
              latLng: {
                latitude: coord.latitude,
                longitude: coord.longitude,
              },
            },
          },
        })),
        destinations: destinations.map((coord) => ({
          waypoint: {
            location: {
              latLng: {
                latitude: coord.latitude,
                longitude: coord.longitude,
              },
            },
          },
        })),
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_AWARE',
      };

      const response = await fetch(
        'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
            'X-Goog-FieldMask': 'originIndex,destinationIndex,duration,distanceMeters,status,condition',
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Reorganizar resposta em formato de matriz (compatível com código existente)
      const matrix: Array<{
        origem: Coordenadas;
        destinos: Array<{ destino: Coordenadas; distancia: number; tempo: number }>;
      }> = [];

      origins.forEach((origin, i) => {
        const row = {
          origem: origin,
          destinos: destinations.map((destination, j) => {
            // Encontrar o elemento correspondente na resposta
            const element = (data as RouteMatrixElement[]).find(
              (item) => item.originIndex === i && item.destinationIndex === j
            );

            return {
              destino: destination,
              distancia: element?.distanceMeters || 0, // Já vem em metros
              tempo: element?.duration ? parseInt(element.duration.replace('s', '')) : 0, // Converter "160s" para 160
            };
          }),
        };

        matrix.push(row);
      });

      return matrix;
    } catch (error) {
      logger.error('[Google] Erro na matriz de distâncias', error);
      return null;
    }
  },
};
