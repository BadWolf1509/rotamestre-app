/**
 * Chamada da Edge Function `criar-motorista` pelo cliente do Supabase.
 *
 * `supabase.functions.invoke` herda o `fetch` do cliente (prazo de 15 s, porteiro
 * de sessão, observador de rede, `X-Client-Info` com a versão do app) e manda o
 * token da sessão renovado. O `fetch` cru que havia aqui ficava fora de tudo
 * isso: rede que aceita a conexão e não responde deixava o modal preso para
 * sempre.
 *
 * Alternativas: (a) `invoke` (escolhida); (b) manter o `fetch` com um
 * `AbortController` e trocar o `getSession()` por `lerSessao()` — repete à mão
 * o prazo e a renovação de sessão que o cliente já tem.
 */

import { isNetworkError } from '@/lib/errorMapping';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

export const MSG_SEM_CONEXAO = 'Sem conexão. Tente de novo.';
export const MSG_FALHA_CRIAR =
  'Não foi possível criar o motorista. Tente de novo.';
export const MSG_SESSAO_EXPIRADA =
  'Sua sessão expirou. Por favor, faça login novamente.';

export interface DadosCriarMotorista {
  nome: string;
  email: string;
  senha: string;
  telefone: string | null;
  unidade_id: string | null;
}

export type ResultadoCriarMotorista =
  { ok: true } | { ok: false; mensagem: string };

/** Texto do erro que a função devolveu no corpo de uma resposta não-2xx. */
async function lerTextoDaFuncao(
  erro: unknown,
): Promise<{ status: number | null; texto: string | null }> {
  const resposta = (erro as { context?: unknown } | null)?.context;
  if (!(resposta instanceof Response)) return { status: null, texto: null };
  try {
    const corpo = (await resposta.json()) as { error?: unknown };
    const texto =
      typeof corpo?.error === 'string' && corpo.error ? corpo.error : null;
    return { status: resposta.status, texto };
  } catch {
    // Corpo que não é JSON (proxy, 502): segue com a mensagem genérica.
    return { status: resposta.status, texto: null };
  }
}

/** Nunca lança e nunca devolve texto técnico: só mensagens para o gestor. */
export async function chamarCriarMotorista(
  dados: DadosCriarMotorista,
): Promise<ResultadoCriarMotorista> {
  try {
    const { data, error } = await supabase.functions.invoke('criar-motorista', {
      method: 'POST',
      body: dados,
    });

    if (error) {
      const { status, texto } = await lerTextoDaFuncao(error);
      logger.error('[Motoristas] criar-motorista recusou', { status });
      // O texto da função (409 de e-mail/telefone etc.) já é para o gestor.
      if (texto) return { ok: false, mensagem: texto };
      if (status === 401) return { ok: false, mensagem: MSG_SESSAO_EXPIRADA };
      if (
        (error as Error).name === 'FunctionsFetchError' ||
        isNetworkError(error)
      ) {
        return { ok: false, mensagem: MSG_SEM_CONEXAO };
      }
      return { ok: false, mensagem: MSG_FALHA_CRIAR };
    }

    // Sem erro e sem corpo: a função respondeu 2xx, o motorista foi criado.
    // Texto solto (HTML de proxy) não é a resposta dela.
    if (typeof data === 'string') {
      logger.error(
        '[Motoristas] criar-motorista respondeu algo que não é JSON',
      );
      return { ok: false, mensagem: MSG_FALHA_CRIAR };
    }
    return { ok: true };
  } catch (erro) {
    logger.error('[Motoristas] Erro inesperado em criar-motorista', erro);
    return {
      ok: false,
      mensagem: isNetworkError(erro) ? MSG_SEM_CONEXAO : MSG_FALHA_CRIAR,
    };
  }
}
