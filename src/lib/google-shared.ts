/**
 * Google Maps Service - Shared Utilities
 *
 * Utilitários compartilhados por google.ts.
 * Centraliza tipos e funções para evitar duplicação.
 *
 * @module google-shared
 */

import {
  RouteError,
  RouteResult,
  parseGoogleError,
  createNetworkError,
  success,
  failure,
} from './routeErrors';

// ============================================================================
// SHARED INTERFACES
// ============================================================================

/**
 * Interface para sugestões de endereço do Google Places Autocomplete.
 * Usada por google.ts.
 */
export interface PlaceSuggestion {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

// ============================================================================
// SHARED HELPER FUNCTIONS
// ============================================================================

/**
 * Trata erros de requisição e retorna RouteError apropriado.
 * Centraliza o padrão de tratamento de erros usado em google.ts.
 *
 * @param err - Erro capturado
 * @returns RouteError formatado
 */
export function handleDirectionsError(err: unknown): RouteError {
  const error = err as { name?: string; message?: string };

  if (error?.name === 'AbortError') {
    return parseGoogleError('TIMEOUT', 'Request aborted due to timeout');
  }

  if (err instanceof TypeError || error?.message?.includes('fetch')) {
    return createNetworkError(err instanceof Error ? err : undefined);
  }

  return parseGoogleError('UNKNOWN_ERROR', error?.message);
}

// Re-export routeErrors utilities for convenience
export type { RouteError, RouteResult };
export { parseGoogleError, success, failure };
