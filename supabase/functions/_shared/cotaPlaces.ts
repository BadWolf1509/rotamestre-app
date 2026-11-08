// Teto diário por usuário nas Edge Functions do Google Places (Migration 84).
//
// O cadastro é aberto e o Places é pago: antes de chamar a Google, a função
// consome uma chamada da cota do usuário pela RPC `consumir_cota_places`
// (SECURITY DEFINER; limites fixos no banco: autocomplete 1000/dia, details
// 300/dia, no dia de Brasília). O `.rpc` vem injetado — na função, o de um
// cliente criado com a chave publicável e o `Authorization` de quem busca,
// para o `auth.uid()` do banco ser o dele; no Jest, um falso.
//
// FAIL-OPEN de propósito: erro do banco (RPC ausente, rede, resposta
// estranha) devolve 'indisponivel' e a busca SEGUE, com `console.error`.
// Motivos: (1) a cota é teto de custo, não autorização — quem chega aqui já
// passou pelo `auth.getUser`; (2) banco fora do ar é transitório, e travar a
// busca de endereço por isso pararia o cadastro de parada e de loja; (3) a
// função publicada antes da migration continua funcionando (sem teto) em vez
// de recusar tudo. O custo de uma janela de falha é limitado pela duração
// dela; o de travar é o app parado.

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

/** Consome uma chamada da cota do usuário do `Authorization` do cliente. */
export async function consumirCotaPlaces(
  rpc: ChamarRpc,
  servico: ServicoPlaces,
): Promise<ResultadoCota> {
  try {
    const { data, error } = await rpc('consumir_cota_places', {
      p_servico: servico,
    });
    if (error) {
      console.error('[cotaPlaces] Erro ao consumir a cota; seguindo:', error);
      return 'indisponivel';
    }
    if (data === true) return 'ok';
    if (data === false) return 'esgotada';
    console.error('[cotaPlaces] Resposta sem boolean; seguindo:', data);
    return 'indisponivel';
  } catch (error) {
    console.error('[cotaPlaces] Falha ao consumir a cota; seguindo:', error);
    return 'indisponivel';
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
