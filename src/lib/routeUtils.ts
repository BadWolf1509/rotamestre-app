/**
 * Route Utilities - Funções auxiliares para manipulação de rotas
 * Usado por: mapa-rota.tsx (E2, E3, E4, E5)
 */

import { googleMapsService } from '@/lib/google';
import { supabase } from '@/lib/supabase';
import { Coordenadas } from '@/types/endereco';

interface ParadaBasica {
  id: string;
  ordem: number;
  latitude: number | null;
  longitude: number | null;
  is_checkpoint?: boolean;
}

/**
 * Recalcula a rota após modificações nas paradas
 * Mantém a ordem atual (sem otimização) e atualiza polyline, distância e tempo
 *
 * @param rotaId - ID da rota
 * @param paradas - Lista de paradas (já ordenadas)
 * @param enderecoUnidade - Coordenadas da unidade (origem e destino)
 */
export async function recalcularRota(
  rotaId: string,
  paradas: ParadaBasica[],
  enderecoUnidade: Coordenadas
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validar coordenadas da unidade (deve ser número válido, não null/undefined/NaN)
    if (
      !enderecoUnidade ||
      typeof enderecoUnidade.latitude !== 'number' ||
      typeof enderecoUnidade.longitude !== 'number' ||
      isNaN(enderecoUnidade.latitude) ||
      isNaN(enderecoUnidade.longitude)
    ) {
      console.error('[recalcularRota] Coordenadas da unidade inválidas:', enderecoUnidade);
      return {
        success: false,
        error: 'Coordenadas da unidade inválidas.',
      };
    }

    // Filtrar apenas paradas reais (is_checkpoint !== false) com coordenadas numéricas válidas
    const waypoints = paradas
      .filter((p) => {
        // Verificar se é parada real
        if (p.is_checkpoint === false) return false;
        // Verificar se tem coordenadas numéricas válidas (não null, não undefined, não NaN)
        if (typeof p.latitude !== 'number' || typeof p.longitude !== 'number') return false;
        if (isNaN(p.latitude) || isNaN(p.longitude)) return false;
        return true;
      })
      .sort((a, b) => a.ordem - b.ordem)
      .map((p) => ({
        latitude: p.latitude!,
        longitude: p.longitude!,
      }));

    console.log('[recalcularRota] Waypoints válidos:', waypoints.length, 'de', paradas.length, 'paradas');

    // Se não há waypoints, apenas atualizar com valores zerados
    if (waypoints.length === 0) {
      await supabase
        .from('rotas')
        .update({
          distancia_total: 0,
          tempo_total: 0,
          polyline: null,
        })
        .eq('id', rotaId);

      return { success: true };
    }

    // Chamar Routes API para obter nova rota (sem otimização - manter ordem)
    const resultado = await googleMapsService.getDirectionsSequential(
      enderecoUnidade,
      enderecoUnidade,
      waypoints
    );

    if (!resultado) {
      return {
        success: false,
        error: 'Não foi possível calcular a rota. Verifique os endereços.',
      };
    }

    // Atualizar rota com novos valores
    const { error: updateError } = await supabase
      .from('rotas')
      .update({
        distancia_total: resultado.distancia_total_metros / 1000, // km
        tempo_total: Math.round(resultado.duracao_total_segundos / 60), // minutos
        polyline: resultado.polyline,
      })
      .eq('id', rotaId);

    if (updateError) {
      console.error('[recalcularRota] Erro ao atualizar rota:', updateError);
      return {
        success: false,
        error: 'Erro ao salvar dados da rota.',
      };
    }

    return { success: true };
  } catch (error) {
    console.error('[recalcularRota] Erro:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao recalcular rota.',
    };
  }
}

/**
 * Reordena as paradas após exclusão ou inserção
 * Usa RPC do Supabase para executar em uma única chamada atômica
 *
 * @param paradas - Lista de paradas na nova ordem
 */
export async function reordenarParadas(
  paradas: ParadaBasica[]
): Promise<{ success: boolean; error?: string }> {
  try {
    if (paradas.length === 0) {
      return { success: true };
    }

    console.log('[reordenarParadas] Reordering', paradas.length, 'paradas via RPC');

    // Preparar arrays para a RPC
    const paradaIds = paradas.map((p) => p.id);
    const novasOrdens = paradas.map((_, idx) => idx + 1);

    // Chamar RPC que executa atomicamente
    const { data, error } = await supabase.rpc('reordenar_paradas', {
      p_parada_ids: paradaIds,
      p_novas_ordens: novasOrdens,
    });

    if (error) {
      console.error('[reordenarParadas] RPC error:', error);
      // Fallback para método sequencial se RPC não existir
      if (error.code === '42883' || error.message?.includes('does not exist')) {
        console.log('[reordenarParadas] RPC not found, using fallback');
        return reordenarParadasFallback(paradas);
      }
      return { success: false, error: 'Erro ao reordenar paradas.' };
    }

    if (data && !data.success) {
      console.error('[reordenarParadas] RPC returned error:', data.error);
      return { success: false, error: data.error || 'Erro ao reordenar paradas.' };
    }

    console.log('[reordenarParadas] Completed via RPC. Updated:', data?.updated || paradas.length);
    return { success: true };
  } catch (error) {
    console.error('[reordenarParadas] Erro:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao reordenar paradas.',
    };
  }
}

/**
 * Fallback: Reordena paradas sequencialmente (usado se RPC não existir)
 * Abordagem de duas etapas para evitar conflitos de unique constraint
 */
async function reordenarParadasFallback(
  paradas: ParadaBasica[]
): Promise<{ success: boolean; error?: string }> {
  console.log('[reordenarParadasFallback] Using sequential fallback for', paradas.length, 'paradas');

  // STEP 1: Move all paradas to temporary high values (1000+)
  for (let i = 0; i < paradas.length; i++) {
    const tempOrdem = 1000 + i;
    const { error } = await supabase
      .from('paradas')
      .update({ ordem: tempOrdem })
      .eq('id', paradas[i].id);

    if (error) {
      console.error('[reordenarParadasFallback] Error in step 1:', error);
      return { success: false, error: 'Erro ao mover paradas para valores temporários.' };
    }
  }

  // STEP 2: Assign the correct target values (1, 2, 3, ...)
  for (let i = 0; i < paradas.length; i++) {
    const targetOrdem = i + 1;
    const { error } = await supabase
      .from('paradas')
      .update({ ordem: targetOrdem })
      .eq('id', paradas[i].id);

    if (error) {
      console.error('[reordenarParadasFallback] Error in step 2:', error);
      return { success: false, error: 'Erro ao atribuir ordem correta.' };
    }
  }

  console.log('[reordenarParadasFallback] Completed');
  return { success: true };
}

/**
 * Normaliza a ordem das paradas de uma rota
 * Garante que:
 * - Ponto de partida: ordem 0
 * - Paradas reais: ordens sequenciais 1, 2, 3, 4...
 * - Ponto de chegada: ordem = total de paradas reais + 1
 *
 * Usa abordagem de duas etapas para evitar conflitos de unique constraint:
 * 1. Move todas as paradas para valores temporários altos (1000+)
 * 2. Atribui os valores corretos
 *
 * @param rotaId - ID da rota para normalizar
 */
export async function normalizarOrdemParadas(
  rotaId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[normalizarOrdemParadas] Starting for rota:', rotaId);

    // Buscar todas as paradas da rota
    const { data: todasParadas, error: fetchError } = await supabase
      .from('paradas')
      .select('id, ordem, is_checkpoint, observacoes')
      .eq('rota_id', rotaId)
      .order('ordem', { ascending: true });

    if (fetchError || !todasParadas) {
      console.error('[normalizarOrdemParadas] Fetch error:', fetchError);
      return {
        success: false,
        error: 'Erro ao buscar paradas da rota.',
      };
    }

    console.log('[normalizarOrdemParadas] Found paradas:', todasParadas.length);

    // Separar: partida (ordem 0, is_checkpoint false), chegada (is_checkpoint false, ordem > 0), paradas reais
    const partida = todasParadas.find((p) => p.is_checkpoint === false && p.ordem === 0);
    const chegada = todasParadas.find((p) => p.is_checkpoint === false && p.ordem > 0);
    const paradasReais = todasParadas
      .filter((p) => p.is_checkpoint !== false)
      .sort((a, b) => a.ordem - b.ordem);

    console.log('[normalizarOrdemParadas] Partida:', partida?.id, 'ordem:', partida?.ordem);
    console.log('[normalizarOrdemParadas] Chegada:', chegada?.id, 'ordem:', chegada?.ordem);
    console.log('[normalizarOrdemParadas] Paradas reais:', paradasReais.length);

    // Build the list of all paradas that need reordering with their target ordem
    const reorderPlan: Array<{ id: string; currentOrdem: number; targetOrdem: number }> = [];

    // Partida should be at 0
    if (partida && partida.ordem !== 0) {
      reorderPlan.push({ id: partida.id, currentOrdem: partida.ordem, targetOrdem: 0 });
    }

    // Paradas reais should be at 1, 2, 3, 4...
    for (let i = 0; i < paradasReais.length; i++) {
      const targetOrdem = i + 1;
      if (paradasReais[i].ordem !== targetOrdem) {
        reorderPlan.push({ id: paradasReais[i].id, currentOrdem: paradasReais[i].ordem, targetOrdem });
      }
    }

    // Chegada should be at paradasReais.length + 1
    if (chegada) {
      const chegadaOrdem = paradasReais.length + 1;
      if (chegada.ordem !== chegadaOrdem) {
        reorderPlan.push({ id: chegada.id, currentOrdem: chegada.ordem, targetOrdem: chegadaOrdem });
      }
    }

    // If nothing needs to be updated, we're done
    if (reorderPlan.length === 0) {
      console.log('[normalizarOrdemParadas] No changes needed');
      return { success: true };
    }

    console.log('[normalizarOrdemParadas] Reorder plan:', reorderPlan.length, 'paradas to update');

    // STEP 1: Move all paradas that need reordering to temporary high values (1000+)
    // This avoids unique constraint conflicts
    for (let i = 0; i < reorderPlan.length; i++) {
      const tempOrdem = 1000 + i;
      console.log(`[normalizarOrdemParadas] Step 1: ${reorderPlan[i].id} -> temp ${tempOrdem}`);
      const { error } = await supabase
        .from('paradas')
        .update({ ordem: tempOrdem })
        .eq('id', reorderPlan[i].id);

      if (error) {
        console.error('[normalizarOrdemParadas] Error in step 1:', error);
        return { success: false, error: 'Erro ao mover paradas para valores temporários.' };
      }
    }

    // STEP 2: Assign the correct target values
    for (const item of reorderPlan) {
      console.log(`[normalizarOrdemParadas] Step 2: ${item.id} -> ${item.targetOrdem}`);
      const { error } = await supabase
        .from('paradas')
        .update({ ordem: item.targetOrdem })
        .eq('id', item.id);

      if (error) {
        console.error('[normalizarOrdemParadas] Error in step 2:', error);
        return { success: false, error: 'Erro ao atribuir ordem correta.' };
      }
    }

    console.log('[normalizarOrdemParadas] Completed. Updated:', reorderPlan.length, 'paradas');
    return { success: true };
  } catch (error) {
    console.error('[normalizarOrdemParadas] Exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido.',
    };
  }
}

/**
 * Remove uma parada e recalcula a rota
 * 1. Deleta a parada do banco
 * 2. Reordena as paradas restantes
 * 3. Recalcula a rota
 *
 * @param paradaId - ID da parada a ser removida
 * @param rotaId - ID da rota
 * @param paradasRestantes - Paradas que ficarão (excluindo a removida)
 * @param enderecoUnidade - Coordenadas da unidade
 * @param usuarioId - ID do usuário que está removendo (para log)
 */
export async function removerParadaERecalcular(
  paradaId: string,
  rotaId: string,
  paradasRestantes: ParadaBasica[],
  enderecoUnidade: Coordenadas,
  usuarioId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Deletar a parada
    const { error: deleteError } = await supabase
      .from('paradas')
      .delete()
      .eq('id', paradaId);

    if (deleteError) {
      console.error('[removerParadaERecalcular] Erro ao deletar:', deleteError);
      return {
        success: false,
        error: 'Erro ao remover parada.',
      };
    }

    // 2. Reordenar paradas restantes
    const reordenResult = await reordenarParadas(paradasRestantes);
    if (!reordenResult.success) {
      return reordenResult;
    }

    // 3. Recalcular rota
    const recalcResult = await recalcularRota(rotaId, paradasRestantes, enderecoUnidade);
    if (!recalcResult.success) {
      return recalcResult;
    }

    // 4. Registrar log (opcional)
    if (usuarioId) {
      await supabase.from('logs').insert({
        usuario_id: usuarioId,
        rota_id: rotaId,
        evento: 'parada_removida',
        detalhes: {
          parada_id: paradaId,
          paradas_restantes: paradasRestantes.length,
        },
      });
    }

    return { success: true };
  } catch (error) {
    console.error('[removerParadaERecalcular] Erro:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido.',
    };
  }
}

/**
 * Tipos de notificação para edição de rotas
 */
export type NotificacaoRotaEditadaTipo =
  | 'rota_parada_adicionada'
  | 'rota_parada_removida'
  | 'rota_parada_editada'
  | 'rota_reordenada';

interface NotificarMotoristaParams {
  rotaId: string;
  motoristaId: string;
  tipo: NotificacaoRotaEditadaTipo;
  titulo: string;
  mensagem: string;
  paradaId?: string;
}

/**
 * Notifica o motorista sobre alterações na rota
 * Só notifica se a rota está pendente ou em andamento
 *
 * @param params - Parâmetros da notificação
 * @returns Promise com sucesso ou erro
 */
export async function notificarMotoristaRotaEditada(
  params: NotificarMotoristaParams
): Promise<{ success: boolean; error?: string }> {
  const { rotaId, motoristaId, tipo, titulo, mensagem, paradaId } = params;

  try {
    // Verificar status da rota - só notificar se pendente ou em_andamento
    const { data: rota, error: rotaError } = await supabase
      .from('rotas')
      .select('status')
      .eq('id', rotaId)
      .single();

    if (rotaError || !rota) {
      console.warn('[notificarMotoristaRotaEditada] Rota não encontrada:', rotaId);
      return { success: false, error: 'Rota não encontrada' };
    }

    // Não notificar para rotas concluídas ou canceladas
    if (rota.status !== 'pendente' && rota.status !== 'em_andamento') {
      console.log('[notificarMotoristaRotaEditada] Rota não está ativa, ignorando notificação');
      return { success: true };
    }

    // Criar notificação usando a função do banco
    const { error: notifError } = await supabase.rpc('criar_notificacao', {
      p_usuario_id: motoristaId,
      p_tipo: tipo,
      p_titulo: titulo,
      p_mensagem: mensagem,
      p_rota_id: rotaId,
      p_parada_id: paradaId || null,
      p_incidente_id: null,
    });

    if (notifError) {
      console.error('[notificarMotoristaRotaEditada] Erro ao criar notificação:', notifError);
      return { success: false, error: 'Erro ao criar notificação' };
    }

    console.log('[notificarMotoristaRotaEditada] Notificação criada:', tipo);
    return { success: true };
  } catch (error) {
    console.error('[notificarMotoristaRotaEditada] Erro:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}
