/**
 * RouteStatusProvider - Orchestrates route status hooks
 *
 * Simplified from original 739-line monolith into a ~100-line orchestrator.
 * Business logic lives in extracted hooks and pure calculation functions.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  ReactNode,
} from 'react';
import { AppState } from 'react-native';

import { useFilaAcoesParada } from '@/hooks/motorista/useFilaAcoesParada';
import {
  useGarantirRastreamentoDaRota,
  useLoadActiveRoute,
  useRouteActions,
  useRouteRealtimeSubscription,
} from '@/hooks/route-status';
import { useAuth } from '@/hooks/useAuth';
import { useUser } from '@/hooks/useUser';
import { logger } from '@/lib/logger';
import { sobreporAcoesPendentes } from '@/lib/motorista/filaAcoesParada';
import { solicitarEnvioFila } from '@/lib/offline';

import {
  getRouteStatus,
  getProgress,
  getCurrentStop,
  getNextStop,
} from './calculations';

import type { RouteStatusContextData } from './types';

const RouteStatusContext = createContext<RouteStatusContextData>(
  {} as RouteStatusContextData,
);

export function RouteStatusProvider({ children }: { children: ReactNode }) {
  const { userData, loading: userLoading } = useUser();
  const { session } = useAuth();
  const motoristaId = userData?.id;

  // Data loading: o hook é dono do estado (erro preserva, recarga silenciosa)
  const {
    route,
    paradas: paradasDoBanco,
    pendingRoutesCount,
    loading,
    error,
    atualizadoEm,
    loadActiveRoute,
  } = useLoadActiveRoute({ userLoading, motoristaId });

  // Concluir/pular feitos sem rede ficam na fila do aparelho
  // (`src/lib/motorista/filaAcoesParada.ts`). A tela já os mostra resolvidos
  // (o motorista segue para a próxima) e sabe quais ainda não subiram.
  const filaDeAcoes = useFilaAcoesParada(motoristaId);
  const { paradas, pendentes: paradasComEnvioPendente } = useMemo(
    () => sobreporAcoesPendentes(paradasDoBanco, filaDeAcoes.acoes, route?.id),
    [paradasDoBanco, filaDeAcoes.acoes, route?.id],
  );

  // Envio do que ficou no aparelho (fotos antes das ações, sempre pelo mesmo
  // caminho, `solicitarEnvioFila`): ao abrir o app/entrar na conta e ao voltar
  // ao primeiro plano. A volta da rede fica com `setupOfflineSync`.
  const enviarFila = useCallback(() => {
    solicitarEnvioFila().catch((e) =>
      logger.warn('[RouteStatus] Falha ao enviar a fila de paradas', e),
    );
  }, []);
  useEffect(() => {
    if (!motoristaId) return;
    enviarFila();
    const assinatura = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') enviarFila();
    });
    return () => assinatura.remove();
  }, [motoristaId, enviarFila]);

  // Puxar para atualizar também tenta enviar (sem esperar: foto pode demorar;
  // quando a fila encolher, o efeito abaixo recarrega).
  const atualizarRota = useCallback(async () => {
    enviarFila();
    await loadActiveRoute();
  }, [enviarFila, loadActiveRoute]);

  // A fila encolheu (enviada ou descartada): o banco mudou, recarrega.
  const tamanhoAnteriorDaFila = useRef(filaDeAcoes.acoes.length);
  useEffect(() => {
    const anterior = tamanhoAnteriorDaFila.current;
    tamanhoAnteriorDaFila.current = filaDeAcoes.acoes.length;
    if (filaDeAcoes.acoes.length < anterior) void loadActiveRoute();
  }, [filaDeAcoes.acoes.length, loadActiveRoute]);

  // Route actions (start, complete stop, skip, complete route)
  const { startRoute, completeStop, skipStop, completeRoute } = useRouteActions(
    {
      route,
      paradas,
      userData: userData ? { id: userData.id, nome: userData.nome } : null,
      loadActiveRoute,
    },
  );

  // Religa o rastreamento em segundo plano que uma reinstalação apagou
  const rastreamentoSegundoPlano = useGarantirRastreamentoDaRota({
    route,
    motorista: userData ? { id: userData.id, nome: userData.nome } : null,
  });

  // Realtime subscription
  useRouteRealtimeSubscription({
    motoristaId,
    rotaId: route?.id,
    accessToken: session?.access_token,
    loadActiveRoute,
  });

  // Initial load
  useEffect(() => {
    loadActiveRoute();
  }, [loadActiveRoute]);

  const contextValue = useMemo<RouteStatusContextData>(
    () => ({
      routeStatus: getRouteStatus(route, paradas),
      route,
      paradas,
      currentStop: getCurrentStop(paradas),
      nextStop: getNextStop(paradas),
      progress: getProgress(paradas),
      pendingRoutesCount,
      loading,
      error,
      atualizadoEm,
      refreshRoute: atualizarRota,
      startRoute,
      completeStop,
      skipStop,
      completeRoute,
      rastreamentoSegundoPlano,
      paradasComEnvioPendente,
      avisosDeEnvio: filaDeAcoes.descartes,
      dispensarAvisosDeEnvio: filaDeAcoes.dispensarDescartes,
    }),
    [
      route,
      paradas,
      pendingRoutesCount,
      loading,
      error,
      atualizadoEm,
      atualizarRota,
      startRoute,
      completeStop,
      skipStop,
      completeRoute,
      rastreamentoSegundoPlano,
      paradasComEnvioPendente,
      filaDeAcoes.descartes,
      filaDeAcoes.dispensarDescartes,
    ],
  );

  return (
    <RouteStatusContext.Provider value={contextValue}>
      {children}
    </RouteStatusContext.Provider>
  );
}

export function useRouteStatus() {
  const context = useContext(RouteStatusContext);

  if (!context) {
    throw new Error('useRouteStatus must be used within RouteStatusProvider');
  }

  return context;
}
