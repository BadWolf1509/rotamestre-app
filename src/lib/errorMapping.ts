/**
 * Mapeamento de erros para mensagens amigáveis
 *
 * Evita expor detalhes técnicos do banco de dados ou RLS ao usuário.
 * Todas as mensagens são genéricas e seguras.
 */

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
    pattern:
      /legacy.*api.*keys?.*disabled|invalid.*api.*key|api.*key.*invalid/i,
    result: {
      title: 'Serviço temporariamente indisponível',
      message:
        'Não foi possível conectar ao serviço. Tente novamente em alguns minutos.',
      type: 'warning',
      code: 'SERVICE_CONFIGURATION_ERROR',
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
      message:
        'Este e-mail já está em uso. Tente fazer login ou recuperar sua senha.',
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
  {
    pattern:
      /same_password|should.*be.*different|new.*password.*different|password.*same/i,
    result: {
      title: 'Senha inválida',
      message: 'A nova senha deve ser diferente da senha atual/anterior.',
      type: 'warning',
      code: 'AUTH_PASSWORD_SAME',
    },
  },
  {
    pattern:
      /weak_password|password.*(at least|minim|minimum)|password.*(uppercase|lowercase|number|special)|password.*requirements/i,
    result: {
      title: 'Senha fraca',
      message:
        'A senha não atende aos requisitos de segurança. Tente uma senha mais forte.',
      type: 'warning',
      code: 'AUTH_PASSWORD_WEAK',
    },
  },
  {
    pattern: /leaked|compromised|pwned/i,
    result: {
      title: 'Senha comprometida',
      message:
        'Essa senha já apareceu em vazamentos. Use uma senha diferente e mais segura.',
      type: 'warning',
      code: 'AUTH_PASSWORD_COMPROMISED',
    },
  },
  {
    pattern: /recent.*login|reauth|reauthentication/i,
    result: {
      title: 'Sessão expirada',
      message:
        'Para atualizar a senha, solicite um novo link de recuperação e tente novamente.',
      type: 'warning',
      code: 'AUTH_RECENT_LOGIN_REQUIRED',
    },
  },
  {
    // Sentinela da RPC criar_unidade_para_novo_gestor (ver
    // database/migrations/20260806175617_onboarding_self_service.sql): a
    // sessão expirou no meio do formulário de onboarding. Conselho diferente
    // do padrão acima — aqui não existe "link de recuperação", é refazer login.
    pattern: /NAO_AUTENTICADO/i,
    result: {
      title: 'Sessão expirada',
      message: 'Sua sessão expirou. Faça login novamente para continuar.',
      type: 'warning',
      code: 'AUTH_NOT_AUTHENTICATED',
    },
  },
  {
    // Sentinela da RPC criar_unidade_para_novo_gestor: a conta já tem perfil,
    // então já passou pelo onboarding. A rota /onboarding/criar-unidade abre
    // por URL mesmo depois disso — link antigo, histórico do navegador ou aba
    // esquecida bastam —, e sem esta entrada o gestor preenchia o formulário
    // inteiro para receber "Algo deu errado". A RPC em si está correta: ela
    // barra a criação de uma segunda unidade.
    pattern: /PERFIL_JA_EXISTE/i,
    result: {
      title: 'Sua conta já tem unidade',
      message:
        'Este cadastro já foi concluído. Volte ao início para acessar sua unidade.',
      type: 'warning',
      code: 'PROFILE_ALREADY_EXISTS',
    },
  },
  {
    // Sentinela da RPC atualizar_unidade: levantada quando quem chama não é
    // gestor ativo daquela unidade. Mensagem específica para deixar claro que
    // é falta de permissão, não erro genérico.
    // code usa a convenção semântica das demais entradas (não o nome cru da
    // sentinela) para que isPermissionError() reconheça este erro.
    pattern: /SEM_PERMISSAO/i,
    result: {
      title: 'Sem permissão',
      message:
        'Você não tem permissão para alterar os dados desta unidade. Apenas gestores podem fazer isso.',
      type: 'error',
      code: 'PERMISSION_DENIED',
    },
  },
  {
    // Sentinela da RPC atualizar_unidade: nome ou cidade vazios (após trim).
    // handleSave (app/unidade/index.tsx) só valida nome no cliente — cidade
    // não tem guarda na UI, então apagá-la é o caminho real até aqui.
    pattern: /CAMPOS_OBRIGATORIOS/i,
    result: {
      title: 'Campos obrigatórios',
      message: 'Preencha o nome e a cidade da unidade para salvar.',
      type: 'warning',
      code: 'REQUIRED_FIELDS_MISSING',
    },
  },
  {
    // Sentinela da RPC atualizar_unidade: UF diferente de 2 letras. O input
    // de UF aceita 1 caractere na tela hoje, então é alcançável digitando.
    pattern: /UF_INVALIDA/i,
    result: {
      title: 'UF inválida',
      message: 'Informe a UF com as 2 letras do estado (ex.: SP, RJ).',
      type: 'warning',
      code: 'INVALID_STATE_CODE',
    },
  },
  {
    // Sentinela da RPC atualizar_unidade: latitude/longitude da sede fora do
    // intervalo válido (-90..90 / -180..180). Só alcançável com payload fora
    // do fluxo normal — o AddressAutocomplete sempre entrega coordenadas
    // reais quando uma sugestão é selecionada.
    pattern: /COORDENADAS_INVALIDAS/i,
    result: {
      title: 'Endereço da sede inválido',
      message:
        'Selecione o endereço da sede na lista de sugestões e tente novamente.',
      type: 'warning',
      code: 'INVALID_COORDINATES',
    },
  },

  // Sentinelas da RPC transferir_gestao_principal (ver
  // database/migrations/20260906120000_rls_endurecimento_papel_e_view_admin.sql).
  // Diferente das sentinelas acima (constantes UPPER_SNAKE_CASE), esta RPC
  // levanta a frase de negócio já pronta para o gestor ler — o padrão casa a
  // frase inteira e o `message` do resultado a repete verbatim, para que
  // apareça na tela exatamente como o banco escreveu.
  {
    // Quem chama tentou se indicar como o próprio novo gestor principal. A
    // lista de destinatários (loadGestoresElegiveis em transferir.tsx) já
    // exclui o chamador, então isto só é alcançável fora do fluxo normal da
    // tela — mesmo assim, sem esta entrada caía no DEFAULT_ERROR genérico.
    pattern: /o novo gestor principal precisa ser outra pessoa/i,
    result: {
      title: 'Seleção inválida',
      message: 'O novo gestor principal precisa ser outra pessoa',
      type: 'warning',
      code: 'TRANSFER_SELF_TARGET',
    },
  },
  {
    // Quem chama deixou de ser o gestor principal ATIVO da unidade entre o
    // carregamento da tela e a confirmação (ex.: outra transferência já
    // aconteceu, ou a conta foi desativada nesse intervalo). code usa a
    // convenção semântica de SEM_PERMISSAO (não o nome cru da sentinela) para
    // que isPermissionError() reconheça este erro também.
    pattern: /só o gestor principal da unidade pode transferir a gestão/i,
    result: {
      title: 'Sem permissão',
      message: 'Só o gestor principal da unidade pode transferir a gestão',
      type: 'error',
      code: 'PERMISSION_DENIED',
    },
  },
  {
    // O destinatário escolhido deixou de ser gestor ativo desta unidade entre
    // o carregamento da lista (loadGestoresElegiveis) e a confirmação — foi
    // desativado, trocou de unidade ou foi removido. A ação certa é atualizar
    // a lista de gestores elegíveis, não "contate o suporte".
    pattern: /o destinatário precisa ser gestor ativo desta unidade/i,
    result: {
      title: 'Destinatário indisponível',
      message: 'O destinatário precisa ser gestor ativo desta unidade',
      type: 'warning',
      code: 'TRANSFER_TARGET_INVALID',
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
      message:
        'Este registro está vinculado a outros dados e não pode ser alterado.',
      type: 'error',
      code: 'FK_VIOLATION',
    },
  },
  {
    pattern:
      /duplicate key value violates unique constraint "usuarios_email_key"/i,
    result: {
      title: 'E-mail já cadastrado',
      message: 'Já existe um usuário com este e-mail.',
      type: 'warning',
      code: 'UNIQUE_EMAIL_VIOLATION',
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

  // Erros de RPC ausente no schema cache do PostgREST. Aparece quando o
  // código chega em produção antes da migration que cria a função (ex.:
  // criar_unidade_para_novo_gestor) — ver exigência de ordem de deploy em
  // database/MIGRATIONS.md, Migration 21.
  // Padrão restrito a funções (não colunas — PGRST204 requer tratamento diferente).
  {
    pattern: /could not find the.*function.*schema cache/i,
    result: {
      title: 'Serviço temporariamente indisponível',
      message:
        'Este recurso ainda está sendo configurado. Tente novamente em alguns instantes.',
      type: 'warning',
      code: 'RPC_SCHEMA_NOT_READY',
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
      message:
        'Não foi possível encontrar este endereço. Verifique e tente novamente.',
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
    const supabaseError = error as {
      message?: string;
      error_description?: string;
      code?: string;
    };
    errorString =
      supabaseError.message ||
      supabaseError.error_description ||
      JSON.stringify(error);
  }

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
