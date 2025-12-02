import { Coordenadas, EnderecoGeocodificado } from '../types/endereco';
import { GoogleDirectionsLeg, GoogleDirectionsResult } from '../types/google-directions';

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

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
    try {
      let waypointsParam = '';
      if (waypoints && waypoints.length > 0) {
        const waypointsStr = waypoints
          .map((wp) => `${wp.latitude},${wp.longitude}`)
          .join('|');
        // Usar optimize:true ou apenas listar os waypoints (ordem fornecida)
        // IMPORTANTE: Sem "optimize:true", a API usa a ordem fornecida
        waypointsParam = optimize
          ? `&waypoints=optimize:true|${waypointsStr}`
          : `&waypoints=${waypointsStr}`;
      }

      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}${waypointsParam}&key=${GOOGLE_MAPS_API_KEY}`;

      // Debug: Log completo da chamada
      console.log('🗺️ ========================================');
      console.log('🗺️ getDirections chamado:');
      console.log('🗺️   optimize:', optimize);
      console.log('🗺️   waypointsCount:', waypoints?.length || 0);
      console.log('🗺️   origin:', `${origin.latitude},${origin.longitude}`);
      console.log('🗺️   destination:', `${destination.latitude},${destination.longitude}`);
      console.log('🗺️   waypointsParam:', waypointsParam.includes('optimize:true') ? 'COM optimize:true' : 'SEM optimize (ordem fornecida)');
      // Log primeiras coordenadas para verificar ordem
      if (waypoints && waypoints.length > 0) {
        console.log('🗺️   Ordem dos waypoints:');
        waypoints.forEach((wp, i) => {
          console.log(`🗺️     ${i}: ${wp.latitude.toFixed(6)},${wp.longitude.toFixed(6)}`);
        });
      }
      console.log('🗺️ ========================================');

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.routes.length > 0) {
        const route = data.routes[0];

        // Debug: Verificar se a API reordenou (waypoint_order só existe se optimize:true)
        const waypointOrder = data.routes[0].waypoint_order;
        console.log('🗺️ ========================================');
        console.log('🗺️ Resposta da API:');
        console.log('🗺️   status:', data.status);
        console.log('🗺️   waypoint_order presente?:', waypointOrder ? 'SIM (API REORDENOU!)' : 'NÃO (ordem mantida)');
        if (waypointOrder) {
          console.log('🗺️   waypoint_order:', JSON.stringify(waypointOrder));
        }
        console.log('🗺️   legsCount:', route.legs.length);
        // Log endereços dos legs para verificar ordem real
        route.legs.forEach((leg: any, i: number) => {
          console.log(`🗺️   Leg ${i}: ${leg.start_address?.substring(0, 40)} → ${leg.end_address?.substring(0, 40)}`);
        });
        console.log('🗺️ ========================================');

        // Extrair informações de cada leg (segmento entre paradas consecutivas)
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

        // Calcular totais somando todos os legs
        const distancia_total = route.legs.reduce(
          (acc: number, leg: any) => acc + leg.distance.value,
          0
        );
        const tempo_total = route.legs.reduce(
          (acc: number, leg: any) => acc + leg.duration.value,
          0
        );

        console.log('🗺️ Resultado:', {
          distanciaKm: (distancia_total / 1000).toFixed(1),
          duracaoMin: Math.round(tempo_total / 60),
        });

        return {
          polyline: route.overview_polyline.points,
          distancia_total_metros: distancia_total,
          duracao_total_segundos: tempo_total,
          ordem_otimizada: waypointOrder || [],
          legs, // Array com detalhes de cada segmento
        };
      }

      console.warn('🗺️ API retornou status não-OK:', data.status, data.error_message);
      return null;
    } catch (error) {
      console.error('Erro ao calcular rota:', error);
      return null;
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
    try {
      console.log('🔄 getDirectionsSequential: Calculando rota segmento por segmento');
      console.log('🔄   Origin:', `${origin.latitude.toFixed(6)},${origin.longitude.toFixed(6)}`);
      console.log('🔄   Waypoints:', waypoints.length);
      console.log('🔄   Destination:', `${destination.latitude.toFixed(6)},${destination.longitude.toFixed(6)}`);

      // Montar lista de pontos na ordem: origin → waypoints → destination
      const allPoints = [origin, ...waypoints, destination];

      let totalDistanceMeters = 0;
      let totalDurationSeconds = 0;
      const allLegs: GoogleDirectionsLeg[] = [];
      let combinedPolyline = '';

      // Fazer chamada para cada par consecutivo de pontos
      for (let i = 0; i < allPoints.length - 1; i++) {
        const segmentOrigin = allPoints[i];
        const segmentDestination = allPoints[i + 1];

        console.log(`🔄   Segmento ${i + 1}/${allPoints.length - 1}: (${segmentOrigin.latitude.toFixed(4)},${segmentOrigin.longitude.toFixed(4)}) → (${segmentDestination.latitude.toFixed(4)},${segmentDestination.longitude.toFixed(4)})`);

        const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${segmentOrigin.latitude},${segmentOrigin.longitude}&destination=${segmentDestination.latitude},${segmentDestination.longitude}&key=${GOOGLE_MAPS_API_KEY}`;

        const response = await fetch(url);
        const data = await response.json();

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

          // Concatenar polylines (simplificado - para visualização precisa seria necessário decodificar/recodificar)
          if (combinedPolyline) {
            combinedPolyline += route.overview_polyline.points;
          } else {
            combinedPolyline = route.overview_polyline.points;
          }

          console.log(`🔄     ✓ ${(leg.distance.value / 1000).toFixed(1)} km, ${Math.round(leg.duration.value / 60)} min`);
        } else {
          console.warn(`🔄     ✗ Erro no segmento ${i + 1}: ${data.status}`);
          // Continuar com os outros segmentos mesmo se um falhar
        }
      }

      console.log('🔄 ========================================');
      console.log('🔄 Resultado SEQUENCIAL (ordem manual respeitada):');
      console.log(`🔄   Distância total: ${(totalDistanceMeters / 1000).toFixed(1)} km`);
      console.log(`🔄   Duração total: ${Math.round(totalDurationSeconds / 60)} min`);
      console.log(`🔄   Segmentos: ${allLegs.length}`);
      console.log('🔄 ========================================');

      return {
        polyline: combinedPolyline,
        distancia_total_metros: totalDistanceMeters,
        duracao_total_segundos: totalDurationSeconds,
        ordem_otimizada: [], // Vazio pois não houve otimização
        legs: allLegs,
      };
    } catch (error) {
      console.error('Erro ao calcular rota sequencial:', error);
      return null;
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
