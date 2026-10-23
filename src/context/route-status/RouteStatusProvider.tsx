/**
 * RouteStatusProvider - Orchestrates route status hooks
 *
 * Simplified from original 739-line monolith into a ~100-line orchestrator.
 * Business logic lives in extracted hooks and pure calculation functions.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  ReactNode,
} from 'react';

import {
  useGarantirRastreamentoDaRota,
  useLoadActiveRoute,
  useRouteActions,
  useRouteRealtimeSubscription,
} from '@/hooks/route-status';
import { useAuth } from '@/hooks/useAuth';
import { useUser } from '@/hooks/useUser';

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
    paradas,
    pendingRoutesCount,
    loading,
    error,
    atualizadoEm,
    loadActiveRoute,
  } = useLoadActiveRoute({ userLoading, motoristaId });

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
      refreshRoute: loadActiveRoute,
      startRoute,
      completeStop,
      skipStop,
      completeRoute,
      rastreamentoSegundoPlano,
    }),
    [
      route,
      paradas,
      pendingRoutesCount,
      loading,
      error,
      atualizadoEm,
      loadActiveRoute,
      startRoute,
      completeStop,
      skipStop,
      completeRoute,
      rastreamentoSegundoPlano,
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
