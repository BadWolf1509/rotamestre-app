/**
 * Photon Geocoding Service
 *
 * Alternativa gratuita ao Google Places/Geocoding API.
 * Usa dados do OpenStreetMap via Photon API (by Komoot).
 *
 * Vantagens:
 * - 100% gratuito (vs ~$50-100/mês do Google)
 * - Retorna coordenadas diretamente (não precisa de getPlaceDetails)
 * - Dados OSM brasileiros já em português
 *
 * Limitações:
 * - Rate limit no servidor público (throttled se uso excessivo)
 * - Sem session tokens (não precisa - é gratuito!)
 * - Não suporta parâmetro lang=pt (mas dados BR já são em português)
 *
 * @see https://photon.komoot.io/
 * @see https://github.com/komoot/photon
 */

import { logger } from '@/lib/logger';

import type { PlaceSuggestion } from './google-shared';
import type { Coordenadas, EnderecoGeocodificado } from '../types/endereco';

// ============================================================================
// CONFIGURATION
// ============================================================================

const PHOTON_API_URL = 'https://photon.komoot.io';
const REQUEST_TIMEOUT = 8000; // 8 segundos
const DEFAULT_LIMIT = 5;

// Bounding box do Brasil para filtrar resultados
const BRAZIL_BBOX = {
  minLon: -73.9872,
  minLat: -33.7683,
  maxLon: -34.7299,
  maxLat: 5.2718,
};

// ============================================================================
// TYPES
// ============================================================================

/**
 * Feature do GeoJSON retornado pelo Photon
 */
interface PhotonFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
  properties: {
    osm_id: number;
    osm_type: string; // 'N' (node), 'W' (way), 'R' (relation)
    osm_key?: string;
    osm_value?: string;
    name?: string;
    housenumber?: string;
    street?: string;
    postcode?: string;
    city?: string;
    district?: string;
    county?: string;
    state?: string;
    country?: string;
    countrycode?: string;
    type?: string; // 'house', 'street', 'city', etc.
    extent?: [number, number, number, number]; // bbox
  };
}

/**
 * Resposta do Photon API
 */
interface PhotonResponse {
  type: 'FeatureCollection';
  features: PhotonFeature[];
}

/**
 * PlaceSuggestion estendida com coordenadas (Photon já retorna!)
 */
export interface PhotonPlaceSuggestion extends PlaceSuggestion {
  coordinates: Coordenadas;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Formata endereço a partir das propriedades do Photon
 */
function formatAddress(props: PhotonFeature['properties']): string {
  const parts: string[] = [];

  // Nome do lugar (se for estabelecimento)
  if (props.name && props.osm_key !== 'highway') {
    parts.push(props.name);
  }

  // Logradouro + número
  if (props.street) {
    const streetPart = props.housenumber
      ? `${props.street}, ${props.housenumber}`
      : props.street;
    parts.push(streetPart);
  } else if (props.name && props.osm_key === 'highway') {
    // É uma rua sem número
    parts.push(props.name);
  }

  // Bairro
  if (props.district) {
    parts.push(props.district);
  }

  // Cidade
  if (props.city) {
    parts.push(props.city);
  }

  // Estado
  if (props.state) {
    parts.push(props.state);
  }

  // País (se não for Brasil, incluir)
  if (props.country && props.countrycode !== 'BR') {
    parts.push(props.country);
  }

  return parts.join(', ') || 'Endereço desconhecido';
}

/**
 * Formata texto principal (primeira linha do endereço)
 */
function formatMainText(props: PhotonFeature['properties']): string {
  // Se tem nome de estabelecimento
  if (props.name && props.osm_key !== 'highway') {
    return props.name;
  }

  // Se tem rua + número
  if (props.street) {
    return props.housenumber
      ? `${props.street}, ${props.housenumber}`
      : props.street;
  }

  // Se é uma rua
  if (props.name && props.osm_key === 'highway') {
    return props.name;
  }

  // Fallback para cidade ou bairro
  return props.district || props.city || 'Local';
}

/**
 * Formata texto secundário (cidade, estado)
 */
function formatSecondaryText(props: PhotonFeature['properties']): string {
  const parts: string[] = [];

  if (props.district && props.city) {
    parts.push(props.district);
  }

  if (props.city) {
    parts.push(props.city);
  }

  if (props.state) {
    parts.push(props.state);
  }

  return parts.join(', ') || '';
}

/**
 * Converte PhotonFeature para PlaceSuggestion (compatível com Google)
 */
function featureToSuggestion(feature: PhotonFeature): PhotonPlaceSuggestion {
  const props = feature.properties;
  const [longitude, latitude] = feature.geometry.coordinates;

  return {
    place_id: `osm_${props.osm_type}${props.osm_id}`,
    description: formatAddress(props),
    structured_formatting: {
      main_text: formatMainText(props),
      secondary_text: formatSecondaryText(props),
    },
    coordinates: {
      latitude,
      longitude,
    },
  };
}

/**
 * Converte PhotonFeature para EnderecoGeocodificado
 */
function featureToEndereco(feature: PhotonFeature): EnderecoGeocodificado {
  const props = feature.properties;
  const [longitude, latitude] = feature.geometry.coordinates;

  return {
    logradouro: props.street || props.name || '',
    numero: props.housenumber || '',
    bairro: props.district || '',
    cidade: props.city || '',
    estado: props.state || '',
    cep: props.postcode || '',
    coordenadas: {
      latitude,
      longitude,
    },
    formatted_address: formatAddress(props),
  };
}

/**
 * Faz request com timeout
 */
async function fetchWithTimeout(
  url: string,
  timeout: number = REQUEST_TIMEOUT
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'RotaMestre/1.0 (https://app.rotamestre.tec.br)',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Serviço de geocodificação usando Photon API.
 * Interface compatível com googleMapsService para facilitar migração.
 */
export const photonService = {
  /**
   * Autocomplete de endereços (busca enquanto digita)
   *
   * Diferente do Google:
   * - Não precisa de sessionToken (é gratuito!)
   * - Retorna coordenadas diretamente (não precisa de getPlaceDetails)
   *
   * @param input - Texto digitado pelo usuário
   * @param locationBias - Coordenadas para priorizar resultados próximos
   * @returns Lista de sugestões com coordenadas incluídas
   */
  async autocompleteAddress(
    input: string,
    locationBias?: Coordenadas
  ): Promise<PhotonPlaceSuggestion[]> {
    if (input.length < 3) {
      return [];
    }

    try {
      // Construir URL com parâmetros
      const params = new URLSearchParams({
        q: input,
        limit: String(DEFAULT_LIMIT),
      });

      // Adicionar location bias se fornecido (melhora relevância)
      if (locationBias) {
        params.append('lat', String(locationBias.latitude));
        params.append('lon', String(locationBias.longitude));
      }

      // Filtrar apenas Brasil usando bounding box
      params.append('bbox', `${BRAZIL_BBOX.minLon},${BRAZIL_BBOX.minLat},${BRAZIL_BBOX.maxLon},${BRAZIL_BBOX.maxLat}`);

      const url = `${PHOTON_API_URL}/api/?${params.toString()}`;
      const response = await fetchWithTimeout(url);

      if (!response.ok) {
        logger.warn('[Photon] API returned non-OK status', { status: response.status });
        return [];
      }

      const data: PhotonResponse = await response.json();

      // Filtrar apenas resultados do Brasil
      const brazilFeatures = data.features.filter(
        (f) => f.properties.countrycode === 'BR'
      );

      return brazilFeatures.map(featureToSuggestion);
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        logger.warn('[Photon] Request timeout');
      } else {
        logger.error('[Photon] Erro no autocomplete', error);
      }
      return [];
    }
  },

  /**
   * Obtém detalhes de um lugar pelo place_id
   *
   * NOTA: Com Photon, isso geralmente não é necessário porque
   * autocompleteAddress já retorna coordenadas. Este método existe
   * para compatibilidade com código que usa o fluxo Google.
   *
   * @param placeId - ID no formato "osm_N12345" ou "osm_W12345"
   * @returns Endereço geocodificado ou null
   */
  async getPlaceDetails(_placeId: string): Promise<EnderecoGeocodificado | null> {
    // Photon não tem endpoint de place details
    // Se precisar, usar geocodeAddress com o endereço
    logger.warn('[Photon] getPlaceDetails não suportado - use coordenadas do autocomplete');
    return null;
  },

  /**
   * Geocodificar endereço (texto → coordenadas)
   *
   * @param endereco - Endereço em texto livre
   * @returns Endereço geocodificado com coordenadas
   */
  async geocodeAddress(endereco: string): Promise<EnderecoGeocodificado | null> {
    if (!endereco || endereco.length < 3) {
      return null;
    }

    try {
      const params = new URLSearchParams({
        q: endereco,
        limit: '1',
        bbox: `${BRAZIL_BBOX.minLon},${BRAZIL_BBOX.minLat},${BRAZIL_BBOX.maxLon},${BRAZIL_BBOX.maxLat}`,
      });

      const url = `${PHOTON_API_URL}/api/?${params.toString()}`;
      const response = await fetchWithTimeout(url);

      if (!response.ok) {
        logger.warn('[Photon] Geocoding API returned non-OK status', { status: response.status });
        return null;
      }

      const data: PhotonResponse = await response.json();

      // Pegar primeiro resultado do Brasil
      const feature = data.features.find((f) => f.properties.countrycode === 'BR');

      if (!feature) {
        logger.warn('[Photon] Nenhum resultado encontrado para', { endereco });
        return null;
      }

      return featureToEndereco(feature);
    } catch (error) {
      logger.error('[Photon] Erro no geocoding', error);
      return null;
    }
  },

  /**
   * Geocodificação reversa (coordenadas → endereço)
   *
   * @param coords - Coordenadas (latitude, longitude)
   * @returns Endereço formatado ou null
   */
  async reverseGeocode(coords: Coordenadas): Promise<string | null> {
    try {
      const params = new URLSearchParams({
        lat: String(coords.latitude),
        lon: String(coords.longitude),
      });

      const url = `${PHOTON_API_URL}/reverse?${params.toString()}`;
      const response = await fetchWithTimeout(url);

      if (!response.ok) {
        logger.warn('[Photon] Reverse geocoding API returned non-OK status', { status: response.status });
        return null;
      }

      const data: PhotonResponse = await response.json();

      if (!data.features || data.features.length === 0) {
        logger.warn('[Photon] Nenhum resultado para reverse geocoding', coords);
        return null;
      }

      return formatAddress(data.features[0].properties);
    } catch (error) {
      logger.error('[Photon] Erro no reverse geocoding', error);
      return null;
    }
  },

  /**
   * Obtém coordenadas simples de um endereço
   * (wrapper simplificado de geocodeAddress)
   *
   * @param endereco - Endereço em texto
   * @returns Coordenadas ou null
   */
  async getCoordinates(endereco: string): Promise<Coordenadas | null> {
    const result = await this.geocodeAddress(endereco);
    return result?.coordenadas || null;
  },

  /**
   * Geocodificação reversa retornando EnderecoGeocodificado completo
   *
   * @param coords - Coordenadas (latitude, longitude)
   * @returns Endereço geocodificado completo ou null
   */
  async reverseGeocodeDetailed(coords: Coordenadas): Promise<EnderecoGeocodificado | null> {
    try {
      const params = new URLSearchParams({
        lat: String(coords.latitude),
        lon: String(coords.longitude),
      });

      const url = `${PHOTON_API_URL}/reverse?${params.toString()}`;
      const response = await fetchWithTimeout(url);

      if (!response.ok) {
        return null;
      }

      const data: PhotonResponse = await response.json();

      if (!data.features || data.features.length === 0) {
        return null;
      }

      return featureToEndereco(data.features[0]);
    } catch (error) {
      logger.error('[Photon] Erro no reverse geocoding detalhado', error);
      return null;
    }
  },
};

// Export tipos úteis
export type { PhotonFeature, PhotonResponse };
