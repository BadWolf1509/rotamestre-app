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

export type ValidarAutorizacao = (authorization: string) => Promise<boolean>;

/**
 * @returns `null` quando há usuário válido; uma `Response` 401 pronta quando não.
 */
export async function exigirUsuario(
  req: Request,
  validar: ValidarAutorizacao,
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
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
    return (await validar(authorization)) ? null : recusa();
  } catch (error) {
    // O detalhe fica no log da função; o cliente só recebe 401.
    console.error('[autenticacao] Falha ao validar o usuário:', error);
    return recusa();
  }
}
