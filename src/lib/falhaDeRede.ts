/**
 * "Isto é falha de rede?" — fonte única (R-NUC-2).
 *
 * Havia quatro maneiras de decidir: o mapa de mensagens do `errorMapping`
 * (regex mais completo), `/network|fetch/i` no `queryClient` (que também casava
 * mensagens sem relação com rede, como "reading 'fetch'"), a checagem por
 * instância em `auth/falhaPerfil.ts` e a observação do `fetch` em
 * `redeObservada.ts`. Cada correção (o "Network request failed" com N
 * maiúsculo do RN, o `FunctionsFetchError`) precisava ser repetida em todas.
 *
 * Alternativas consideradas: (a) este módulo, consumido pelos classificadores;
 * (b) `errorMapping.isNetworkError` como fonte — depende do mapa inteiro de
 * mensagens (`getErrorMessage`) e não conhece as classes de erro. Ficou (a).
 *
 * Fica de fora, de propósito: `redeObservada.ts` (sinal do aparelho, não
 * classificação de um erro) e o ramo "sem status" de `classificarFalhaPerfil`,
 * que pergunta outra coisa — "a exceção saiu antes de haver resposta?" — e por
 * isso aceita qualquer `TypeError`.
 */
import { isAuthRetryableFetchError } from '@supabase/supabase-js';

/**
 * Mensagens de falha de rede: RN ("Network request failed"), Chrome ("Failed
 * to fetch"), Safari ("Load failed"), Firefox ("NetworkError when attempting
 * to fetch"), Edge Function sem resposta ("Failed to send a request"), Node
 * (ECONNREFUSED) e o texto já traduzido ("sem conexão").
 */
export const PADRAO_MENSAGEM_DE_REDE =
  /network|connection|offline|fetch.*failed|failed to fetch|failed to send a request|\bload failed|sem conexão|econnrefused/i;

export function ehMensagemDeFalhaDeRede(
  mensagem: string | null | undefined,
): boolean {
  return !!mensagem && PADRAO_MENSAGEM_DE_REDE.test(mensagem);
}

function mensagemDe(erro: unknown): string | null {
  if (erro instanceof Error) return erro.message;
  if (typeof erro === 'object' && erro !== null && 'message' in erro) {
    const { message } = erro as { message: unknown };
    return typeof message === 'string' ? message : null;
  }
  return null;
}

export function ehFalhaDeRede(erro: unknown): boolean {
  if (erro === null || erro === undefined) return false;
  if (isAuthRetryableFetchError(erro)) return true;
  if (erro instanceof Error && erro.name === 'FunctionsFetchError') return true;
  return ehMensagemDeFalhaDeRede(mensagemDe(erro));
}
