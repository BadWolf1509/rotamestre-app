/**
 * Google Maps Service - Shared Utilities
 *
 * Utilitários compartilhados entre google.ts (mobile) e google.web.ts (web).
 * Centraliza tipos e funções para evitar duplicação.
 *
 * @module google-shared
 */

import type { GoogleDirectionsLeg, GoogleDirectionsResult } from '../types/google-directions';

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
