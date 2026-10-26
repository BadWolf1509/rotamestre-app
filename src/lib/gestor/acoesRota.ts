/**
 * Cancelar e reativar rota pelo gestor — pelas RPCs atômicas do banco.
 *
 * `cancelar_rota` (Migration 70) muda a rota para `cancelada` e devolve a
 * parada `em_andamento` a `pendente` na mesma transação; `reativar_rota`
 * (Migration 71) reabre a rota `nao_executada` com a data de hoje em São
 * Paulo, devolve as paradas não concluídas a `pendente` e grava o log
 * `rota_reativada`. Antes eram duas escritas independentes do cliente (rota e
 * paradas), que podiam deixar uma sem a outra.
 *
 * Quem confere a situação viva da rota e se quem chama é gestor ativo da loja
 * dela é o banco. O cliente só repassa o resultado, que vem de um conjunto
 * fechado; qualquer outro valor vira erro, para a tela nunca anunciar sucesso
 * de uma resposta que não entende.
 */
import { supabase } from '@/lib/supabase';

const RESULTADOS_CANCELAR = [
  'cancelada',
  // 2ª chamada depois de resposta perdida ou toque duplo: a rota já está
  // cancelada. A tela trata como aviso informativo, não como erro.
  'ja_cancelada',
  'situacao_mudou',
  'sem_permissao',
] as const;

const RESULTADOS_REATIVAR = [
  'reativada',
  'situacao_mudou',
  'sem_permissao',
] as const;

export type ResultadoCancelarRota = (typeof RESULTADOS_CANCELAR)[number];
export type ResultadoReativarRota = (typeof RESULTADOS_REATIVAR)[number];

export const MENSAGEM_SEM_PERMISSAO_ROTA =
  'Você não tem mais acesso de gestor a esta loja. A tela foi atualizada.';

export const MENSAGEM_ROTA_JA_CANCELADA =
  'A rota já estava cancelada. A tela foi atualizada.';

async function chamarAcao<T extends string>(
  nome: 'cancelar_rota' | 'reativar_rota',
  rotaId: string,
  aceitos: readonly T[],
): Promise<T> {
  const { data, error } = await supabase.rpc(nome, { p_rota_id: rotaId });
  if (error) throw error;
  const resultado = aceitos.find((valor) => valor === data);
  if (resultado === undefined) {
    throw new Error(`Resposta inesperada de ${nome}: ${String(data)}`);
  }
  return resultado;
}

export function cancelarRota(rotaId: string): Promise<ResultadoCancelarRota> {
  return chamarAcao('cancelar_rota', rotaId, RESULTADOS_CANCELAR);
}

export function reativarRota(rotaId: string): Promise<ResultadoReativarRota> {
  return chamarAcao('reativar_rota', rotaId, RESULTADOS_REATIVAR);
}
