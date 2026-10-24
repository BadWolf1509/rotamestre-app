/**
 * Alterar paradas à mão (adicionar, remover, editar, reordenar) desfaz a
 * otimização da rota. Este helper grava essa mudança em `rotas.otimizacao_estado`
 * para adicionar, remover e editar, como a reordenação já fazia.
 *
 * O UPDATE é condicionado a `otimizacao_estado = 'otimizada'`:
 * - rota sem registro (NULL, criada antes da feature) continua sem registro: não
 *   inventamos o passado dela;
 * - rota já `otimizada_alterada` não é regravada;
 * - quem chama não precisa conhecer o estado da rota, que na tela pode estar
 *   velho (outro gestor mexeu, o realtime ainda não chegou).
 *
 * Nunca lança: quando isto roda a parada já foi alterada no banco, e a marcação
 * é auditoria. Falha vai para `logger.error` (o `warn` só aparece em __DEV__ e
 * sumiria em produção).
 */

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

/** @returns true se a rota estava otimizada e foi marcada como alterada. */
export async function marcarOtimizacaoAlterada(
  rotaId: string,
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('rotas')
      .update({ otimizacao_estado: 'otimizada_alterada' })
      .eq('id', rotaId)
      .eq('otimizacao_estado', 'otimizada')
      .select('id');

    if (error) throw error;
    return (data?.length ?? 0) > 0;
  } catch (err) {
    logger.error(
      '[otimizacaoRota] Falha ao marcar a otimização como alterada',
      err,
    );
    return false;
  }
}
