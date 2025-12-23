/**
 * Tipos de erro e utilitários para o sistema de otimização de rotas.
 */

// ============================================================================
// TIPOS DE ERRO
// ============================================================================

export type RouteErrorCode =
  | 'ZERO_RESULTS'
  | 'NOT_FOUND'
  | 'MAX_WAYPOINTS_EXCEEDED'
  | 'INVALID_REQUEST'
  | 'OVER_QUERY_LIMIT'
  | 'REQUEST_DENIED'
  | 'UNKNOWN_ERROR'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'API_NOT_LOADED'
  | 'VALIDATION_ERROR'
  | 'CYCLE_DETECTED'
  | 'MISSING_COORDINATES';

export interface RouteError {
  code: RouteErrorCode;
  message: string;
  userMessage: string;
  details?: string;
  recoverable: boolean;
}

// ============================================================================
// MAPEAMENTO DE ERROS GOOGLE
// ============================================================================

const GOOGLE_ERROR_MAP: Record<string, RouteError> = {
  ZERO_RESULTS: {
    code: 'ZERO_RESULTS',
    message: 'No route found between the specified points',
    userMessage: 'Não foi possível encontrar uma rota entre os pontos especificados. Verifique se os endereços estão corretos.',
    recoverable: true,
  },
  TIMEOUT: {
    code: 'TIMEOUT',
    message: 'Request timed out',
    userMessage: 'A requisição demorou muito. Verifique sua conexão e tente novamente.',
    recoverable: true,
  },
  NOT_FOUND: {
    code: 'NOT_FOUND',
    message: 'One or more locations could not be geocoded',
    userMessage: 'Um ou mais endereços não foram encontrados. Verifique os endereços e tente novamente.',
    recoverable: true,
  },
  MAX_WAYPOINTS_EXCEEDED: {
    code: 'MAX_WAYPOINTS_EXCEEDED',
    message: 'Too many waypoints in the request',
    userMessage: 'Limite de paradas excedido. Divida a rota em partes menores.',
    recoverable: false,
  },
  INVALID_REQUEST: {
    code: 'INVALID_REQUEST',
    message: 'The request was invalid',
    userMessage: 'Requisição inválida. Verifique os dados e tente novamente.',
    recoverable: true,
  },
  OVER_QUERY_LIMIT: {
    code: 'OVER_QUERY_LIMIT',
    message: 'API quota exceeded',
    userMessage: 'Limite de uso da API atingido. Aguarde alguns minutos e tente novamente.',
    recoverable: true,
  },
  REQUEST_DENIED: {
    code: 'REQUEST_DENIED',
    message: 'API key is invalid or restricted',
    userMessage: 'Acesso à API negado. Entre em contato com o suporte.',
    recoverable: false,
  },
  UNKNOWN_ERROR: {
    code: 'UNKNOWN_ERROR',
    message: 'An unknown error occurred',
    userMessage: 'Ocorreu um erro inesperado. Tente novamente.',
    recoverable: true,
  },
};

// ============================================================================
// FUNÇÕES DE TRATAMENTO
// ============================================================================

/**
 * Converte status do Google Directions em RouteError.
 */
export function parseGoogleError(status: string, details?: string): RouteError {
  const mapped = GOOGLE_ERROR_MAP[status];
  if (mapped) {
    return { ...mapped, details };
  }

  return {
    code: 'UNKNOWN_ERROR',
    message: `Google API returned: ${status}`,
    userMessage: 'Erro ao calcular a rota. Tente novamente.',
    details,
    recoverable: true,
  };
}

/**
 * Cria erro de rede.
 */
export function createNetworkError(originalError?: Error): RouteError {
  return {
    code: 'NETWORK_ERROR',
    message: originalError?.message || 'Network request failed',
    userMessage: 'Erro de conexão. Verifique sua internet e tente novamente.',
    details: originalError?.stack,
    recoverable: true,
  };
}

/**
 * Cria erro de timeout.
 */
export function createTimeoutError(): RouteError {
  return {
    code: 'TIMEOUT',
    message: 'Request timed out',
    userMessage: 'A requisição demorou muito. Tente novamente.',
    recoverable: true,
  };
}

/**
 * Cria erro de API não carregada.
 */
export function createApiNotLoadedError(): RouteError {
  return {
    code: 'API_NOT_LOADED',
    message: 'Google Maps API not loaded',
    userMessage: 'Serviço de mapas não disponível. Recarregue a página.',
    recoverable: true,
  };
}

/**
 * Cria erro de validação.
 */
export function createValidationError(message: string, details?: string): RouteError {
  return {
    code: 'VALIDATION_ERROR',
    message,
    userMessage: message,
    details,
    recoverable: false,
  };
}

/**
 * Cria erro de ciclo detectado.
 */
export function createCycleError(cycleDescription: string): RouteError {
  return {
    code: 'CYCLE_DETECTED',
    message: `Circular dependency detected: ${cycleDescription}`,
    userMessage: `Dependência circular detectada: ${cycleDescription}`,
    recoverable: false,
  };
}

/**
 * Cria erro de coordenadas faltando.
 */
export function createMissingCoordinatesError(address: string): RouteError {
  return {
    code: 'MISSING_COORDINATES',
    message: `Missing coordinates for: ${address}`,
    userMessage: `Endereço "${address}" não tem coordenadas válidas.`,
    recoverable: true,
  };
}

// ============================================================================
// RESULTADO COM ERRO
// ============================================================================

export interface RouteResult<T> {
  success: boolean;
  data?: T;
  error?: RouteError;
}

/**
 * Cria resultado de sucesso.
 */
export function success<T>(data: T): RouteResult<T> {
  return { success: true, data };
}

/**
 * Cria resultado de erro.
 */
export function failure<T>(error: RouteError): RouteResult<T> {
  return { success: false, error };
}

/**
 * Verifica se é erro recuperável (pode tentar novamente).
 */
export function isRecoverableError(error: RouteError): boolean {
  return error.recoverable;
}

/**
 * Formata erro para log.
 */
export function formatErrorForLog(error: RouteError): string {
  return `[${error.code}] ${error.message}${error.details ? ` | Details: ${error.details}` : ''}`;
}
