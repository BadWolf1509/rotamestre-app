/**
 * Route directions service (historical name from Google Maps API migration).
 * Internally uses OSRM (free) for route optimization and directions.
 * See also: google-shared.ts for types, osrm/ for backend implementation.
 *
 * NOTA: geocoding/autocomplete/place details migraram para Edge Functions
 * (src/lib/googlePlaces.ts via geocoding.ts) — não existe mais API key do
 * Google no client. A chave server-side vive nos secrets das Edge Functions.
 */

import { logger } from '@/lib/logger';
import { getOptimizedDirections as osrmGetDirections } from '@/lib/osrm';

import {
  handleDirectionsError,
  RouteResult,
  parseGoogleError,
  success,
  failure,
} from './google-shared';
import { formatErrorForLog } from './routeErrors';
import { Coordenadas } from '../types/endereco';
import { GoogleDirectionsResult } from '../types/google-directions';

// Re-export polyline utilities for backwards compatibility
export { decodePolyline, encodePolyline, mergePolylines } from '@/lib/polyline';
// Re-export shared utilities for backwards compatibility
export {
  RoutesAPIResponse,
  adaptRoutesAPIResponse,
  mapRoutesAPIError,
  parseDuration,
} from './google-shared';

// PlaceSuggestion is now exported from google-shared.ts
export type { PlaceSuggestion } from './google-shared';

export const googleMapsService = {
  // Calcular rota entre pontos
  // MIGRADO PARA OSRM - Gratuito! (vs ~R$900/mês do Google Routes API)
  // optimize: true = reordena waypoints para menor distância (padrão)
  // optimize: false = mantém a ordem fornecida dos waypoints
  async getDirections(
    origin: Coordenadas,
    destination: Coordenadas,
    waypoints?: Coordenadas[],
    optimize: boolean = true,
  ): Promise<GoogleDirectionsResult | null> {
    return this.getDirectionsWithError(
      origin,
      destination,
      waypoints,
      optimize,
    ).then((result) => (result.success ? result.data! : null));
  },

  // Versão com erro detalhado
  // MIGRADO PARA OSRM - Economia de ~R$900/mês!
  // Usa OSRM Trip API para otimização (TSP) - solução ÓTIMA para <10 waypoints
  async getDirectionsWithError(
    origin: Coordenadas,
    destination: Coordenadas,
    waypoints?: Coordenadas[],
    optimize: boolean = true,
  ): Promise<RouteResult<GoogleDirectionsResult>> {
    try {
      // Usar OSRM (gratuito!) em vez de Google Routes API (~R$900/mês)
      const osrmResult = await osrmGetDirections(
        { latitude: origin.latitude, longitude: origin.longitude },
        { latitude: destination.latitude, longitude: destination.longitude },
        waypoints?.map((wp) => ({
          latitude: wp.latitude,
          longitude: wp.longitude,
        })),
        optimize,
      );

      if (!osrmResult) {
        return failure(
          parseGoogleError('ZERO_RESULTS', 'Não foi possível calcular a rota'),
        );
      }

      // Converter formato OSRM para formato Google (compatibilidade)
      const googleResult: GoogleDirectionsResult = {
        polyline: osrmResult.polyline,
        distancia_total_metros: osrmResult.distancia_total_metros,
        duracao_total_segundos: osrmResult.duracao_total_segundos,
        is_estimated: osrmResult.is_estimated === true,
        ordem_otimizada: osrmResult.ordem_otimizada,
        legs: osrmResult.legs.map((leg) => ({
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
    waypoints: Coordenadas[],
  ): Promise<GoogleDirectionsResult | null> {
    return this.getDirectionsSequentialWithError(
      origin,
      destination,
      waypoints,
    ).then((result) => (result.success ? result.data! : null));
  },

  // Versão com erro detalhado para rota sequencial
  // MIGRADO PARA OSRM - Usa optimize=false para manter ordem
  async getDirectionsSequentialWithError(
    origin: Coordenadas,
    destination: Coordenadas,
    waypoints: Coordenadas[],
  ): Promise<RouteResult<GoogleDirectionsResult>> {
    try {
      // Usar OSRM com optimize=false para manter a ordem
      const osrmResult = await osrmGetDirections(
        { latitude: origin.latitude, longitude: origin.longitude },
        { latitude: destination.latitude, longitude: destination.longitude },
        waypoints.map((wp) => ({
          latitude: wp.latitude,
          longitude: wp.longitude,
        })),
        false, // Não otimizar - manter ordem manual
      );

      if (!osrmResult) {
        return failure(
          parseGoogleError(
            'ZERO_RESULTS',
            'Não foi possível calcular a rota sequencial',
          ),
        );
      }

      // Converter formato OSRM para formato Google
      const googleResult: GoogleDirectionsResult = {
        polyline: osrmResult.polyline,
        distancia_total_metros: osrmResult.distancia_total_metros,
        duracao_total_segundos: osrmResult.duracao_total_segundos,
        is_estimated: osrmResult.is_estimated === true,
        ordem_otimizada: [], // Vazio porque não otimizou
        legs: osrmResult.legs.map((leg) => ({
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
};
