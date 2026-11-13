/**
 * Hook for route action operations (start, complete stop, skip, complete route)
 */

import { useCallback } from 'react';
import { Platform } from 'react-native';

import type { MotivoSkip } from '@/constants/skipReasons';
import type { ParadaData, RouteData } from '@/context/route-status/types';
import { logger } from '@/lib/logger';
import {
  aplicarAcaoParada,
  criarAcaoParada,
  ehErroDefinitivo,
  enfileirarAcaoParada,
  lerFilaAcoesParada,
  portaParadasSupabase,
  rotuloDaParada,
  type AcaoParada,
  type DestinoDaAcao,
  type PortaParadas,
  type ResultadoAplicacao,
} from '@/lib/motorista/filaAcoesParada';
import { iniciarRota } from '@/lib/motorista/iniciarRota';
import { solicitarEnvioFila } from '@/lib/offline';
import { semRedeConfirmada } from '@/lib/semRede';
import { supabase } from '@/lib/supabase';
import {
  stopBackgroundTracking,
  requestAndStartTracking,
} from '@/services/unifiedLocationTracking';

/** Quanto o Finalizar espera o envio da fila antes de recusar. */
const TETO_ENVIO_AO_FINALIZAR_MS = 20_000;

interface UseRouteActionsOptions {
  route: RouteData | null;
  paradas: ParadaData[];
  userData: { id: string; nome?: string } | null;
  loadActiveRoute: () => Promise<void>;
  /** Acesso ao banco das ações de parada; os testes injetam um em memória. */
  portaParadas?: PortaParadas;
}

/**
 * A rota já está em andamento com este motorista? Devolve o `iniciada_em`
 * (a hora real do início, gravada pelo servidor) ou null. Só para o
 * rastreamento partir da hora certa quando a RPC responde `iniciada` ou
 * `ja_iniciada`; falha de leitura devolve null e quem chama usa a hora de
 * agora.
 */
async function lerInicioProprio(
  rotaId: string,
  motoristaId: string,
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('rotas')
      .select('status, motorista_id, iniciada_em')
      .eq('id', rotaId)
      .maybeSingle();
    if (error || !data) return null;
    const rota = data as {
      status: string;
      motorista_id: string | null;
      iniciada_em: string | null;
    };
    if (rota.status !== 'em_andamento' || rota.motorista_id !== motoristaId) {
      return null;
    }
    return rota.iniciada_em ?? new Date().toISOString();
  } catch (erro) {
    logger.warn('[RouteStatus] startRoute: falha ao reler a rota', erro);
    return null;
  }
}

// "Parada 4 — Rua X", guardado na ação para o aviso de descarte
function rotuloDe(
  paradas: ParadaData[],
  paradaId: string,
): { rotulo?: string } {
  const parada = paradas.find((p) => p.id === paradaId);
  return parada ? { rotulo: rotuloDaParada(parada) } : {};
}

export function useRouteActions({
  route,
  paradas,
  userData,
  loadActiveRoute,
  portaParadas = portaParadasSupabase,
}: UseRouteActionsOptions) {
  // Deps em primitivos: o provider monta `userData` como objeto novo a cada
  // render, e dependência por objeto refaria as ações (e o valor do contexto
  // inteiro) a cada render, re-renderizando quem só as chama.
  const motoristaId = userData?.id;
  const motoristaNome = userData?.nome;

  // Inicia rota
  const startRoute = useCallback(async () => {
    if (!route || !motoristaId) return;

    // Validar se a rota está em status pendente
    if (route.status !== 'pendente') {
      logger.warn(
        `[RouteStatus] startRoute Tentativa de iniciar rota com status '${route.status}' - ignorado`,
      );
      return;
    }

    try {
      // 1. Rota, partida e 1ª parada numa transação só, pela RPC (Migration
      // 88). A tela pode estar velha (gestor cancelou, passou a outro
      // motorista, motorista sem vínculo): a RPC confere e responde. Erro de
      // rede chega em `error` e vai para a tela (iniciar não entra na fila
      // offline).
      const resultado = await iniciarRota(route.id);

      if (resultado === 'situacao_mudou' || resultado === 'sem_permissao') {
        // O servidor respondeu e nada mudou: sem "Rota iniciada" e sem
        // rastreamento (nem o contexto dele). A recarga traz o estado real;
        // falhar nela não pode engolir o aviso.
        try {
          await loadActiveRoute();
        } catch (erroRecarga) {
          logger.warn(
            '[RouteStatus] startRoute: falha ao recarregar a rota que mudou',
            erroRecarga,
          );
        }
        throw new Error(
          'ROTA_NAO_PENDENTE: a rota não está mais pendente para este motorista',
        );
      }

      // `ja_iniciada`: resposta perdida, toque duplo ou outro aparelho — a
      // rota já está em andamento com este motorista e a RPC completou o que
      // faltava. Segue como iniciada. Nos dois casos o rastreamento parte do
      // `iniciada_em` gravado pelo servidor (now() do banco), não do relógio
      // do aparelho; sem conseguir relê-lo, usa a hora de agora.

      // 2. Iniciar rastreamento de localização em background (apenas mobile)
      if (Platform.OS !== 'web') {
        const inicio =
          (await lerInicioProprio(route.id, motoristaId)) ??
          new Date().toISOString();
        await requestAndStartTracking({
          rotaId: route.id,
          motoristaId,
          motoristaNome: motoristaNome || 'Motorista',
          startedAt: inicio,
        });
      }

      await loadActiveRoute();
    } catch (error) {
      logger.error('[RouteStatus] Erro ao iniciar rota', error);
      throw error;
    }
  }, [route, motoristaId, motoristaNome, loadActiveRoute]);

  // Concluir e pular passam pela fila de ações de parada
  // (`src/lib/motorista/filaAcoesParada.ts`): sem rede — ou com a rede caindo
  // no meio do envio — a ação fica guardada no aparelho e sobe sozinha quando
  // o sinal voltar, em vez de virar erro e a entrega sumir.
  const executarOuEnfileirar = useCallback(
    async (acao: AcaoParada, rotulo: string): Promise<DestinoDaAcao> => {
      // Só vai direto à fila com a falta de rede CONFIRMADA (modo avião ou
      // queda observada). `isOnline()` exigia `isInternetReachable === true`,
      // que vem null logo na abertura: com rede, a ação ia à fila à toa. Na
      // dúvida tenta o envio — falha de rede cai no catch e vai à fila do mesmo
      // jeito.
      if (await semRedeConfirmada()) {
        await enfileirarAcaoParada(acao);
        return 'na_fila';
      }

      let resultado: ResultadoAplicacao;
      try {
        resultado = await aplicarAcaoParada(acao, portaParadas);
      } catch (error) {
        // Só recusa definitiva aparece como erro. Rede, sessão vencida, 5xx,
        // 408/429 ou resposta sem código: guarda e envia depois.
        if (!ehErroDefinitivo(error)) {
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
            : resultado.motivo === 'status_divergente'
              ? 'PARADA_JA_RESOLVIDA: a parada já foi concluída ou pulada por outro caminho'
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
          logger.warn(
            '[RouteStatus] Falha ao promover a próxima parada',
            error,
          );
        }
      }

      await loadActiveRoute();
      // A rede respondeu: é a hora de mandar o que tenha ficado na fila antes
      // (ex.: timeout com o NetInfo dizendo "conectado").
      void solicitarEnvioFila();
      return 'enviada';
    },
    [portaParadas, loadActiveRoute],
  );

  // Completa parada
  const completeStop = useCallback(
    async (paradaId: string, fotoUrl?: string): Promise<DestinoDaAcao> => {
      if (!route || route.status !== 'em_andamento' || !motoristaId) {
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
          motoristaId,
          em: new Date().toISOString(),
          ...rotuloDe(paradas, paradaId),
        }),
        'concluir',
      );
    },
    [route, paradas, motoristaId, executarOuEnfileirar],
  );

  // Pula parada com motivo estruturado
  const skipStop = useCallback(
    async (
      paradaId: string,
      motivo: MotivoSkip,
      observacoes?: string,
    ): Promise<DestinoDaAcao> => {
      if (!route || route.status !== 'em_andamento' || !motoristaId) {
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
          motoristaId,
          em: new Date().toISOString(),
          motivo,
          ...(observacoes ? { observacoes } : {}),
          ...rotuloDe(paradas, paradaId),
        }),
        'pular',
      );
    },
    [route, paradas, motoristaId, executarOuEnfileirar],
  );

  // Finaliza rota. Uma operação só no banco (RPC `finalizar_rota`, em
  // transação): confere que a rota é do motorista e está em andamento, que não
  // há parada real pendente, e marca chegada + rota juntas. O rastreamento só
  // para DEPOIS do sucesso — antes parava primeiro, e uma falha deixava a rota
  // em andamento sem rastreamento.
  const completeRoute = useCallback(async () => {
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
    // com "paradas pendentes", e o motorista não entenderia por quê. Tenta
    // enviar antes de recusar. Só as ações DESTA conta: a fila só sobe com a
    // sessão do dono (`processarFilaAcoesParada`), então a de outra conta na
    // mesma rota nunca sairia daqui e recusaria o Finalizar para sempre.
    // Mesmo id com que `completeStop`/`skipStop` gravam o `motoristaId`.
    const contarNaFila = async () =>
      (await lerFilaAcoesParada()).filter(
        (a) => a.rotaId === route.id && a.motoristaId === motoristaId,
      ).length;
    let naFila = await contarNaFila();
    if (naFila > 0) {
      // Com teto: o envio pode incluir foto (até minutos em rede ruim), e o
      // botão não pode ficar girando. Estourou, recusa com a pendência.
      let teto: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([
        solicitarEnvioFila(),
        new Promise((r) => {
          teto = setTimeout(r, TETO_ENVIO_AO_FINALIZAR_MS);
        }),
      ]);
      clearTimeout(teto);
      naFila = await contarNaFila();
    }
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
  }, [route, paradas, motoristaId, loadActiveRoute]);

  return { startRoute, completeStop, skipStop, completeRoute };
}
