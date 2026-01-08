/* global google */

import {
  type RoutesAPIResponse,
  adaptRoutesAPIResponse,
  mapRoutesAPIError,
  parseDuration,
} from './google-shared';
import { logger } from './logger';
import { mergePolylines } from './polyline';
import {
  RouteError,
  RouteResult,
  parseGoogleError,
  createNetworkError,
  success,
  failure,
  formatErrorForLog,
} from './routeErrors';
import { supabase } from './supabase';
import { Coordenadas, EnderecoGeocodificado } from '../types/endereco';
import { GoogleDirectionsLeg, GoogleDirectionsResult } from '../types/google-directions';

// Re-export polyline utilities for backwards compatibility
export { decodePolyline, encodePolyline, mergePolylines } from './polyline';
// Re-export shared utilities for backwards compatibility
export { RoutesAPIResponse, adaptRoutesAPIResponse, mapRoutesAPIError, parseDuration } from './google-shared';

// Interface para sugestões (mesma do google.ts)
export interface PlaceSuggestion {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

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

              const addressComponents = result.address_components;
              const getComponent = (type: string) =>
                addressComponents.find((c: any) => c.types.includes(type))?.long_name || '';

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

  // Versão com erro detalhado - usando Edge Function (não depende da JS API)
  async getDirectionsWithError(
    origin: Coordenadas,
    destination: Coordenadas,
    waypoints?: Coordenadas[],
    optimize: boolean = true
  ): Promise<RouteResult<GoogleDirectionsResult>> {
    try {
      // Log dos parâmetros para debug
      logger.debug('[Google.web] Directions Request', {
        origin: { lat: origin.latitude, lng: origin.longitude },
        destination: { lat: destination.latitude, lng: destination.longitude },
        waypointsCount: waypoints?.length || 0,
        optimize,
      });

      // Usar Edge Function do Supabase (evita CORS e não depende da JS API)
      const { data, error: invokeError } = await supabase.functions.invoke('google-directions', {
        body: {
          origin: { latitude: origin.latitude, longitude: origin.longitude },
          destination: { latitude: destination.latitude, longitude: destination.longitude },
          waypoints: waypoints || [],
          optimize,
        },
      });

      // Melhor tratamento de erros da Edge Function
      if (invokeError) {
        logger.error('[Google.web] Directions Edge Function error', invokeError);
        // Tentar extrair dados do erro se disponível (para status 4xx)
        const errorContext = (invokeError as any)?.context;
        if (errorContext) {
          logger.error('[Google.web] Directions Error context', errorContext);
        }
        const error = createNetworkError(invokeError);
        return failure(error);
      }

      // Log da resposta para debug
      logger.debug('[Google.web] Directions Response', {
        hasRoutes: !!(data?.routes?.length),
        routesCount: data?.routes?.length || 0,
        hasError: !!data?.error,
      });

      const apiResponse = data as RoutesAPIResponse;

      // Verificar erros da Routes API
      if (apiResponse.error) {
        const errorStatus = mapRoutesAPIError(apiResponse.error);
        const error = parseGoogleError(errorStatus, apiResponse.error.message);
        logger.warn('[Google.web] Directions ' + formatErrorForLog(error));
        return failure(error);
      }

      // Verificar se tem rotas
      if (!apiResponse.routes || apiResponse.routes.length === 0) {
        const error = parseGoogleError('ZERO_RESULTS', 'No routes found');
        logger.warn('[Google.web] Directions ' + formatErrorForLog(error));
        return failure(error);
      }

      // Adaptar resposta para formato interno
      const result = adaptRoutesAPIResponse(apiResponse);
      return success(result);

    } catch (err: any) {
      // Tratar diferentes tipos de erro
      let error: RouteError;

      if (err?.name === 'AbortError') {
        error = parseGoogleError('TIMEOUT', 'Request aborted due to timeout');
      } else if (err instanceof TypeError || err?.message?.includes('fetch')) {
        error = createNetworkError(err);
      } else {
        error = parseGoogleError('UNKNOWN_ERROR', err?.message);
      }

      logger.error('[Google.web] Directions ' + formatErrorForLog(error));
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

  // Versão com erro detalhado - usando Edge Function (não depende da JS API)
  async getDirectionsSequentialWithError(
    origin: Coordenadas,
    destination: Coordenadas,
    waypoints: Coordenadas[]
  ): Promise<RouteResult<GoogleDirectionsResult>> {
    try {
      const allPoints = [origin, ...waypoints, destination];

      // Validar todas as coordenadas antes de fazer requisições
      for (let i = 0; i < allPoints.length; i++) {
        const point = allPoints[i];
        if (
          !point ||
          typeof point.latitude !== 'number' ||
          typeof point.longitude !== 'number' ||
          isNaN(point.latitude) ||
          isNaN(point.longitude)
        ) {
          const pointName = i === 0 ? 'origin' : i === allPoints.length - 1 ? 'destination' : `waypoint ${i}`;
          logger.error(`[Google.web] Sequential Invalid coordinates at ${pointName}`, point);
          const error = parseGoogleError('INVALID_REQUEST', `Invalid coordinates at ${pointName}`);
          return failure(error);
        }
      }

      let totalDistanceMeters = 0;
      let totalDurationSeconds = 0;
      const allLegs: GoogleDirectionsLeg[] = [];
      const polylineSegments: string[] = [];

      // Calcular cada segmento via Edge Function
      for (let i = 0; i < allPoints.length - 1; i++) {
        const segmentOrigin = allPoints[i];
        const segmentDestination = allPoints[i + 1];

        // Log debug para primeira execução
        if (i === 0) {
          logger.debug('[Google.web] Sequential First segment coords', {
            origin: { lat: segmentOrigin.latitude, lng: segmentOrigin.longitude },
            dest: { lat: segmentDestination.latitude, lng: segmentDestination.longitude },
          });
        }

        const { data, error: invokeError } = await supabase.functions.invoke('google-directions', {
          body: {
            origin: { latitude: segmentOrigin.latitude, longitude: segmentOrigin.longitude },
            destination: { latitude: segmentDestination.latitude, longitude: segmentDestination.longitude },
            waypoints: [],
            optimize: false,
          },
        });

        if (invokeError) {
          logger.warn(`[Google.web] Sequential Segment ${i + 1} Edge Function error`, invokeError);
          continue; // Continua com próximo segmento
        }

        const apiResponse = data as RoutesAPIResponse;

        // Processar resposta do segmento
        if (apiResponse.routes && apiResponse.routes.length > 0) {
          const route = apiResponse.routes[0];
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
          logger.warn(`[Google.web] Sequential Segment ${i + 1} failed: ${apiResponse.error?.status || 'NO_ROUTES'}`);
        }
      }

      // Usar mergePolylines para combinar corretamente as polylines
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

      logger.error('[Google.web] Sequential ' + formatErrorForLog(error));
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
        const matrix = data.rows.map((row: any, i: number) => ({
          origem: origins[i],
          destinos: row.elements.map((element: any, j: number) => ({
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
