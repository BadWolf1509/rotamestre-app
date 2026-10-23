/**
 * Hook for route action operations (start, complete stop, skip, complete route)
 */

import { Platform } from 'react-native';

import type { MotivoSkip } from '@/constants/skipReasons';
import type { ParadaData, RouteData } from '@/context/route-status/types';
import { logger } from '@/lib/logger';
import {
  aplicarAcaoParada,
  criarAcaoParada,
  ehFalhaDeEnvio,
  enfileirarAcaoParada,
  lerFilaAcoesParada,
  portaParadasSupabase,
  type AcaoParada,
  type DestinoDaAcao,
  type PortaParadas,
  type ResultadoAplicacao,
} from '@/lib/motorista/filaAcoesParada';
import { isOnline } from '@/lib/offline';
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
  /** Acesso ao banco das ações de parada; os testes injetam um em memória. */
  portaParadas?: PortaParadas;
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
  portaParadas = portaParadasSupabase,
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

  // Concluir e pular passam pela fila de ações de parada
  // (`src/lib/motorista/filaAcoesParada.ts`): sem rede — ou com a rede caindo
  // no meio do envio — a ação fica guardada no aparelho e sobe sozinha quando
  // o sinal voltar, em vez de virar erro e a entrega sumir.
  const executarOuEnfileirar = async (
    acao: AcaoParada,
    rotulo: string,
  ): Promise<DestinoDaAcao> => {
    if (!(await isOnline())) {
      await enfileirarAcaoParada(acao);
      return 'na_fila';
    }

    let resultado: ResultadoAplicacao;
    try {
      resultado = await aplicarAcaoParada(acao, portaParadas);
    } catch (error) {
      if (ehFalhaDeEnvio(error)) {
        await enfileirarAcaoParada(acao);
        return 'na_fila';
      }
      logger.error(`[RouteStatus] Erro ao ${rotulo} parada`, error);
      throw error;
    }

    if (resultado.tipo === 'descartada') {
      // Mesmas sentinelas do `errorMapping`: a mensagem diz o que houve.
      throw new Error(
        resultado.motivo === 'rota_encerrada'
          ? 'ROTA_NAO_EM_ANDAMENTO: a rota não está mais em andamento'
          : 'PARADA_INDISPONIVEL: a parada foi removida ou a rota mudou de motorista',
      );
    }

    // Lê o estado fresco do banco (não o da closure) e só promove a próxima
    // quando nenhuma outra está em andamento — pular uma parada fora da vez
    // não pode deixar duas "em andamento". A entrega JÁ está gravada: falhar
    // aqui não pode virar erro na tela, ou o motorista a refaria.
    if (resultado.tipo === 'aplicada') {
      try {
        await portaParadas.avancarProxima(acao.rotaId);
      } catch (error) {
        logger.warn('[RouteStatus] Falha ao promover a próxima parada', error);
      }
    }

    await loadActiveRoute();
    return 'enviada';
  };

  // Completa parada
  const completeStop = async (
    paradaId: string,
    fotoUrl?: string,
  ): Promise<DestinoDaAcao> => {
    if (!route || route.status !== 'em_andamento' || !userData) {
      logger.warn(
        `[RouteStatus] completeStop Tentativa de concluir parada com rota em status '${route?.status}' - ignorado`,
      );
      throw new Error(
        'A rota precisa estar em andamento para concluir paradas',
      );
    }

    if (fotoUrl) {
      // Caminho legado: hoje ninguém passa URL (o upload liga a foto à
      // parada sozinho). Fica online, porque `foto_url` não entra na fila.
      const { error } = await supabase
        .from('paradas')
        .update({ foto_url: fotoUrl })
        .eq('id', paradaId);
      if (error) {
        logger.error('[RouteStatus] Erro ao concluir parada', error);
        throw error;
      }
    }

    return executarOuEnfileirar(
      criarAcaoParada({
        tipo: 'concluir',
        paradaId,
        rotaId: route.id,
        motoristaId: userData.id,
        em: new Date().toISOString(),
      }),
      'concluir',
    );
  };

  // Pula parada com motivo estruturado
  const skipStop = async (
    paradaId: string,
    motivo: MotivoSkip,
    observacoes?: string,
  ): Promise<DestinoDaAcao> => {
    if (!route || route.status !== 'em_andamento' || !userData) {
      logger.warn(
        `[RouteStatus] skipStop Tentativa de pular parada com rota em status '${route?.status}' - ignorado`,
      );
      throw new Error('A rota precisa estar em andamento para pular paradas');
    }

    return executarOuEnfileirar(
      criarAcaoParada({
        tipo: 'pular',
        paradaId,
        rotaId: route.id,
        motoristaId: userData.id,
        em: new Date().toISOString(),
        motivo,
        ...(observacoes ? { observacoes } : {}),
      }),
      'pular',
    );
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
      // Mesma sentinela da RPC: o errorMapping dá a mensagem útil.
      throw new Error(
        `ROTA_PARADAS_PENDENTES: Não é possível concluir a rota com ${pendingStops.length} parada(s) pendentes`,
      );
    }

    // Conclusão guardada sem rede ainda não chegou ao banco: a RPC recusaria
    // com "paradas pendentes", e o motorista não entenderia por quê.
    const naFila = (await lerFilaAcoesParada()).filter(
      (a) => a.rotaId === route.id,
    ).length;
    if (naFila > 0) {
      throw new Error(
        `ROTA_ENVIOS_PENDENTES: ${naFila} parada(s) aguardando envio`,
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
