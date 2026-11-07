// Guarda de usuário autenticado para Edge Functions chamadas pelo app.
//
// Desde 22/10/2026 as funções rodam com `--no-verify-jwt` (o `verify_jwt` só
// entende o JWT antigo), então cada uma autoriza por dentro. Esta guarda exige
// `Authorization: Bearer <jwt da sessão>` e delega a validação a quem chama —
// na função, `createClient(url, chavePublica(), { global: { headers: {
// Authorization } } }).auth.getUser()`. A validação vem injetada para a guarda
// rodar no Jest (o supabase-js da função vem de esm.sh).
//
// A chave publishable (`sb_publishable_...`) também chega como Bearer quando o
// cliente não tem sessão; ela não é um JWT de usuário e o `getUser` a recusa.

/** O usuário que a validação reconheceu (só o que as funções usam). */
export interface UsuarioAutenticado {
  id: string;
}

/** Devolve o usuário do Authorization, ou `null` quando não há usuário. */
export type ValidarAutorizacao = (
  authorization: string,
) => Promise<UsuarioAutenticado | null>;

/**
 * @returns `{ usuario }` quando há usuário válido; uma `Response` 401 pronta
 * quando não. Quem chama testa `instanceof Response` e devolve a recusa.
 */
export async function exigirUsuario(
  req: Request,
  validar: ValidarAutorizacao,
  corsHeaders: Record<string, string>,
): Promise<{ usuario: UsuarioAutenticado } | Response> {
  const recusa = () =>
    new Response(JSON.stringify({ error: 'Não autorizado' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  const authorization = req.headers.get('Authorization') ?? '';
  if (!authorization.startsWith('Bearer ')) {
    return recusa();
  }

  try {
    const usuario = await validar(authorization);
    return usuario ? { usuario } : recusa();
  } catch (error) {
    // O detalhe fica no log da função; o cliente só recebe 401.
    console.error('[autenticacao] Falha ao validar o usuário:', error);
    return recusa();
  }
}

interface ClienteComGetUser {
  auth: {
    getUser: () => Promise<{ data: { user: unknown }; error: unknown }>;
  };
}

/**
 * Validador de `exigirUsuario` pela chave publicável: cria um cliente com o
 * `Authorization` recebido e pergunta ao Auth quem é. O `createClient` vem
 * injetado (na função, o do esm.sh; no Jest, um falso), e a chave é lida só na
 * hora de validar, como `chavePublica()` exige.
 */
export function criarValidadorDeUsuario(
  createClient: (
    url: string,
    chave: string,
    opcoes: Record<string, unknown>,
  ) => ClienteComGetUser,
  url: string,
  obterChave: () => string,
): ValidarAutorizacao {
  return async (authorization) => {
    const cliente = createClient(url, obterChave(), {
      global: { headers: { Authorization: authorization } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const {
      data: { user },
      error,
    } = await cliente.auth.getUser();
    if (error || typeof user !== 'object' || user === null) return null;
    if (!('id' in user) || typeof user.id !== 'string' || user.id === '') {
      return null;
    }
    return { id: user.id };
  };
}
