/* global google */

import { Coordenadas, EnderecoGeocodificado } from '../types/endereco';
import { GoogleDirectionsLeg, GoogleDirectionsResult } from '../types/google-directions';

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

// Interface para sugestões (mesma do google.ts)
export interface PlaceSuggestion {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

// Carregar Google Maps JavaScript API
let googleMapsLoaded = false;
let loadingPromise: Promise<void> | null = null;

async function loadGoogleMapsAPI(): Promise<void> {
  if (googleMapsLoaded) return;

  if (loadingPromise) {
    await loadingPromise;
    return;
  }

  loadingPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Window not available'));
      return;
    }

    // Check if already loaded
    if (window.google && window.google.maps && window.google.maps.places) {
      googleMapsLoaded = true;
      resolve();
      return;
    }

    // Load script
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&language=pt-BR`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      googleMapsLoaded = true;
      resolve();
    };
    script.onerror = () => {
      reject(new Error('Failed to load Google Maps API'));
    };
    document.head.appendChild(script);
  });

  await loadingPromise;
}

export const googleMapsService = {
  // Autocomplete usando NOVA API Place (google.maps.places.AutocompleteSuggestion)
  async autocompleteAddress(input: string): Promise<PlaceSuggestion[]> {
    if (input.length < 3) {
      return [];
    }

    try {
      await loadGoogleMapsAPI();

      // Importar a nova API Place
      const { AutocompleteSuggestion } = await google.maps.importLibrary('places') as any;

      // Chamar a nova API fetchAutocompleteSuggestions
      const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input,
        includedRegionCodes: ['br'], // Substituiu componentRestrictions
        language: 'pt-BR',
      });

      // Transformar para o formato esperado
      const mappedSuggestions: PlaceSuggestion[] = suggestions.map((suggestion: any) => {
        const prediction = suggestion.placePrediction;
        return {
          place_id: prediction.placeId,
          // Compor description a partir de mainText e secondaryText (API nova não tem description)
          description: `${prediction.mainText.text}, ${prediction.secondaryText?.text || ''}`.trim(),
          structured_formatting: {
            main_text: prediction.mainText.text,
            secondary_text: prediction.secondaryText?.text || '',
          },
        };
      });

      return mappedSuggestions;
    } catch (error) {
      console.error('Erro no autocomplete:', error);
      return [];
    }
  },

  // Obter detalhes usando NOVA API Place (google.maps.places.Place.fetchFields)
  async getPlaceDetails(placeId: string): Promise<EnderecoGeocodificado | null> {
    try {
      await loadGoogleMapsAPI();

      // Importar a nova API Place
      const { Place } = await google.maps.importLibrary('places') as any;

      // Criar instância do Place
      const place = new Place({ id: placeId });

      // Fetch fields usando a nova API (retorna Promise, não callback!)
      await place.fetchFields({
        fields: ['addressComponents', 'formattedAddress', 'location'],
      });

      // Processar address components
      const addressComponents = place.addressComponents || [];
      const getComponent = (type: string) => {
        const component = addressComponents.find((c: any) => c.types.includes(type));
        return component?.longText || '';
      };

      return {
        logradouro: getComponent('route'),
        numero: getComponent('street_number'),
        bairro: getComponent('sublocality') || getComponent('neighborhood'),
        cidade: getComponent('locality') || getComponent('administrative_area_level_2'),
        estado: getComponent('administrative_area_level_1'),
        cep: getComponent('postal_code'),
        coordenadas: {
          latitude: place.location.lat(),
          longitude: place.location.lng(),
        },
        formatted_address: place.formattedAddress || '',
      };
    } catch (error) {
      console.error('Erro ao obter detalhes do place:', error);
      return null;
    }
  },

  // Geocodificar endereço (endereço -> coordenadas)
  async geocodeAddress(endereco: string): Promise<EnderecoGeocodificado | null> {
    try {
      await loadGoogleMapsAPI();

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
              console.error('Geocoding error:', status);
              resolve(null);
            }
          }
        );
      });
    } catch (error) {
      console.error('Erro no geocoding:', error);
      return null;
    }
  },

  // Geocodificar reverso (coordenadas -> endereço)
  async reverseGeocode(coords: Coordenadas): Promise<string | null> {
    try {
      await loadGoogleMapsAPI();

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
              console.error('Reverse geocoding error:', status);
              resolve(null);
            }
          }
        );
      });
    } catch (error) {
      console.error('Erro no reverse geocoding:', error);
      return null;
    }
  },

  // Calcular rota entre pontos usando Google Maps JavaScript API (resolve CORS)
  async getDirections(
    origin: Coordenadas,
    destination: Coordenadas,
    waypoints?: Coordenadas[]
  ): Promise<GoogleDirectionsResult | null> {
    try {
      // Carregar API do Google Maps se necessário
      await loadGoogleMapsAPI();

      // Verificar se google.maps está disponível
      if (typeof window === 'undefined' || !window.google?.maps) {
        throw new Error('Google Maps API não está carregada');
      }

      // Criar DirectionsService
      const directionsService = new google.maps.DirectionsService();

      // Preparar waypoints com otimização
      const waypointsFormatted: google.maps.DirectionsWaypoint[] = waypoints
        ? waypoints.map((wp) => ({
            location: new google.maps.LatLng(wp.latitude, wp.longitude),
            stopover: true,
          }))
        : [];

      // Configurar requisição
      const request: google.maps.DirectionsRequest = {
        origin: new google.maps.LatLng(origin.latitude, origin.longitude),
        destination: new google.maps.LatLng(destination.latitude, destination.longitude),
        waypoints: waypointsFormatted,
        optimizeWaypoints: true, // Otimizar ordem dos waypoints
        travelMode: google.maps.TravelMode.DRIVING,
      };

      // Fazer requisição usando promise
      const result = await new Promise<google.maps.DirectionsResult>((resolve, reject) => {
        directionsService.route(request, (result, status) => {
          if (status === google.maps.DirectionsStatus.OK && result) {
            resolve(result);
          } else {
            reject(new Error(`Directions request failed: ${status}`));
          }
        });
      });

      // Processar resultado
      if (result.routes && result.routes.length > 0) {
        const route = result.routes[0];

        const legs: GoogleDirectionsLeg[] = route.legs.map((leg) => ({
          distancia_metros: leg.distance?.value || 0,
          duracao_segundos: leg.duration?.value || 0,
          endereco_inicio: leg.start_address || '',
          endereco_fim: leg.end_address || '',
          coordenadas_inicio: {
            latitude: leg.start_location?.lat() || 0,
            longitude: leg.start_location?.lng() || 0,
          },
          coordenadas_fim: {
            latitude: leg.end_location?.lat() || 0,
            longitude: leg.end_location?.lng() || 0,
          },
        }));

        const distanciaTotal = legs.reduce((acc, leg) => acc + leg.distancia_metros, 0);
        const tempoTotal = legs.reduce((acc, leg) => acc + leg.duracao_segundos, 0);

        const encodedPolyline =
          route.overview_polyline?.encodedPath ||
          (route.overview_polyline as any)?.points ||
          '';

        return {
          polyline: encodedPolyline,
          distancia_total_metros: distanciaTotal,
          duracao_total_segundos: tempoTotal,
          ordem_otimizada: route.waypoint_order || [],
          legs,
        };
      }

      return null;
    } catch (error) {
      console.error('Erro ao calcular rota:', error);
      return null;
    }
  },

  // Calcular matriz de distâncias
  async getDistanceMatrix(origins: Coordenadas[], destinations: Coordenadas[]) {
    try {
      const originsStr = origins.map((o) => `${o.latitude},${o.longitude}`).join('|');
      const destinationsStr = destinations
        .map((d) => `${d.latitude},${d.longitude}`)
        .join('|');

      const response = await fetch(
        `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originsStr}&destinations=${destinationsStr}&key=${GOOGLE_MAPS_API_KEY}`
      );

      const data = await response.json();

      if (data.status === 'OK') {
        return data.rows.map((row: any, i: number) => ({
          origem: origins[i],
          destinos: row.elements.map((element: any, j: number) => ({
            destino: destinations[j],
            distancia: element.distance?.value || 0,
            tempo: element.duration?.value || 0,
          })),
        }));
      }

      return null;
    } catch (error) {
      console.error('Erro na matriz de distâncias:', error);
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
