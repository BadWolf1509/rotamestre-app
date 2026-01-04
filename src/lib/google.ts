import { Platform } from 'react-native';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

import {
  RouteError,
  RouteResult,
  parseGoogleError,
  createNetworkError,
  success,
  failure,
  formatErrorForLog,
} from './routeErrors';
import { Coordenadas, EnderecoGeocodificado } from '../types/endereco';
import { GoogleDirectionsLeg, GoogleDirectionsResult } from '../types/google-directions';

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

/** Timeout para requisições em ms */
const REQUEST_TIMEOUT = 30000;

/** Field mask para Routes API - otimiza custos (Basic tier: $5 CPM vs $15 CPM) */
const ROUTES_API_FIELD_MASK = [
  'routes.duration',
  'routes.distanceMeters',
  'routes.polyline.encodedPolyline',
  'routes.legs.duration',
  'routes.legs.distanceMeters',
  'routes.legs.startLocation',
  'routes.legs.endLocation',
  'routes.legs.polyline.encodedPolyline',
  'routes.optimizedIntermediateWaypointIndex',
].join(',');

// ============================================================================
// ROUTES API TYPES & ADAPTER
// ============================================================================

/**
 * Interface para resposta da Routes API
 */
interface RoutesAPIResponse {
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

/**
 * Converte duração da Routes API ("1234s") para segundos
 */
function parseDuration(duration: string): number {
  if (!duration) return 0;
  return parseInt(duration.replace('s', ''), 10) || 0;
}

/**
 * Adapta resposta da Routes API para o formato interno GoogleDirectionsResult
 * Mantém compatibilidade com código existente
 */
function adaptRoutesAPIResponse(
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

/**
 * Constrói request body para Routes API
 */
function buildRoutesAPIRequest(
  origin: Coordenadas,
  destination: Coordenadas,
  waypoints?: Coordenadas[],
  optimize: boolean = true
): object {
  const request: Record<string, unknown> = {
    origin: {
      location: {
        latLng: {
          latitude: origin.latitude,
          longitude: origin.longitude,
        },
      },
    },
    destination: {
      location: {
        latLng: {
          latitude: destination.latitude,
          longitude: destination.longitude,
        },
      },
    },
    travelMode: 'DRIVE',
    routingPreference: 'TRAFFIC_AWARE',
    computeAlternativeRoutes: false,
    languageCode: 'pt-BR',
    units: 'METRIC',
  };

  if (waypoints && waypoints.length > 0) {
    request.intermediates = waypoints.map((wp) => ({
      location: {
        latLng: {
          latitude: wp.latitude,
          longitude: wp.longitude,
        },
      },
    }));

    // optimizeWaypointOrder habilita reordenação automática
    request.optimizeWaypointOrder = optimize;
  }

  return request;
}

/**
 * Mapeia erros da Routes API para status compatível com código existente
 */
function mapRoutesAPIError(error: RoutesAPIResponse['error']): string {
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
// POLYLINE UTILITIES
// ============================================================================

/**
 * Decodifica uma polyline encoded do Google para array de coordenadas.
 */
export function decodePolyline(encoded: string): Coordenadas[] {
  const points: Coordenadas[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({
      latitude: lat / 1e5,
      longitude: lng / 1e5,
    });
  }

  return points;
}

/**
 * Codifica um array de coordenadas em polyline encoded.
 */
export function encodePolyline(points: Coordenadas[]): string {
  let encoded = '';
  let prevLat = 0;
  let prevLng = 0;

  for (const point of points) {
    const lat = Math.round(point.latitude * 1e5);
    const lng = Math.round(point.longitude * 1e5);

    encoded += encodeNumber(lat - prevLat);
    encoded += encodeNumber(lng - prevLng);

    prevLat = lat;
    prevLng = lng;
  }

  return encoded;
}

function encodeNumber(num: number): string {
  let encoded = '';
  let value = num < 0 ? ~(num << 1) : num << 1;

  while (value >= 0x20) {
    encoded += String.fromCharCode((0x20 | (value & 0x1f)) + 63);
    value >>= 5;
  }

  encoded += String.fromCharCode(value + 63);
  return encoded;
}

/**
 * Combina múltiplas polylines em uma única polyline válida.
 */
export function mergePolylines(polylines: string[]): string {
  const allPoints: Coordenadas[] = [];

  for (const polyline of polylines) {
    if (!polyline) continue;

    const points = decodePolyline(polyline);

    if (allPoints.length > 0 && points.length > 0) {
      const lastPoint = allPoints[allPoints.length - 1];
      const firstPoint = points[0];

      const distance = Math.sqrt(
        Math.pow(lastPoint.latitude - firstPoint.latitude, 2) +
        Math.pow(lastPoint.longitude - firstPoint.longitude, 2)
      );

      if (distance < 0.0001) {
        points.shift();
      }
    }

    allPoints.push(...points);
  }

  return encodePolyline(allPoints);
}

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

export interface PlaceSuggestion {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

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
        return data.predictions.map((prediction: any) => ({
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
        const addressComponents = result.address_components || [];
        const getComponent = (type: string) =>
          addressComponents.find((c: any) => c.types.includes(type))?.long_name || '';

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
        const addressComponents = result.address_components;
        const getComponent = (type: string) =>
          addressComponents.find((c: any) => c.types.includes(type))?.long_name || '';

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

  // Calcular rota entre pontos usando Google Routes API
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

  // Versão com erro detalhado - usando Google Routes API
  // Migrado da Directions API (deprecada em 01/03/2025)
  async getDirectionsWithError(
    origin: Coordenadas,
    destination: Coordenadas,
    waypoints?: Coordenadas[],
    optimize: boolean = true
  ): Promise<RouteResult<GoogleDirectionsResult>> {
    try {
      let data: RoutesAPIResponse;

      // Timeout com AbortController
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      try {
        if (Platform.OS === 'web') {
          // Web: Usar Edge Function (evita CORS)
          const { data: edgeData, error } = await supabase.functions.invoke('google-directions', {
            body: {
              origin: { latitude: origin.latitude, longitude: origin.longitude },
              destination: { latitude: destination.latitude, longitude: destination.longitude },
              waypoints: waypoints || [],
              optimize,
            },
          });

          if (error) throw error;
          data = edgeData as RoutesAPIResponse;
        } else {
          // Mobile: Chamar Routes API diretamente
          const requestBody = buildRoutesAPIRequest(origin, destination, waypoints, optimize);

          const response = await fetch(
            'https://routes.googleapis.com/directions/v2:computeRoutes',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
                'X-Goog-FieldMask': ROUTES_API_FIELD_MASK,
              },
              body: JSON.stringify(requestBody),
              signal: controller.signal,
            }
          );

          data = await response.json() as RoutesAPIResponse;
        }
      } finally {
        clearTimeout(timeoutId);
      }

      // Verificar erros da Routes API
      if (data.error) {
        const errorStatus = mapRoutesAPIError(data.error);
        const error = parseGoogleError(errorStatus, data.error.message);
        logger.warn('[Routes API] ' + formatErrorForLog(error));
        return failure(error);
      }

      // Verificar se tem rotas
      if (!data.routes || data.routes.length === 0) {
        const error = parseGoogleError('ZERO_RESULTS', 'No routes found');
        logger.warn('[Routes API] ' + formatErrorForLog(error));
        return failure(error);
      }

      // Adaptar resposta para formato interno
      const result = adaptRoutesAPIResponse(data);
      return success(result);
    } catch (err: any) {
      let error: RouteError;

      if (err?.name === 'AbortError') {
        error = parseGoogleError('TIMEOUT', 'Request aborted due to timeout');
      } else if (err instanceof TypeError || err?.message?.includes('fetch')) {
        error = createNetworkError(err);
      } else {
        error = parseGoogleError('UNKNOWN_ERROR', err?.message);
      }

      logger.error('[Routes API] ' + formatErrorForLog(error));
      return failure(error);
    }
  },

  // Calcular rota segmento por segmento (garante ordem manual)
  // Útil quando API ignora optimize:false em rotas circulares
  // Faz N chamadas separadas (origem→p1, p1→p2, ..., pN→destino)
  // Migrado para Routes API
  async getDirectionsSequential(
    origin: Coordenadas,
    destination: Coordenadas,
    waypoints: Coordenadas[]
  ): Promise<GoogleDirectionsResult | null> {
    return this.getDirectionsSequentialWithError(origin, destination, waypoints)
      .then(result => result.success ? result.data! : null);
  },

  // Versão com erro detalhado para rota sequencial - usando Routes API
  async getDirectionsSequentialWithError(
    origin: Coordenadas,
    destination: Coordenadas,
    waypoints: Coordenadas[]
  ): Promise<RouteResult<GoogleDirectionsResult>> {
    try {
      const allPoints = [origin, ...waypoints, destination];

      let totalDistanceMeters = 0;
      let totalDurationSeconds = 0;
      const allLegs: GoogleDirectionsLeg[] = [];
      const polylineSegments: string[] = [];

      for (let i = 0; i < allPoints.length - 1; i++) {
        const segmentOrigin = allPoints[i];
        const segmentDestination = allPoints[i + 1];

        let data: RoutesAPIResponse;

        // Criar AbortController para timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

        try {
          if (Platform.OS === 'web') {
            // Web: Usar Edge Function
            const { data: edgeData, error } = await supabase.functions.invoke('google-directions', {
              body: {
                origin: { latitude: segmentOrigin.latitude, longitude: segmentOrigin.longitude },
                destination: { latitude: segmentDestination.latitude, longitude: segmentDestination.longitude },
                waypoints: [],
                optimize: false,
              },
            });

            if (error) throw error;
            data = edgeData as RoutesAPIResponse;
          } else {
            // Mobile: Routes API diretamente
            const requestBody = buildRoutesAPIRequest(segmentOrigin, segmentDestination, [], false);

            const response = await fetch(
              'https://routes.googleapis.com/directions/v2:computeRoutes',
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
                  'X-Goog-FieldMask': ROUTES_API_FIELD_MASK,
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal,
              }
            );

            data = await response.json() as RoutesAPIResponse;
          }
        } finally {
          clearTimeout(timeoutId);
        }

        // Processar resposta do segmento
        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const leg = route.legs[0];

          totalDistanceMeters += leg.distanceMeters || 0;
          totalDurationSeconds += parseDuration(leg.duration);

          allLegs.push({
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
            polylineSegments.push(route.polyline.encodedPolyline);
          }
        } else {
          // Log warning mas continua
          logger.warn(`[Routes API] Segmento ${i + 1} falhou: ${data.error?.status || 'NO_ROUTES'}`);
        }
      }

      // Usar mergePolylines para combinar corretamente
      const mergedPolyline = mergePolylines(polylineSegments);

      return success({
        polyline: mergedPolyline,
        distancia_total_metros: totalDistanceMeters,
        duracao_total_segundos: totalDurationSeconds,
        ordem_otimizada: [],
        legs: allLegs,
      });
    } catch (err: any) {
      let error: RouteError;

      if (err?.name === 'AbortError') {
        error = parseGoogleError('TIMEOUT', 'Request aborted due to timeout');
      } else if (err instanceof TypeError || err?.message?.includes('fetch')) {
        error = createNetworkError(err);
      } else {
        error = parseGoogleError('UNKNOWN_ERROR', err?.message);
      }

      logger.error('[Routes API Sequential] ' + formatErrorForLog(error));
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
      const matrix: any[] = [];

      origins.forEach((origin, i) => {
        const row = {
          origem: origin,
          destinos: destinations.map((destination, j) => {
            // Encontrar o elemento correspondente na resposta
            const element = data.find(
              (item: any) => item.originIndex === i && item.destinationIndex === j
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
