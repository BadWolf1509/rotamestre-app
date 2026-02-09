/**
 * RouteStatusProvider - Orchestrates route status hooks
 *
 * Simplified from original 739-line monolith into a ~100-line orchestrator.
 * Business logic lives in extracted hooks and pure calculation functions.
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

import {
  useLoadActiveRoute,
  useRouteActions,
  useRouteRealtimeSubscription,
} from '@/hooks/route-status';
import { useAuth } from '@/hooks/useAuth';
import { useUser } from '@/hooks/useUser';

import { getRouteStatus, getProgress, getCurrentStop, getNextStop } from './calculations';

import type { ParadaData, RouteData, RouteStatusContextData } from './types';

const RouteStatusContext = createContext<RouteStatusContextData>({} as RouteStatusContextData);

export function RouteStatusProvider({ children }: { children: ReactNode }) {
  const { userData, loading: userLoading } = useUser();
  const { session } = useAuth();
  const motoristaId = userData?.id;
  const [route, setRoute] = useState<RouteData | null>(null);
  const [paradas, setParadas] = useState<ParadaData[]>([]);
  const [pendingRoutesCount, setPendingRoutesCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Data loading
  const loadActiveRoute = useLoadActiveRoute({
    userLoading,
    motoristaId,
    setRoute,
    setParadas,
    setPendingRoutesCount,
    setLoading,
  });

  // Route actions (start, complete stop, skip, complete route)
  const { startRoute, completeStop, skipStop, completeRoute } = useRouteActions({
    route,
    paradas,
    userData: userData ? { id: userData.id, nome: userData.nome } : null,
    loadActiveRoute,
  });

  // Realtime subscription
  useRouteRealtimeSubscription({
    motoristaId,
    accessToken: session?.access_token,
    loadActiveRoute,
  });

  // Initial load
  useEffect(() => {
    loadActiveRoute();
  }, [loadActiveRoute]);

  return (
    <RouteStatusContext.Provider
      value={{
        routeStatus: getRouteStatus(route, paradas),
        route,
        paradas,
        currentStop: getCurrentStop(paradas),
        nextStop: getNextStop(paradas),
        progress: getProgress(paradas),
        pendingRoutesCount,
        loading,
        refreshRoute: loadActiveRoute,
        startRoute,
        completeStop,
        skipStop,
        completeRoute,
      }}
    >
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
