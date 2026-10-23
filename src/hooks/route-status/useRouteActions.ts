/**
 * Hook for route action operations (start, complete stop, skip, complete route)
 */

import { Platform } from 'react-native';

import type { MotivoSkip } from '@/constants/skipReasons';
import type {
  ParadaData,
  ParadaUpdateData,
  RouteData,
} from '@/context/route-status/types';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import {
  stopBackgroundTracking,
  requestAndStartTracking,
} from '@/services/unifiedLocationTracking';

interface UseRouteActionsOptions {
  route: RouteData | null;
  paradas: ParadaData[];
  userData: { id: string; nome?: string } | null;
  loadActiveRoute: () => Promise<void>;
}

/**
 * Marca a próxima parada pendente como "em_andamento"
 * Encontra a parada com menor ordem que ainda está pendente
 */
async function marcarProximaParadaEmAndamento(paradasAtuais: ParadaData[]) {
  const proximaPendente = paradasAtuais
    .filter((p) => p.status === 'pendente' && p.is_checkpoint !== false)
    .sort((a, b) => a.ordem - b.ordem)[0];

  if (proximaPendente) {
    const { error } = await supabase
      .from('paradas')
      .update({ status: 'em_andamento' })
      .eq('id', proximaPendente.id);

    if (error) {
      logger.error('[RouteStatus] marcarProximaParadaEmAndamento Erro', error);
      throw error;
    }
  }
}

export function useRouteActions({
  route,
  paradas,
  userData,
  loadActiveRoute,
}: UseRouteActionsOptions) {
  // Inicia rota
  const startRoute = async () => {
    if (!route || !userData) return;

    // Validar se a rota está em status pendente
    if (route.status !== 'pendente') {
      logger.warn(
        `[RouteStatus] startRoute Tentativa de iniciar rota com status '${route.status}' - ignorado`,
      );
      return;
    }

    try {
      const now = new Date().toISOString();

      // 1. Atualizar status da rota
      const { error } = await supabase
        .from('rotas')
        .update({
          status: 'em_andamento',
          iniciada_em: now,
        })
        .eq('id', route.id);

      if (error) throw error;

      // 2. Marcar ponto de partida (ordem 0) como concluído
      const checkpointPartida = paradas.find(
        (p) => p.is_checkpoint === false && p.ordem === 0,
      );
      if (checkpointPartida) {
        const { error: checkpointError } = await supabase
          .from('paradas')
          .update({
            status: 'concluida',
            concluida_em: now,
          })
          .eq('id', checkpointPartida.id);

        if (checkpointError) throw checkpointError;
      }

      // 3. Marcar primeira parada real como "em_andamento"
      await marcarProximaParadaEmAndamento(paradas);

      // 4. Iniciar rastreamento de localização em background (apenas mobile)
      if (Platform.OS !== 'web') {
        await requestAndStartTracking({
          rotaId: route.id,
          motoristaId: userData.id,
          motoristaNome: userData.nome || 'Motorista',
          startedAt: now,
        });
      }

      await loadActiveRoute();
    } catch (error) {
      logger.error('[RouteStatus] Erro ao iniciar rota', error);
      throw error;
    }
  };

  // Completa parada
  const completeStop = async (paradaId: string, fotoUrl?: string) => {
    if (!route || route.status !== 'em_andamento') {
      logger.warn(
        `[RouteStatus] completeStop Tentativa de concluir parada com rota em status '${route?.status}' - ignorado`,
      );
      throw new Error(
        'A rota precisa estar em andamento para concluir paradas',
      );
    }

    try {
      const updateData: ParadaUpdateData = {
        status: 'concluida',
        concluida_em: new Date().toISOString(),
        ...(fotoUrl && { foto_url: fotoUrl }),
      };

      const { error } = await supabase
        .from('paradas')
        .update(updateData)
        .eq('id', paradaId);

      if (error) throw error;

      // Fetch fresh paradas from DB to avoid stale closure race condition
      const { data: freshParadas } = await supabase
        .from('paradas')
        .select('id, status, ordem, is_checkpoint')
        .eq('rota_id', route.id)
        .order('ordem');

      if (freshParadas) {
        await marcarProximaParadaEmAndamento(freshParadas as ParadaData[]);
      }

      await loadActiveRoute();
    } catch (error) {
      logger.error('[RouteStatus] Erro ao concluir parada', error);
      throw error;
    }
  };

  // Pula parada com motivo estruturado
  const skipStop = async (
    paradaId: string,
    motivo: MotivoSkip,
    observacoes?: string,
  ) => {
    if (!route || route.status !== 'em_andamento') {
      logger.warn(
        `[RouteStatus] skipStop Tentativa de pular parada com rota em status '${route?.status}' - ignorado`,
      );
      throw new Error('A rota precisa estar em andamento para pular paradas');
    }

    try {
      const { error } = await supabase
        .from('paradas')
        .update({
          status: 'pulada',
          motivo_skip: motivo,
          ...(observacoes && { observacoes }),
        })
        .eq('id', paradaId);

      if (error) throw error;

      // Fetch fresh paradas from DB to avoid stale closure race condition
      const { data: freshParadas } = await supabase
        .from('paradas')
        .select('id, status, ordem, is_checkpoint')
        .eq('rota_id', route.id)
        .order('ordem');

      if (freshParadas) {
        await marcarProximaParadaEmAndamento(freshParadas as ParadaData[]);
      }

      await loadActiveRoute();
    } catch (error) {
      logger.error('[RouteStatus] Erro ao pular parada', error);
      throw error;
    }
  };

  // Finaliza rota. Uma operação só no banco (RPC `finalizar_rota`, em
  // transação): confere que a rota é do motorista e está em andamento, que não
  // há parada real pendente, e marca chegada + rota juntas. O rastreamento só
  // para DEPOIS do sucesso — antes parava primeiro, e uma falha deixava a rota
  // em andamento sem rastreamento.
  const completeRoute = async () => {
    if (!route) return;

    // Atalho de UX: o banco confere de novo, isto só evita a ida e volta.
    const pendingStops = paradas.filter(
      (p) =>
        p.is_checkpoint !== false &&
        (p.status === 'pendente' || p.status === 'em_andamento'),
    );
    if (pendingStops.length > 0) {
      throw new Error(
        `Não é possível concluir a rota com ${pendingStops.length} parada(s) pendentes`,
      );
    }

    try {
      const { error } = await supabase.rpc('finalizar_rota', {
        p_rota_id: route.id,
      });
      if (error) throw error;
    } catch (error) {
      logger.error('[RouteStatus] Erro ao concluir rota', error);
      throw error;
    }

    // A rota já está concluída no banco: falhar aqui não pode desfazê-la.
    if (Platform.OS !== 'web') {
      try {
        await stopBackgroundTracking();
      } catch (error) {
        logger.warn(
          '[RouteStatus] Rota concluída, mas o rastreamento não parou',
          error,
        );
      }
    }

    await loadActiveRoute();
  };

  return { startRoute, completeStop, skipStop, completeRoute };
}
