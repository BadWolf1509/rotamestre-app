/**
 * Porteiro de sessão: consulta REST nunca sai do aparelho sem usuário logado.
 *
 * POR QUE EXISTE. Com o access token vencido e o refresh falhando (rede ruim,
 * a rotina do motorista), o auth-js devolve sessão nula por até 60 s
 * (cooldown). O supabase-js então manda a chave publishable como `Bearer`
 * (`fetchWithAuth`), e a RLS responde **200 com 0 linhas, sem erro** — para o
 * app, "a rota sumiu" ou "a parada não existe", e não "estou sem sessão".
 * O porteiro troca esse silêncio por um 401 `PGRST301` local, que o app já
 * trata como "sessão — espere" (`ehErroDeSessao`, `classificarFalhaPerfil`).
 *
 * ALTERNATIVAS COMPARADAS.
 * (a) Porteiro no `fetch` (escolhida): um lugar só, cobre todo chamador,
 *     inclusive os futuros. O app não tem consulta REST legítima sem sessão:
 *     auth, cadastro e recuperação usam só `/auth/v1`; `delete-account` é
 *     Edge Function.
 * (b) Conferir `lerSessao` antes/depois em cada chamador: remendo por
 *     chamador; o próximo chamador nasce sem a conferência.
 * (c) Opção `accessToken` do `createClient`: desliga a API `supabase.auth`
 *     inteira — inviável.
 *
 * Só `/rest/v1/` é vigiado. `/auth/v1/`, `/functions/v1/` e `/storage/v1/`
 * passam sem mudança.
 */

export const CODIGO_SEM_SESSAO = 'PGRST301';
export const MENSAGEM_SEM_SESSAO = 'Sem sessão: consulta não enviada';

type EntradaDeFetch = Parameters<typeof fetch>[0];

function urlDe(input: EntradaDeFetch): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

export function criarFetchSemConsultaAnonima(
  chaveApi: string,
  base: typeof fetch,
): typeof fetch {
  return async function fetchComPorteiro(input, init) {
    if (urlDe(input).includes('/rest/v1/')) {
      const autorizacao = new Headers(init?.headers).get('Authorization');
      if (!autorizacao || autorizacao === `Bearer ${chaveApi}`) {
        return new Response(
          JSON.stringify({
            code: CODIGO_SEM_SESSAO,
            message: MENSAGEM_SEM_SESSAO,
            details: null,
            hint: null,
          }),
          {
            status: 401,
            statusText: 'Unauthorized',
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }
    }
    return base(input, init);
  };
}
