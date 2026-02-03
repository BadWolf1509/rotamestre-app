/**
 * ViaCEP Service
 *
 * Serviço gratuito para busca de endereços por CEP no Brasil.
 * Usa a API pública do ViaCEP (https://viacep.com.br/).
 *
 * Vantagens:
 * - 100% gratuito, sem limites
 * - Dados oficiais dos Correios
 * - Excelente cobertura no Brasil
 *
 * @see https://viacep.com.br/
 */

import { CACHE_TTL, getCache, setCache } from '@/lib/cache';
import { logger } from '@/lib/logger';

import type { PlaceSuggestion } from './google-shared';
import type { Coordenadas } from '../types/endereco';

// ============================================================================
// CONFIGURATION
// ============================================================================

const VIACEP_API_URL = 'https://viacep.com.br/ws';
const REQUEST_TIMEOUT = 5000; // 5 segundos

// ============================================================================
// TYPES
// ============================================================================

/**
 * Resposta da API ViaCEP
 */
export interface ViaCEPResponse {
  cep: string;
  logradouro: string;
  complemento: string;
  unidade: string;
  bairro: string;
  localidade: string; // cidade
  uf: string; // estado (sigla)
  estado: string; // estado (nome completo)
  regiao: string;
  ibge: string;
  gia: string;
  ddd: string;
  siafi: string;
  erro?: boolean;
}

/**
 * PlaceSuggestion estendida para CEP (sem coordenadas - ViaCEP não fornece)
 */
export interface ViaCEPPlaceSuggestion extends PlaceSuggestion {
  cep: string;
  // Coordenadas não disponíveis via ViaCEP
  // Será necessário geocodificar depois se precisar
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Verifica se o texto parece ser um CEP (apenas CEP, sem número)
 * Aceita formatos: 58068504, 58068-504, 58.068-504
 */
export function isCEP(text: string): boolean {
  const cleaned = text.replace(/[.\-\s]/g, '');
  return /^\d{8}$/.test(cleaned);
}

/**
 * Verifica se o texto contém um CEP (pode ter número junto)
 * Aceita formatos: 58068-504, 58068504 100, 58068-504, 100, etc.
 */
export function containsCEP(text: string): boolean {
  // Padrão: 8 dígitos (com ou sem hífen/pontos)
  return /\d{5}[-.]?\d{3}/.test(text.replace(/\s/g, ''));
}

/**
 * Extrai e limpa CEP do texto
 */
export function extractCEP(text: string): string | null {
  const cleaned = text.replace(/[.\-\s]/g, '');
  const match = cleaned.match(/\d{8}/);
  return match ? match[0] : null;
}

/**
 * Extrai número do endereço após o CEP
 * Ex: "58068-504, 100" → "100"
 * Ex: "58068504 nº 150" → "150"
 * Ex: "58068-504 123A" → "123A"
 */
export function extractNumberFromCEPInput(text: string): string | null {
  // Remove o CEP do texto
  const withoutCEP = text.replace(/\d{5}[-.]?\d{3}/, '').trim();

  // Procura por número no resto do texto
  // Aceita: ", 100", " 100", " nº 100", " n 100", " num 100", " número 100"
  const match = withoutCEP.match(/(?:,\s*|^\s*|n[úu°]?(?:mero)?\s*)(\d+[a-zA-Z]?(?:-[a-zA-Z0-9]+)?)/i);

  return match ? match[1] : null;
}

/**
 * Formata CEP para exibição (XXXXX-XXX)
 */
export function formatCEP(cep: string): string {
  const cleaned = cep.replace(/\D/g, '');
  if (cleaned.length !== 8) return cep;
  return `${cleaned.slice(0, 5)}-${cleaned.slice(5)}`;
}

/**
 * Formata endereço completo a partir da resposta ViaCEP
 */
function formatAddress(data: ViaCEPResponse): string {
  const parts: string[] = [];

  if (data.logradouro) {
    parts.push(data.logradouro);
  }

  if (data.bairro) {
    parts.push(data.bairro);
  }

  if (data.localidade) {
    parts.push(data.localidade);
  }

  if (data.uf) {
    parts.push(data.uf);
  }

  return parts.join(', ') || 'Endereço não encontrado';
}

/**
 * Converte resposta ViaCEP para PlaceSuggestion
 */
function responseToSuggestion(data: ViaCEPResponse): ViaCEPPlaceSuggestion {
  const mainText = data.logradouro || data.bairro || data.localidade;
  const secondaryParts: string[] = [];

  if (data.logradouro && data.bairro) {
    secondaryParts.push(data.bairro);
  }
  if (data.localidade) {
    secondaryParts.push(data.localidade);
  }
  if (data.uf) {
    secondaryParts.push(data.uf);
  }

  return {
    place_id: `cep_${data.cep.replace(/\D/g, '')}`,
    description: formatAddress(data),
    structured_formatting: {
      main_text: mainText,
      secondary_text: secondaryParts.join(', '),
    },
    cep: formatCEP(data.cep),
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
 * Serviço de busca por CEP usando ViaCEP.
 */
export const viacepService = {
  /**
   * Busca endereço por CEP
   *
   * @param cep - CEP (aceita vários formatos: 58068504, 58068-504)
   * @returns Sugestão de endereço ou null se não encontrado
   */
  async searchByCEP(cep: string): Promise<ViaCEPPlaceSuggestion | null> {
    const cleanCEP = cep.replace(/\D/g, '');

    if (cleanCEP.length !== 8) {
      return null;
    }

    // Cache key
    const cacheKey = `viacep_${cleanCEP}`;

    // Verificar cache
    const cached = await getCache<ViaCEPPlaceSuggestion>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const url = `${VIACEP_API_URL}/${cleanCEP}/json/`;
      const response = await fetchWithTimeout(url);

      if (!response.ok) {
        logger.warn('[ViaCEP] API returned non-OK status', { status: response.status });
        return null;
      }

      const data: ViaCEPResponse = await response.json();

      if (data.erro) {
        logger.warn('[ViaCEP] CEP não encontrado', { cep: cleanCEP });
        return null;
      }

      const suggestion = responseToSuggestion(data);

      // Salvar no cache (30 minutos - CEPs não mudam)
      await setCache(cacheKey, suggestion, CACHE_TTL.GEOCODING);

      return suggestion;
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        logger.warn('[ViaCEP] Request timeout');
      } else {
        logger.error('[ViaCEP] Erro na busca', error);
      }
      return null;
    }
  },

  /**
   * Busca endereços por logradouro (rua, avenida, etc.)
   * Útil quando o usuário digita parte do endereço
   *
   * @param uf - Sigla do estado (ex: PB, SP)
   * @param cidade - Nome da cidade
   * @param logradouro - Nome da rua (mínimo 3 caracteres)
   * @returns Lista de sugestões
   */
  async searchByAddress(
    uf: string,
    cidade: string,
    logradouro: string
  ): Promise<ViaCEPPlaceSuggestion[]> {
    if (logradouro.length < 3) {
      return [];
    }

    // Cache key
    const cacheKey = `viacep_addr_${uf}_${cidade}_${logradouro}`.toLowerCase().replace(/\s+/g, '_');

    // Verificar cache
    const cached = await getCache<ViaCEPPlaceSuggestion[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const url = `${VIACEP_API_URL}/${encodeURIComponent(uf)}/${encodeURIComponent(cidade)}/${encodeURIComponent(logradouro)}/json/`;
      const response = await fetchWithTimeout(url);

      if (!response.ok) {
        return [];
      }

      const data: ViaCEPResponse[] = await response.json();

      if (!Array.isArray(data) || data.length === 0) {
        return [];
      }

      const suggestions = data.slice(0, 5).map(responseToSuggestion);

      // Salvar no cache (5 minutos)
      await setCache(cacheKey, suggestions, CACHE_TTL.AUTOCOMPLETE);

      return suggestions;
    } catch (error) {
      logger.error('[ViaCEP] Erro na busca por endereço', error);
      return [];
    }
  },

  /**
   * Verifica se o texto é um CEP válido (apenas CEP)
   */
  isCEP,

  /**
   * Verifica se o texto contém um CEP (pode ter número junto)
   */
  containsCEP,

  /**
   * Extrai CEP do texto
   */
  extractCEP,

  /**
   * Extrai número do endereço após o CEP
   */
  extractNumberFromCEPInput,

  /**
   * Formata CEP para exibição
   */
  formatCEP,
};
