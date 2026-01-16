/**
 * Google Maps Service - Shared Utilities
 *
 * Utilitários compartilhados entre google.ts (mobile) e google.web.ts (web).
 * Centraliza tipos e funções para evitar duplicação.
 *
 * @module google-shared
 */

import {
  RouteError,
  RouteResult,
  parseGoogleError,
  createNetworkError,
  success,
  failure,
} from './routeErrors';

import type { GoogleDirectionsLeg, GoogleDirectionsResult } from '../types/google-directions';

// ============================================================================
// SHARED INTERFACES
// ============================================================================

/**
 * Interface para sugestões de endereço do Google Places Autocomplete.
 * Compartilhada entre google.ts e google.web.ts.
 */
export interface PlaceSuggestion {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

/**
 * Interface para componente de endereço do Google Maps.
 * Usado em Place Details e Geocoding responses.
 */
export interface GoogleAddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

/**
 * Interface para prediction do Google Places Autocomplete.
 * Resposta raw da API antes de ser mapeada para PlaceSuggestion.
 */
export interface GoogleAutocompletePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text?: string;
  };
}

/**
 * Interface para elemento da Distance Matrix.
 */
export interface DistanceMatrixElement {
  status: string;
  distance?: { value: number; text: string };
  duration?: { value: number; text: string };
  duration_in_traffic?: { value: number; text: string };
}

/**
 * Interface para linha da Distance Matrix.
 */
export interface DistanceMatrixRow {
  elements: DistanceMatrixElement[];
}

/**
 * Interface para item do Compute Route Matrix (Routes API).
 */
export interface RouteMatrixElement {
  originIndex: number;
  destinationIndex: number;
  distanceMeters?: number;
  duration?: string;
  status?: string;
  condition?: string;
}

// ============================================================================
// ROUTES API TYPES
// ============================================================================

/**
 * Interface para resposta da Routes API
 */
export interface RoutesAPIResponse {
  routes: Array<{
    duration: string; // "1234s"
    distanceMeters: number;
    polyline: {
      encodedPolyline: string;
    };
    legs: Array<{
      duration: string;
      distanceMeters: number;
      startLocation: {
        latLng: { latitude: number; longitude: number };
      };
      endLocation: {
        latLng: { latitude: number; longitude: number };
      };
      polyline?: {
        encodedPolyline: string;
      };
    }>;
    optimizedIntermediateWaypointIndex?: number[];
  }>;
  error?: {
    code: number;
    message: string;
    status: string;
  };
}

// ============================================================================
// ADAPTER FUNCTIONS
// ============================================================================

/**
 * Converte duração da Routes API ("1234s") para segundos.
 *
 * @param duration - String no formato "1234s"
 * @returns Número de segundos
 */
export function parseDuration(duration: string): number {
  if (!duration) return 0;
  return parseInt(duration.replace('s', ''), 10) || 0;
}

/**
 * Adapta resposta da Routes API para o formato interno GoogleDirectionsResult.
 * Mantém compatibilidade com código existente.
 *
 * @param apiResponse - Resposta da Routes API
 * @param storedAddresses - Endereços armazenados para usar no lugar de coordenadas
 * @returns Resultado formatado
 */
export function adaptRoutesAPIResponse(
  apiResponse: RoutesAPIResponse,
  storedAddresses?: { start?: string; end?: string; waypoints?: string[] }
): GoogleDirectionsResult {
  const route = apiResponse.routes?.[0];

  if (!route) {
    throw new Error('No routes found in response');
  }

  const legs: GoogleDirectionsLeg[] = route.legs.map((leg, index) => ({
    distancia_metros: leg.distanceMeters || 0,
    duracao_segundos: parseDuration(leg.duration),
    // Routes API não retorna endereços formatados - usar dados armazenados ou coordenadas
    endereco_inicio: storedAddresses?.waypoints?.[index] ||
      `${leg.startLocation.latLng.latitude.toFixed(6)}, ${leg.startLocation.latLng.longitude.toFixed(6)}`,
    endereco_fim: storedAddresses?.waypoints?.[index + 1] ||
      `${leg.endLocation.latLng.latitude.toFixed(6)}, ${leg.endLocation.latLng.longitude.toFixed(6)}`,
    coordenadas_inicio: {
      latitude: leg.startLocation.latLng.latitude,
      longitude: leg.startLocation.latLng.longitude,
    },
    coordenadas_fim: {
      latitude: leg.endLocation.latLng.latitude,
      longitude: leg.endLocation.latLng.longitude,
    },
  }));

  return {
    polyline: route.polyline.encodedPolyline,
    distancia_total_metros: route.distanceMeters,
    duracao_total_segundos: parseDuration(route.duration),
    ordem_otimizada: route.optimizedIntermediateWaypointIndex || [],
    legs,
  };
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Mapeia erros da Routes API para status compatível com código existente.
 *
 * @param error - Objeto de erro da Routes API
 * @returns String de status normalizada
 */
export function mapRoutesAPIError(error: RoutesAPIResponse['error']): string {
  if (!error) return 'UNKNOWN_ERROR';

  const statusMap: Record<string, string> = {
    'INVALID_ARGUMENT': 'INVALID_REQUEST',
    'NOT_FOUND': 'NOT_FOUND',
    'PERMISSION_DENIED': 'REQUEST_DENIED',
    'RESOURCE_EXHAUSTED': 'OVER_QUERY_LIMIT',
    'UNAVAILABLE': 'UNKNOWN_ERROR',
  };

  return statusMap[error.status] || error.status || 'UNKNOWN_ERROR';
}

// ============================================================================
// SHARED HELPER FUNCTIONS
// ============================================================================

/**
 * Acumuladores para processamento de rotas sequenciais.
 * Usados por processDirectionsSegment e finalizeSequentialDirections.
 */
export interface DirectionsAccumulators {
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  legs: GoogleDirectionsLeg[];
  polylineSegments: string[];
}

/**
 * Cria acumuladores iniciais para processamento de rotas sequenciais.
 */
export function createAccumulators(): DirectionsAccumulators {
  return {
    totalDistanceMeters: 0,
    totalDurationSeconds: 0,
    legs: [],
    polylineSegments: [],
  };
}

/**
 * Processa um segmento de rota e acumula nos totais.
 * Usado por getDirectionsSequentialWithError em google.ts e google.web.ts.
 *
 * @param apiResponse - Resposta da Routes API para o segmento
 * @param accumulators - Objeto de acumuladores para atualizar
 * @returns true se o segmento foi processado com sucesso
 */
export function processDirectionsSegment(
  apiResponse: RoutesAPIResponse,
  accumulators: DirectionsAccumulators
): boolean {
  if (!apiResponse.routes || apiResponse.routes.length === 0) {
    return false;
  }

  const route = apiResponse.routes[0];
  const leg = route.legs[0];

  accumulators.totalDistanceMeters += leg.distanceMeters || 0;
  accumulators.totalDurationSeconds += parseDuration(leg.duration);

  accumulators.legs.push({
    distancia_metros: leg.distanceMeters || 0,
    duracao_segundos: parseDuration(leg.duration),
    endereco_inicio: `${leg.startLocation.latLng.latitude.toFixed(6)}, ${leg.startLocation.latLng.longitude.toFixed(6)}`,
    endereco_fim: `${leg.endLocation.latLng.latitude.toFixed(6)}, ${leg.endLocation.latLng.longitude.toFixed(6)}`,
    coordenadas_inicio: {
      latitude: leg.startLocation.latLng.latitude,
      longitude: leg.startLocation.latLng.longitude,
    },
    coordenadas_fim: {
      latitude: leg.endLocation.latLng.latitude,
      longitude: leg.endLocation.latLng.longitude,
    },
  });

  if (route.polyline?.encodedPolyline) {
    accumulators.polylineSegments.push(route.polyline.encodedPolyline);
  }

  return true;
}

/**
 * Trata erros de requisição e retorna RouteError apropriado.
 * Centraliza o padrão de tratamento de erros usado em google.ts e google.web.ts.
 *
 * @param err - Erro capturado
 * @returns RouteError formatado
 */
export function handleDirectionsError(err: unknown): RouteError {
  const error = err as { name?: string; message?: string };

  if (error?.name === 'AbortError') {
    return parseGoogleError('TIMEOUT', 'Request aborted due to timeout');
  }

  if (err instanceof TypeError || error?.message?.includes('fetch')) {
    return createNetworkError(err instanceof Error ? err : undefined);
  }

  return parseGoogleError('UNKNOWN_ERROR', error?.message);
}

/**
 * Valida resposta da Routes API e retorna RouteResult.
 * Usado por getDirectionsWithError em ambos os arquivos.
 *
 * @param apiResponse - Resposta da Routes API
 * @returns RouteResult com sucesso ou falha
 */
export function validateAndAdaptRoutesResponse(
  apiResponse: RoutesAPIResponse
): RouteResult<GoogleDirectionsResult> {
  // Verificar erros da Routes API
  if (apiResponse.error) {
    const errorStatus = mapRoutesAPIError(apiResponse.error);
    const error = parseGoogleError(errorStatus, apiResponse.error.message);
    return failure(error);
  }

  // Verificar se tem rotas
  if (!apiResponse.routes || apiResponse.routes.length === 0) {
    const error = parseGoogleError('ZERO_RESULTS', 'No routes found');
    return failure(error);
  }

  // Adaptar resposta para formato interno
  const result = adaptRoutesAPIResponse(apiResponse);
  return success(result);
}

// Re-export routeErrors utilities for convenience
export type { RouteError, RouteResult };
export { parseGoogleError, createNetworkError, success, failure };
