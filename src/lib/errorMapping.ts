/**
 * Mapeamento de erros para mensagens amigáveis
 *
 * Evita expor detalhes técnicos do banco de dados ou RLS ao usuário.
 * Todas as mensagens são genéricas e seguras.
 */

import { logger } from './logger';

// ============================================================================
// TIPOS
// ============================================================================

export interface UserFriendlyError {
  title: string;
  message: string;
  /** Tipo do alerta - alinhado com AlertDialog do design system */
  type: 'error' | 'warning' | 'default' | 'success';
  /** Código interno para debugging (não mostrar ao usuário) */
  code?: string;
}

// ============================================================================
// PADRÕES DE ERRO
// ============================================================================

const ERROR_PATTERNS: Array<{
  pattern: RegExp | string;
  result: UserFriendlyError;
}> = [
  // Erros de autenticação
  {
    pattern: /invalid.*login.*credentials/i,
    result: {
      title: 'E-mail ou senha incorretos',
      message: 'Verifique seus dados e tente novamente.',
      type: 'error',
      code: 'AUTH_INVALID_CREDENTIALS',
    },
  },
  {
    pattern: /email.*not.*confirmed/i,
    result: {
      title: 'E-mail não confirmado',
      message: 'Verifique sua caixa de entrada e confirme seu e-mail.',
      type: 'warning',
      code: 'AUTH_EMAIL_NOT_CONFIRMED',
    },
  },
  {
    pattern: /user.*already.*registered|email.*already.*exists/i,
    result: {
      title: 'E-mail já cadastrado',
      message: 'Este e-mail já está em uso. Tente fazer login ou recuperar sua senha.',
      type: 'warning',
      code: 'AUTH_EMAIL_EXISTS',
    },
  },
  {
    pattern: /too.*many.*requests|rate.*limit/i,
    result: {
      title: 'Muitas tentativas',
      message: 'Aguarde alguns minutos antes de tentar novamente.',
      type: 'warning',
      code: 'RATE_LIMIT',
    },
  },

  // Erros de RLS/Permissão
  {
    pattern: /rls|row.*level.*security|policy/i,
    result: {
      title: 'Sem permissão',
      message: 'Você não tem permissão para realizar esta ação.',
      type: 'error',
      code: 'RLS_VIOLATION',
    },
  },
  {
    pattern: /permission.*denied|unauthorized|forbidden/i,
    result: {
      title: 'Acesso negado',
      message: 'Você não tem permissão para acessar este recurso.',
      type: 'error',
      code: 'PERMISSION_DENIED',
    },
  },

  // Erros de banco de dados
  {
    pattern: /foreign.*key|fk_|violates.*foreign.*key/i,
    result: {
      title: 'Operação inválida',
      message: 'Este registro está vinculado a outros dados e não pode ser alterado.',
      type: 'error',
      code: 'FK_VIOLATION',
    },
  },
  {
    pattern: /unique.*constraint|duplicate.*key/i,
    result: {
      title: 'Registro duplicado',
      message: 'Já existe um registro com estes dados.',
      type: 'warning',
      code: 'UNIQUE_VIOLATION',
    },
  },
  {
    pattern: /not.*null|null.*value/i,
    result: {
      title: 'Dados incompletos',
      message: 'Preencha todos os campos obrigatórios.',
      type: 'warning',
      code: 'NULL_VIOLATION',
    },
  },
  {
    pattern: /check.*constraint/i,
    result: {
      title: 'Dados inválidos',
      message: 'Verifique os dados informados e tente novamente.',
      type: 'error',
      code: 'CHECK_VIOLATION',
    },
  },

  // Erros de rede
  {
    pattern: /network|connection|offline|fetch.*failed|econnrefused/i,
    result: {
      title: 'Sem conexão',
      message: 'Verifique sua conexão com a internet e tente novamente.',
      type: 'warning',
      code: 'NETWORK_ERROR',
    },
  },
  {
    pattern: /timeout|timed.*out/i,
    result: {
      title: 'Tempo esgotado',
      message: 'A operação demorou muito. Tente novamente.',
      type: 'warning',
      code: 'TIMEOUT',
    },
  },

  // Erros de API externa (Google Maps, etc)
  {
    pattern: /google.*maps|directions.*api|places.*api/i,
    result: {
      title: 'Erro no mapa',
      message: 'Não foi possível carregar o mapa. Tente novamente.',
      type: 'error',
      code: 'MAPS_ERROR',
    },
  },
  {
    pattern: /zero.*results|not.*found|no.*route/i,
    result: {
      title: 'Endereço não encontrado',
      message: 'Não foi possível encontrar este endereço. Verifique e tente novamente.',
      type: 'warning',
      code: 'ADDRESS_NOT_FOUND',
    },
  },

  // Erros de upload
  {
    pattern: /upload|storage|file.*too.*large/i,
    result: {
      title: 'Erro no upload',
      message: 'Não foi possível enviar o arquivo. Tente novamente.',
      type: 'error',
      code: 'UPLOAD_ERROR',
    },
  },
];

// Erro padrão (fallback)
const DEFAULT_ERROR: UserFriendlyError = {
  title: 'Algo deu errado',
  message: 'Ocorreu um erro inesperado. Tente novamente ou contate o suporte.',
  type: 'error',
  code: 'UNKNOWN_ERROR',
};

// ============================================================================
// FUNÇÕES
// ============================================================================

/**
 * Converte um erro técnico em mensagem amigável para o usuário
 *
 * @param error - Erro original (Error, string, ou objeto)
 * @returns Objeto com título e mensagem amigáveis
 *
 * @example
 * try {
 *   await supabase.from('users').insert(data);
 * } catch (error) {
 *   const friendly = getErrorMessage(error);
 *   showAlert(friendly.title, friendly.message);
 * }
 */
export function getErrorMessage(error: unknown): UserFriendlyError {
  // Extrair mensagem do erro
  let errorString = '';

  if (error instanceof Error) {
    errorString = error.message;
  } else if (typeof error === 'string') {
    errorString = error;
  } else if (error && typeof error === 'object') {
    // Supabase errors têm formato específico
    const supabaseError = error as { message?: string; error_description?: string; code?: string };
    errorString = supabaseError.message || supabaseError.error_description || JSON.stringify(error);
  }

  // Log do erro original (sanitizado) para debugging
  logger.error('Error occurred', error);

  // Buscar padrão correspondente
  for (const { pattern, result } of ERROR_PATTERNS) {
    if (typeof pattern === 'string') {
      if (errorString.toLowerCase().includes(pattern.toLowerCase())) {
        return result;
      }
    } else if (pattern.test(errorString)) {
      return result;
    }
  }

  // Retornar erro padrão
  return DEFAULT_ERROR;
}

/**
 * Versão simplificada que retorna apenas a mensagem
 */
export function getErrorString(error: unknown): string {
  const { message } = getErrorMessage(error);
  return message;
}

/**
 * Verifica se é um erro de rede/conexão
 */
export function isNetworkError(error: unknown): boolean {
  const result = getErrorMessage(error);
  return result.code === 'NETWORK_ERROR' || result.code === 'TIMEOUT';
}

/**
 * Verifica se é um erro de autenticação
 */
export function isAuthError(error: unknown): boolean {
  const result = getErrorMessage(error);
  return result.code?.startsWith('AUTH_') ?? false;
}

/**
 * Verifica se é um erro de permissão
 */
export function isPermissionError(error: unknown): boolean {
  const result = getErrorMessage(error);
  return result.code === 'RLS_VIOLATION' || result.code === 'PERMISSION_DENIED';
}

export default {
  getErrorMessage,
  getErrorString,
  isNetworkError,
  isAuthError,
  isPermissionError,
};
