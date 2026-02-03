/**
 * Google Places Autocomplete Service (via Supabase Edge Functions)
 *
 * Serviço para autocomplete de endereços usando Google Places API.
 * As requisições são feitas via Edge Functions do Supabase para evitar CORS.
 *
 * Custo: ~$2.83 por 1000 sessões (autocomplete + place details)
 * @see https://developers.google.com/maps/documentation/places/web-service/usage-and-billing
 */

import { CACHE_TTL, getCache, setCache } from '@/lib/cache';
import { logger } from '@/lib/logger';

import type { PlaceSuggestion } from './google-shared';
import type { Coordenadas, EnderecoGeocodificado } from '../types/endereco';

// ============================================================================
// CONFIGURATION
// ============================================================================

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const REQUEST_TIMEOUT = 10000; // 10 segundos (Edge Functions podem ser mais lentas)

// URLs das Edge Functions
const AUTOCOMPLETE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/google-places-autocomplete`;
const PLACE_DETAILS_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/google-place-details`;

// ============================================================================
// TYPES
// ============================================================================

interface EdgeFunctionAutocompleteResponse {
  status: string;
  predictions: Array<{
    place_id: string;
    description: string;
    structured_formatting: {
      main_text: string;
      secondary_text: string;
    };
  }>;
  error?: string;
}

interface EdgeFunctionPlaceDetailsResponse {
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  coordenadas: {
    latitude: number;
    longitude: number;
  };
  formatted_address: string;
  error?: string;
  status?: string;
}

/**
 * PlaceSuggestion estendida com coordenadas (requer chamada extra de Place Details)
 */
export interface GooglePlaceSuggestion extends PlaceSuggestion {
  coordinates?: Coordenadas;
  source: 'google';
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Faz request POST com timeout para Edge Functions
 */
async function fetchEdgeFunction<T>(
  url: string,
  body: Record<string, unknown>,
  timeout: number = REQUEST_TIMEOUT
): Promise<T | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      logger.warn('[GooglePlaces] Edge Function error', { status: response.status });
      return null;
    }

    return await response.json() as T;
  } catch (error) {
    clearTimeout(timeoutId);
    if ((error as Error).name === 'AbortError') {
      logger.warn('[GooglePlaces] Request timeout');
    } else {
      logger.error('[GooglePlaces] Fetch error', error);
    }
    return null;
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Serviço de autocomplete usando Google Places API via Supabase Edge Functions.
 * Evita problemas de CORS fazendo requisições através do backend.
 */
export const googlePlacesService = {
  /**
   * Verifica se o serviço está configurado e disponível
   */
  isAvailable(): boolean {
    return SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;
  },

  /**
   * Autocomplete de endereços usando Google Places via Edge Function
   *
   * @param input - Texto digitado pelo usuário
   * @param sessionToken - Token de sessão (opcional, para billing)
   * @returns Lista de sugestões
   */
  async autocompleteAddress(
    input: string,
    sessionToken?: string
  ): Promise<GooglePlaceSuggestion[]> {
    if (!this.isAvailable()) {
      logger.warn('[GooglePlaces] Supabase não configurado');
      return [];
    }

    if (input.length < 3) {
      return [];
    }

    // Cache key
    const normalizedInput = input.toLowerCase().trim();
    const cacheKey = `google_autocomplete_${normalizedInput}`;

    // Verificar cache
    const cached = await getCache<GooglePlaceSuggestion[]>(cacheKey);
    if (cached) {
      logger.info('[GooglePlaces] Cache hit', { input: normalizedInput });
      return cached;
    }

    try {
      const data = await fetchEdgeFunction<EdgeFunctionAutocompleteResponse>(
        AUTOCOMPLETE_FUNCTION_URL,
        { input, sessionToken }
      );

      if (!data) {
        return [];
      }

      if (data.error) {
        logger.warn('[GooglePlaces] API error', { error: data.error, status: data.status });
        return [];
      }

      const suggestions: GooglePlaceSuggestion[] = (data.predictions || []).map((p) => ({
        place_id: p.place_id,
        description: p.description,
        structured_formatting: {
          main_text: p.structured_formatting.main_text,
          secondary_text: p.structured_formatting.secondary_text || '',
        },
        source: 'google' as const,
      }));

      // Salvar no cache (5 minutos)
      if (suggestions.length > 0) {
        await setCache(cacheKey, suggestions, CACHE_TTL.AUTOCOMPLETE);
      }

      logger.info('[GooglePlaces] Autocomplete success', { count: suggestions.length });
      return suggestions;
    } catch (error) {
      logger.error('[GooglePlaces] Erro no autocomplete', error);
      return [];
    }
  },

  /**
   * Obtém detalhes de um lugar (incluindo coordenadas) via Edge Function
   *
   * @param placeId - ID do lugar do Google
   * @param sessionToken - Token de sessão (opcional, para billing)
   * @returns Endereço geocodificado ou null
   */
  async getPlaceDetails(
    placeId: string,
    sessionToken?: string
  ): Promise<EnderecoGeocodificado | null> {
    if (!this.isAvailable()) {
      logger.warn('[GooglePlaces] Supabase não configurado');
      return null;
    }

    // Cache key
    const cacheKey = `google_details_${placeId}`;

    // Verificar cache
    const cached = await getCache<EnderecoGeocodificado>(cacheKey);
    if (cached) {
      logger.info('[GooglePlaces] Cache hit for place details', { placeId });
      return cached;
    }

    try {
      const data = await fetchEdgeFunction<EdgeFunctionPlaceDetailsResponse>(
        PLACE_DETAILS_FUNCTION_URL,
        { placeId, sessionToken }
      );

      if (!data) {
        return null;
      }

      if (data.error) {
        logger.warn('[GooglePlaces] Place details error', { error: data.error, status: data.status });
        return null;
      }

      const endereco: EnderecoGeocodificado = {
        logradouro: data.logradouro,
        numero: data.numero,
        bairro: data.bairro,
        cidade: data.cidade,
        estado: data.estado,
        cep: data.cep,
        coordenadas: data.coordenadas,
        formatted_address: data.formatted_address,
      };

      // Salvar no cache (30 minutos)
      await setCache(cacheKey, endereco, CACHE_TTL.GEOCODING);

      logger.info('[GooglePlaces] Place details success', { placeId });
      return endereco;
    } catch (error) {
      logger.error('[GooglePlaces] Erro ao obter detalhes', error);
      return null;
    }
  },

  /**
   * Autocomplete com coordenadas (faz autocomplete + place details)
   *
   * @param input - Texto digitado
   * @returns Primeira sugestão com coordenadas ou null
   */
  async autocompleteWithCoordinates(
    input: string
  ): Promise<(GooglePlaceSuggestion & { coordinates: Coordenadas }) | null> {
    const suggestions = await this.autocompleteAddress(input);

    if (suggestions.length === 0) {
      return null;
    }

    const details = await this.getPlaceDetails(suggestions[0].place_id);

    if (!details?.coordenadas) {
      return null;
    }

    return {
      ...suggestions[0],
      coordinates: details.coordenadas,
    };
  },
};

export type { EdgeFunctionAutocompleteResponse, EdgeFunctionPlaceDetailsResponse };
