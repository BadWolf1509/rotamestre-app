/**
 * Geocoding Service - ViaCEP + Google
 *
 * Serviço unificado de geocodificação que combina:
 * 1. ViaCEP (gratuito) - Quando usuário digita um CEP
 * 2. Google Places (pago) - Para busca de endereços por texto
 *
 * Estratégia simplificada:
 * - CEP é detectado automaticamente e resolvido via ViaCEP (gratuito)
 * - Busca por texto usa Google Places (cobertura completa no Brasil)
 * - Photon mantido apenas para geocodificação reversa e obter coords de CEP
 *
 * @example
 * ```ts
 * import { geocodingService } from '@/lib/geocoding';
 *
 * // Autocomplete de endereço
 * const suggestions = await geocodingService.autocomplete('Rua Antonio Leite');
 *
 * // Busca por CEP
 * const suggestions = await geocodingService.autocomplete('58068-504');
 * ```
 */

import { googlePlacesService, GooglePlaceSuggestion } from '@/lib/googlePlaces';
import { logger } from '@/lib/logger';
import { photonService } from '@/lib/photon';
import { viacepService, ViaCEPPlaceSuggestion } from '@/lib/viacep';

import type { PlaceSuggestion } from './google-shared';
import type { Coordenadas, EnderecoGeocodificado } from '../types/endereco';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Fonte do resultado de geocodificação
 */
export type GeocodingSource = 'google' | 'viacep';

/**
 * Sugestão unificada com metadados de fonte
 */
export interface UnifiedPlaceSuggestion extends PlaceSuggestion {
  coordinates?: Coordenadas;
  source: GeocodingSource;
  cep?: string;
  /** Indica se precisa de chamada extra para obter coordenadas */
  needsCoordinates?: boolean;
}

/**
 * Estatísticas de uso do serviço (para monitoramento de custos)
 */
export interface GeocodingStats {
  googleCalls: number;
  viacepCalls: number;
}

// ============================================================================
// STATISTICS (in-memory, resets on app restart)
// ============================================================================

const stats: GeocodingStats = {
  googleCalls: 0,
  viacepCalls: 0,
};

// ============================================================================
// CONFIGURATION
// ============================================================================

interface GeocodingConfig {
  /** Habilitar detecção automática de CEP */
  enableCEPDetection: boolean;
}

const defaultConfig: GeocodingConfig = {
  enableCEPDetection: true,
};

let config: GeocodingConfig = { ...defaultConfig };

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Converte GooglePlaceSuggestion para UnifiedPlaceSuggestion
 */
function fromGoogle(suggestion: GooglePlaceSuggestion): UnifiedPlaceSuggestion {
  return {
    place_id: suggestion.place_id,
    description: suggestion.description,
    structured_formatting: suggestion.structured_formatting,
    coordinates: suggestion.coordinates,
    source: 'google',
    needsCoordinates: !suggestion.coordinates, // Google autocomplete não retorna coords
  };
}

/**
 * Converte ViaCEPPlaceSuggestion para UnifiedPlaceSuggestion
 * @param suggestion - Sugestão do ViaCEP
 * @param numero - Número do endereço (opcional, extraído do input do usuário)
 */
function fromViaCEP(suggestion: ViaCEPPlaceSuggestion, numero?: string): UnifiedPlaceSuggestion {
  // Se tem número, adicionar à descrição
  let description = suggestion.description;
  let mainText = suggestion.structured_formatting.main_text;

  if (numero) {
    // Adiciona número após o logradouro (antes da primeira vírgula)
    const commaIndex = description.indexOf(',');
    if (commaIndex > 0) {
      description = description.slice(0, commaIndex) + ', ' + numero + description.slice(commaIndex);
    } else {
      description = description + ', ' + numero;
    }
    // Adiciona número ao texto principal também
    mainText = mainText + ', ' + numero;
  }

  return {
    place_id: suggestion.place_id + (numero ? `_${numero}` : ''),
    description,
    structured_formatting: {
      main_text: mainText,
      secondary_text: suggestion.structured_formatting.secondary_text,
    },
    source: 'viacep',
    cep: suggestion.cep,
    needsCoordinates: true, // ViaCEP não fornece coordenadas
  };
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Serviço híbrido de geocodificação.
 * Combina Photon (gratuito) + Google (fallback) + ViaCEP (para CEPs).
 */
export const geocodingService = {
  /**
   * Autocomplete de endereços (ViaCEP + Google)
   *
   * Estratégia de busca:
   * 1. Se for CEP → busca via ViaCEP (gratuito, dados dos Correios)
   * 2. Caso contrário → Google Places (cobertura completa no Brasil)
   *
   * @param input - Texto digitado pelo usuário
   * @param _locationBias - Não utilizado (mantido para compatibilidade)
   * @returns Lista de sugestões unificadas
   */
  async autocomplete(
    input: string,
    _locationBias?: Coordenadas
  ): Promise<UnifiedPlaceSuggestion[]> {
    if (!input || input.length < 3) {
      return [];
    }

    // 1. Detectar se contém CEP (pode ter número junto: "58068-504, 100")
    if (config.enableCEPDetection && viacepService.containsCEP(input)) {
      const cep = viacepService.extractCEP(input);
      if (cep) {
        stats.viacepCalls++;
        const cepResult = await viacepService.searchByCEP(cep);
        if (cepResult) {
          // Extrair número se o usuário digitou (ex: "58068-504, 100")
          const numero = viacepService.extractNumberFromCEPInput(input);
          logger.info('[Geocoding] Resultado via CEP', { cep, numero });
          return [fromViaCEP(cepResult, numero || undefined)];
        }
      }
    }

    // 2. Buscar via Google Places
    if (!googlePlacesService.isAvailable()) {
      logger.warn('[Geocoding] Google Places não disponível (API key não configurada)');
      return [];
    }

    stats.googleCalls++;
    logger.info('[Geocoding] Buscando via Google Places', { input });

    const googleResults = await googlePlacesService.autocompleteAddress(input);
    return googleResults.map(fromGoogle);
  },

  /**
   * Obtém coordenadas para uma sugestão
   *
   * Necessário quando:
   * - Sugestão veio do Google (não retorna coords no autocomplete)
   * - Sugestão veio do ViaCEP (não fornece coords)
   *
   * @param suggestion - Sugestão a geocodificar
   * @returns Coordenadas ou null
   */
  async getCoordinates(
    suggestion: UnifiedPlaceSuggestion
  ): Promise<Coordenadas | null> {
    // Se já tem coordenadas, retornar
    if (suggestion.coordinates) {
      return suggestion.coordinates;
    }

    // Se veio do Google, buscar via Place Details
    if (suggestion.source === 'google') {
      const details = await googlePlacesService.getPlaceDetails(suggestion.place_id);
      return details?.coordenadas || null;
    }

    // Se veio do ViaCEP, geocodificar o endereço via Photon
    if (suggestion.source === 'viacep') {
      const coords = await photonService.getCoordinates(suggestion.description);
      return coords;
    }

    return null;
  },

  /**
   * Autocomplete com coordenadas garantidas
   *
   * Faz autocomplete e já resolve coordenadas para o primeiro resultado.
   * Mais conveniente, mas pode ser mais lento/caro.
   *
   * @param input - Texto digitado
   * @param locationBias - Bias de localização
   * @returns Primeira sugestão com coordenadas ou null
   */
  async autocompleteWithCoordinates(
    input: string,
    locationBias?: Coordenadas
  ): Promise<UnifiedPlaceSuggestion | null> {
    const suggestions = await this.autocomplete(input, locationBias);

    if (suggestions.length === 0) {
      return null;
    }

    const first = suggestions[0];

    // Se já tem coordenadas, retornar
    if (first.coordinates) {
      return first;
    }

    // Buscar coordenadas
    const coords = await this.getCoordinates(first);

    if (!coords) {
      return null;
    }

    return {
      ...first,
      coordinates: coords,
      needsCoordinates: false,
    };
  },

  /**
   * Geocodifica um endereço (texto → coordenadas)
   *
   * @param address - Endereço em texto
   * @returns Endereço geocodificado ou null
   */
  async geocode(address: string): Promise<EnderecoGeocodificado | null> {
    if (!googlePlacesService.isAvailable()) {
      logger.warn('[Geocoding] Google Places não disponível');
      return null;
    }

    stats.googleCalls++;
    const googleSuggestion = await googlePlacesService.autocompleteWithCoordinates(address);

    if (googleSuggestion?.coordinates) {
      return {
        logradouro: '',
        numero: '',
        bairro: '',
        cidade: '',
        estado: '',
        cep: '',
        coordenadas: googleSuggestion.coordinates,
        formatted_address: googleSuggestion.description,
      };
    }

    return null;
  },

  /**
   * Geocodificação reversa (coordenadas → endereço)
   */
  async reverseGeocode(coords: Coordenadas): Promise<string | null> {
    return photonService.reverseGeocode(coords);
  },

  // ===========================================================================
  // CONFIGURATION & STATS
  // ===========================================================================

  /**
   * Configura o serviço
   */
  configure(newConfig: Partial<GeocodingConfig>): void {
    config = { ...config, ...newConfig };
    logger.info('[Geocoding] Configuração atualizada', config);
  },

  /**
   * Retorna configuração atual
   */
  getConfig(): GeocodingConfig {
    return { ...config };
  },

  /**
   * Retorna estatísticas de uso
   */
  getStats(): GeocodingStats {
    return { ...stats };
  },

  /**
   * Reseta estatísticas
   */
  resetStats(): void {
    stats.googleCalls = 0;
    stats.viacepCalls = 0;
  },

  /**
   * Verifica se Google Places está disponível
   */
  isGoogleAvailable(): boolean {
    return googlePlacesService.isAvailable();
  },
};

// Export types
export type { GeocodingConfig };
