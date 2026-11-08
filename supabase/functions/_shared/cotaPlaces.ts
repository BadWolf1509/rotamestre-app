// Teto diário por usuário nas Edge Functions do Google Places (Migrations 84
// e 85).
//
// O cadastro é aberto e o Places é pago: antes de chamar a Google, a função
// consome uma chamada da cota do usuário pela RPC `consumir_cota_places`
// (SECURITY DEFINER; limites fixos no banco: autocomplete 1000/dia, details
// 1000/dia desde a Migration 85, no dia de Brasília). O `.rpc` vem injetado — na função, o de um
// cliente criado com a chave publicável e o `Authorization` de quem busca,
// para o `auth.uid()` do banco ser o dele; no Jest, um falso.
//
// Falha ou demora do banco segue sem teto (fail-open): devolve 'indisponivel'
// e a busca segue, com `console.error`. A cota é teto de custo, não
// autorização — quem chega aqui já passou pelo `auth.getUser` —, e travar a
// busca de endereço pararia o cadastro de parada e de loja.

import { jsonResponse } from './http.ts';

/** Serviços com cota (o banco recusa qualquer outro com 22023). */
export type ServicoPlaces = 'autocomplete' | 'details';

/** 'ok' libera; 'esgotada' → 429; 'indisponivel' → segue (fail-open). */
export type ResultadoCota = 'ok' | 'esgotada' | 'indisponivel';

/** A forma do `supabase.rpc` que a cota usa. */
export type ChamarRpc = (
  funcao: string,
  args: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: unknown }>;

export const MENSAGEM_COTA_ESGOTADA =
  'Limite diário de buscas de endereço atingido. Tente de novo amanhã.';

/**
 * Quanto a busca espera o banco responder a cota ('indisponivel' depois
 * disso, fail-open): banco lento não pode prender a busca de endereço.
 */
export const PRAZO_COTA_MS = 2000;

/** Consome uma chamada da cota do usuário do `Authorization` do cliente. */
export async function consumirCotaPlaces(
  rpc: ChamarRpc,
  servico: ServicoPlaces,
): Promise<ResultadoCota> {
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  const prazo = new Promise<'prazo'>((resolver) => {
    temporizador = setTimeout(() => resolver('prazo'), PRAZO_COTA_MS);
  });
  try {
    const resposta = await Promise.race([
      Promise.resolve(rpc('consumir_cota_places', { p_servico: servico })),
      prazo,
    ]);
    if (resposta === 'prazo') {
      console.error(
        '[cotaPlaces] Banco sem resposta no prazo (ms); seguindo:',
        PRAZO_COTA_MS,
      );
      return 'indisponivel';
    }
    const { data, error } = resposta;
    if (error) {
      console.error('[cotaPlaces] Erro ao consumir a cota; seguindo:', error);
      return 'indisponivel';
    }
    if (data === true) return 'ok';
    if (data === false) return 'esgotada';
    if (data === null) {
      // Desde a Migration 85, null = o banco não viu usuário na sessão. Não é
      // cota esgotada (seria um 429 enganoso): segue como indisponível.
      console.error('[cotaPlaces] Banco sem usuário na sessão; seguindo');
      return 'indisponivel';
    }
    console.error('[cotaPlaces] Resposta sem boolean; seguindo:', data);
    return 'indisponivel';
  } catch (error) {
    console.error('[cotaPlaces] Falha ao consumir a cota; seguindo:', error);
    return 'indisponivel';
  } finally {
    clearTimeout(temporizador);
  }
}

/** 429 da cota esgotada, no contrato de erro das funções de Places. */
export function respostaCotaEsgotada(
  cors: Record<string, string>,
  extras: Record<string, unknown> = {},
): Response {
  return jsonResponse(
    429,
    { error: MENSAGEM_COTA_ESGOTADA, status: 'OVER_QUERY_LIMIT', ...extras },
    cors,
  );
}
