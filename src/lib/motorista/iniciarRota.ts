/**
 * Iniciar a rota pelo motorista — pela RPC atômica do banco.
 *
 * `iniciar_rota` (Migration 88) confere, numa transação, que a rota é deste
 * motorista, com o cadastro ativo e vínculo ativo na loja, e grava juntas a
 * rota `em_andamento` (com `iniciada_em`), a partida concluída e a 1ª parada
 * real em andamento. Antes eram três escritas do cliente, e uma queda de rede
 * no meio deixava a rota em andamento com a partida pendente.
 *
 * O cliente só repassa o resultado, que vem de um conjunto fechado; qualquer
 * outro valor vira erro, para a tela nunca anunciar início de uma resposta
 * que não entende.
 */
import { supabase } from '@/lib/supabase';

const RESULTADOS_INICIAR = [
  'iniciada',
  // Resposta perdida, toque duplo ou início em outro aparelho: a rota já está
  // em andamento com este motorista (a RPC completa o que faltava).
  'ja_iniciada',
  // A rota foi concluída, cancelada ou não executada.
  'situacao_mudou',
  // Sem sessão, rota de outro motorista, sem vínculo ativo ou cadastro inativo.
  'sem_permissao',
] as const;

export type ResultadoIniciarRota = (typeof RESULTADOS_INICIAR)[number];

export async function iniciarRota(
  rotaId: string,
): Promise<ResultadoIniciarRota> {
  const { data, error } = await supabase.rpc('iniciar_rota', {
    p_rota_id: rotaId,
  });
  if (error) throw error;
  const resultado = RESULTADOS_INICIAR.find((valor) => valor === data);
  if (resultado === undefined) {
    throw new Error(`Resposta inesperada de iniciar_rota: ${String(data)}`);
  }
  return resultado;
}
