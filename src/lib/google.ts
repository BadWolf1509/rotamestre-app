import { Platform } from 'react-native';

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
    console.error('Erro ao obter coordenadas:', error);
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
      console.error('Erro no autocomplete:', error);
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
      console.error('Erro ao obter detalhes do place:', error);
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
      console.error('Erro no geocoding:', error);
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
      console.error('Erro no reverse geocoding:', error);
      return null;
    }
  },

  // Calcular rota entre pontos
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
  async getDirectionsWithError(
    origin: Coordenadas,
    destination: Coordenadas,
    waypoints?: Coordenadas[],
    optimize: boolean = true
  ): Promise<RouteResult<GoogleDirectionsResult>> {
    try {
      let waypointsStr = '';
      if (waypoints && waypoints.length > 0) {
        waypointsStr = waypoints
          .map((wp) => `${wp.latitude},${wp.longitude}`)
          .join('|');
      }

      let data;

      // Timeout com AbortController
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      try {
        if (Platform.OS === 'web') {
          const waypointsParam = waypointsStr
            ? (optimize ? `optimize:true|${waypointsStr}` : waypointsStr)
            : undefined;

          const { data: edgeData, error } = await supabase.functions.invoke('google-directions', {
            body: {
              origin: `${origin.latitude},${origin.longitude}`,
              destination: `${destination.latitude},${destination.longitude}`,
              waypoints: waypointsParam,
              mode: 'driving',
            },
          });

          if (error) throw error;
          data = edgeData;
        } else {
          let waypointsParam = '';
          if (waypointsStr) {
            waypointsParam = optimize
              ? `&waypoints=optimize:true|${waypointsStr}`
              : `&waypoints=${waypointsStr}`;
          }

          const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}${waypointsParam}&key=${GOOGLE_MAPS_API_KEY}`;

          const response = await fetch(url, { signal: controller.signal });
          data = await response.json();
        }
      } finally {
        clearTimeout(timeoutId);
      }

      if (data.status === 'OK' && data.routes.length > 0) {
        const route = data.routes[0];
        const waypointOrder = data.routes[0].waypoint_order;

        const legs: GoogleDirectionsLeg[] = route.legs.map((leg: any) => ({
          distancia_metros: leg.distance.value,
          duracao_segundos: leg.duration.value,
          endereco_inicio: leg.start_address,
          endereco_fim: leg.end_address,
          coordenadas_inicio: {
            latitude: leg.start_location.lat,
            longitude: leg.start_location.lng,
          },
          coordenadas_fim: {
            latitude: leg.end_location.lat,
            longitude: leg.end_location.lng,
          },
        }));

        const distancia_total = route.legs.reduce(
          (acc: number, leg: any) => acc + leg.distance.value,
          0
        );
        const tempo_total = route.legs.reduce(
          (acc: number, leg: any) => acc + leg.duration.value,
          0
        );

        return success({
          polyline: route.overview_polyline.points,
          distancia_total_metros: distancia_total,
          duracao_total_segundos: tempo_total,
          ordem_otimizada: waypointOrder || [],
          legs,
        });
      }

      // API retornou erro
      const error = parseGoogleError(data.status, data.error_message);
      console.warn('[Google] ' + formatErrorForLog(error));
      return failure(error);
    } catch (err: any) {
      let error: RouteError;

      if (err?.name === 'AbortError') {
        error = parseGoogleError('TIMEOUT', 'Request aborted due to timeout');
      } else if (err instanceof TypeError || err?.message?.includes('fetch')) {
        error = createNetworkError(err);
      } else {
        error = parseGoogleError('UNKNOWN_ERROR', err?.message);
      }

      console.error('[Google] ' + formatErrorForLog(error));
      return failure(error);
    }
  },

  // Calcular rota segmento por segmento (garante ordem manual)
  // Útil quando API ignora optimize:false em rotas circulares
  // Faz N chamadas separadas (origem→p1, p1→p2, ..., pN→destino)
  async getDirectionsSequential(
    origin: Coordenadas,
    destination: Coordenadas,
    waypoints: Coordenadas[]
  ): Promise<GoogleDirectionsResult | null> {
    return this.getDirectionsSequentialWithError(origin, destination, waypoints)
      .then(result => result.success ? result.data! : null);
  },

  // Versão com erro detalhado para rota sequencial
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

        let data;

        // Criar AbortController para timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

        try {
          if (Platform.OS === 'web') {
            const { data: edgeData, error } = await supabase.functions.invoke('google-directions', {
              body: {
                origin: `${segmentOrigin.latitude},${segmentOrigin.longitude}`,
                destination: `${segmentDestination.latitude},${segmentDestination.longitude}`,
                mode: 'driving',
              },
            });

            if (error) throw error;
            data = edgeData;
          } else {
            const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${segmentOrigin.latitude},${segmentOrigin.longitude}&destination=${segmentDestination.latitude},${segmentDestination.longitude}&key=${GOOGLE_MAPS_API_KEY}`;

            const response = await fetch(url, { signal: controller.signal });
            data = await response.json();
          }
        } finally {
          clearTimeout(timeoutId);
        }

        if (data.status === 'OK' && data.routes.length > 0) {
          const route = data.routes[0];
          const leg = route.legs[0];

          totalDistanceMeters += leg.distance.value;
          totalDurationSeconds += leg.duration.value;

          allLegs.push({
            distancia_metros: leg.distance.value,
            duracao_segundos: leg.duration.value,
            endereco_inicio: leg.start_address,
            endereco_fim: leg.end_address,
            coordenadas_inicio: {
              latitude: leg.start_location.lat,
              longitude: leg.start_location.lng,
            },
            coordenadas_fim: {
              latitude: leg.end_location.lat,
              longitude: leg.end_location.lng,
            },
          });

          if (route.overview_polyline?.points) {
            polylineSegments.push(route.overview_polyline.points);
          }
        } else {
          // Log warning mas continua
          console.warn(`[Google] Segmento ${i + 1} falhou: ${data.status}`);
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

      console.error('[Google Sequential] ' + formatErrorForLog(error));
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
      console.error('Erro na matriz de distâncias:', error);
      return null;
    }
  },
};
