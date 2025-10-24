import { Coordenadas, Endereco, EnderecoGeocodificado } from '../types/endereco';

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

// Variável para cache do AutocompleteService
let autocompleteService: google.maps.places.AutocompleteService | null = null;
let placesService: google.maps.places.PlacesService | null = null;

export const googleMapsService = {
  // Autocomplete usando Google Maps JavaScript API (funciona no browser)
  async autocompleteAddress(input: string, sessionToken?: string): Promise<PlaceSuggestion[]> {
    if (input.length < 3) {
      return [];
    }

    try {
      await loadGoogleMapsAPI();

      // Criar service se não existe
      if (!autocompleteService) {
        autocompleteService = new google.maps.places.AutocompleteService();
      }

      return new Promise((resolve, reject) => {
        autocompleteService!.getPlacePredictions(
          {
            input,
            componentRestrictions: { country: 'br' },
            language: 'pt-BR',
          },
          (predictions, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
              const suggestions: PlaceSuggestion[] = predictions.map((prediction) => ({
                place_id: prediction.place_id,
                description: prediction.description,
                structured_formatting: {
                  main_text: prediction.structured_formatting.main_text,
                  secondary_text: prediction.structured_formatting.secondary_text || '',
                },
              }));
              resolve(suggestions);
            } else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
              resolve([]);
            } else {
              console.error('Autocomplete error:', status);
              resolve([]);
            }
          }
        );
      });
    } catch (error) {
      console.error('Erro no autocomplete:', error);
      return [];
    }
  },

  // Obter detalhes usando Google Maps JavaScript API
  async getPlaceDetails(placeId: string, sessionToken?: string): Promise<EnderecoGeocodificado | null> {
    try {
      await loadGoogleMapsAPI();

      // Criar service se não existe (precisa de um elemento DIV)
      if (!placesService) {
        const div = document.createElement('div');
        placesService = new google.maps.places.PlacesService(div);
      }

      return new Promise((resolve, reject) => {
        placesService!.getDetails(
          {
            placeId,
            fields: ['address_components', 'formatted_address', 'geometry'],
            language: 'pt-BR',
          },
          (place, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && place) {
              const addressComponents = place.address_components || [];
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
                  latitude: place.geometry!.location!.lat(),
                  longitude: place.geometry!.location!.lng(),
                },
                formatted_address: place.formatted_address || '',
              });
            } else {
              console.error('Place details error:', status);
              resolve(null);
            }
          }
        );
      });
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

  // Calcular rota entre pontos (continua usando Directions API via HTTP - funciona)
  async getDirections(
    origin: Coordenadas,
    destination: Coordenadas,
    waypoints?: Coordenadas[]
  ) {
    try {
      let waypointsParam = '';
      if (waypoints && waypoints.length > 0) {
        const waypointsStr = waypoints
          .map((wp) => `${wp.latitude},${wp.longitude}`)
          .join('|');
        waypointsParam = `&waypoints=optimize:true|${waypointsStr}`;
      }

      const response = await fetch(
        `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}${waypointsParam}&key=${GOOGLE_MAPS_API_KEY}`
      );

      const data = await response.json();

      if (data.status === 'OK' && data.routes.length > 0) {
        const route = data.routes[0];
        return {
          polyline: route.overview_polyline.points,
          distancia: route.legs.reduce((acc: number, leg: any) => acc + leg.distance.value, 0),
          tempo: route.legs.reduce((acc: number, leg: any) => acc + leg.duration.value, 0),
          ordem_otimizada: data.routes[0].waypoint_order || [],
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
