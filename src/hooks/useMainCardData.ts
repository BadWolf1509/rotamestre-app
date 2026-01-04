/**
 * Hook para gerenciar dados do MainCard
 * Consolida toda lógica de fetch de stats, streak, lastRoute e expiredRoute
 */

import { useCallback, useEffect, useState } from 'react';

import { RouteStatus } from '@/context/RouteStatusContext';
import { supabase } from '@/lib/supabase';

export interface MotoristaStats {
  rotasOntem: number;
  paradasOntem: number;
  distanciaOntem: number;
  rotasHoje: number;
  paradasHoje: number;
  distanciaHoje: number;
}

export interface LastRouteData {
  concluida_em: string;
  paradas_concluidas: number;
  total_paradas: number;
  distancia_km: number;
  tempo_total: string;
}

export interface ExpiredRouteData {
  rota_id: string;
  data: string;
  paradas_pendentes: number;
  total_paradas: number;
  paradas_concluidas: number;
}

interface UseMainCardDataOptions {
  motoristaId?: string;
  state: RouteStatus;
}

interface UseMainCardDataReturn {
  stats: MotoristaStats;
  streak: number;
  lastRoute: LastRouteData | null;
  expiredRoute: ExpiredRouteData | null;
  expiredRouteDismissed: boolean;
  dismissExpiredRoute: () => void;
  refresh: () => Promise<void>;
  isLoading: boolean;
}

const initialStats: MotoristaStats = {
  rotasOntem: 0,
  paradasOntem: 0,
  distanciaOntem: 0,
  rotasHoje: 0,
  paradasHoje: 0,
  distanciaHoje: 0,
};

export function useMainCardData({
  motoristaId,
  state,
}: UseMainCardDataOptions): UseMainCardDataReturn {
  const [stats, setStats] = useState<MotoristaStats>(initialStats);
  const [streak, setStreak] = useState(0);
  const [lastRoute, setLastRoute] = useState<LastRouteData | null>(null);
  const [expiredRoute, setExpiredRoute] = useState<ExpiredRouteData | null>(null);
  const [expiredRouteDismissed, setExpiredRouteDismissed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Load yesterday's stats
  const loadYesterdayStats = useCallback(async () => {
    if (!motoristaId) return;

    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get yesterday's completed routes
      const { data: rotas, error } = await supabase
        .from('rotas')
        .select('id, distancia_total')
        .eq('motorista_id', motoristaId)
        .eq('status', 'concluida')
        .gte('concluida_em', yesterday.toISOString())
        .lt('concluida_em', today.toISOString());

      if (error) throw error;

      const rotasCount = rotas?.length || 0;
      const distanciaTotal = rotas?.reduce((sum, r) => sum + (r.distancia_total || 0), 0) || 0;

      // Get yesterday's completed stops
      if (rotas && rotas.length > 0) {
        const rotaIds = rotas.map(r => r.id);
        const { data: paradas, error: paradasError } = await supabase
          .from('paradas')
          .select('id')
          .in('rota_id', rotaIds)
          .eq('status', 'concluida');

        if (!paradasError) {
          setStats(prev => ({
            ...prev,
            rotasOntem: rotasCount,
            paradasOntem: paradas?.length || 0,
            distanciaOntem: Math.round(distanciaTotal),
          }));
        }
      } else {
        setStats(prev => ({
          ...prev,
          rotasOntem: 0,
          paradasOntem: 0,
          distanciaOntem: 0,
        }));
      }
    } catch (error) {
      console.error('Error loading yesterday stats:', error);
    }
  }, [motoristaId]);

  // Load today's stats
  const loadTodayStats = useCallback(async () => {
    if (!motoristaId) return;

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get today's completed routes
      const { data: rotas, error } = await supabase
        .from('rotas')
        .select('id, distancia_total')
        .eq('motorista_id', motoristaId)
        .eq('status', 'concluida')
        .gte('concluida_em', today.toISOString());

      if (error) throw error;

      const rotasCount = rotas?.length || 0;
      const distanciaTotal = rotas?.reduce((sum, r) => sum + (r.distancia_total || 0), 0) || 0;

      // Get today's completed stops
      let paradasCount = 0;
      if (rotas && rotas.length > 0) {
        const rotaIds = rotas.map(r => r.id);
        const { data: paradas, error: paradasError } = await supabase
          .from('paradas')
          .select('id')
          .in('rota_id', rotaIds)
          .eq('status', 'concluida');

        if (!paradasError) {
          paradasCount = paradas?.length || 0;
        }
      }

      setStats(prev => ({
        ...prev,
        rotasHoje: rotasCount,
        paradasHoje: paradasCount,
        distanciaHoje: Math.round(distanciaTotal),
      }));
    } catch (error) {
      console.error('Error loading today stats:', error);
    }
  }, [motoristaId]);

  // Load streak (consecutive days with at least 1 completed route)
  const loadStreak = useCallback(async () => {
    if (!motoristaId) return;

    try {
      // Get last 30 days of completed routes
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      thirtyDaysAgo.setHours(0, 0, 0, 0);

      const { data: rotas, error } = await supabase
        .from('rotas')
        .select('concluida_em')
        .eq('motorista_id', motoristaId)
        .eq('status', 'concluida')
        .gte('concluida_em', thirtyDaysAgo.toISOString())
        .order('concluida_em', { ascending: false });

      if (error) throw error;

      // Calculate consecutive days with at least 1 route
      let currentStreak = 0;
      const checkDate = new Date();
      checkDate.setHours(0, 0, 0, 0);

      const routeDates = new Set(
        rotas?.map(r => new Date(r.concluida_em).toDateString()) || []
      );

      while (routeDates.has(checkDate.toDateString())) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      }

      setStreak(currentStreak);
    } catch (error) {
      console.error('Error loading streak:', error);
    }
  }, [motoristaId]);

  // Load last completed route of the day
  const loadLastRoute = useCallback(async () => {
    if (!motoristaId) return;

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get last completed route today
      const { data: rota, error } = await supabase
        .from('rotas')
        .select('id, concluida_em, distancia_total, tempo_total, iniciada_em')
        .eq('motorista_id', motoristaId)
        .eq('status', 'concluida')
        .gte('concluida_em', today.toISOString())
        .order('concluida_em', { ascending: false })
        .limit(1)
        .single();

      if (error || !rota) {
        setLastRoute(null);
        return;
      }

      // Get stops for this route (excluding checkpoints - departure/arrival points)
      const { data: paradasData, error: paradasError } = await supabase
        .from('paradas')
        .select('status, is_checkpoint')
        .eq('rota_id', rota.id);

      if (paradasError) {
        setLastRoute(null);
        return;
      }

      // Filter out checkpoints (is_checkpoint: false means it's a checkpoint, not a delivery)
      const deliveryStops = paradasData?.filter(p => p.is_checkpoint !== false) || [];
      const totalParadas = deliveryStops.length;
      const paradasConcluidas = deliveryStops.filter(p => p.status === 'concluida').length;

      // Calculate duration
      let tempoTotal = '--';
      if (rota.iniciada_em && rota.concluida_em) {
        const inicio = new Date(rota.iniciada_em).getTime();
        const fim = new Date(rota.concluida_em).getTime();
        const diffMs = fim - inicio;
        const diffMins = Math.floor(diffMs / 60000);
        const hours = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        if (hours > 0) {
          tempoTotal = `${hours}h ${mins}min`;
        } else {
          tempoTotal = `${mins}min`;
        }
      }

      setLastRoute({
        concluida_em: rota.concluida_em,
        paradas_concluidas: paradasConcluidas,
        total_paradas: totalParadas,
        distancia_km: Math.round(rota.distancia_total || 0),
        tempo_total: tempoTotal,
      });
    } catch (error) {
      console.error('Error loading last route:', error);
      setLastRoute(null);
    }
  }, [motoristaId]);

  // Load last expired route (within last 24h)
  const loadExpiredRoute = useCallback(async () => {
    if (!motoristaId) return;

    try {
      // Get date 24h ago
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      // Find last expired route within 24h
      const { data: rota, error } = await supabase
        .from('rotas')
        .select('id, data, updated_at')
        .eq('motorista_id', motoristaId)
        .eq('status', 'nao_executada')
        .gte('data', yesterday.toISOString().split('T')[0])
        .order('data', { ascending: false })
        .limit(1)
        .single();

      if (error || !rota) {
        setExpiredRoute(null);
        return;
      }

      // Get stops for this route
      const { data: paradasData, error: paradasError } = await supabase
        .from('paradas')
        .select('status, is_checkpoint')
        .eq('rota_id', rota.id);

      if (paradasError) {
        setExpiredRoute(null);
        return;
      }

      // Filter real stops (not checkpoints)
      const paradasReais = paradasData?.filter(p => p.is_checkpoint !== false) || [];
      const totalParadas = paradasReais.length;
      const paradasConcluidas = paradasReais.filter(p => p.status === 'concluida').length;
      const paradasPendentes = totalParadas - paradasConcluidas;

      setExpiredRoute({
        rota_id: rota.id,
        data: rota.data,
        paradas_pendentes: paradasPendentes,
        total_paradas: totalParadas,
        paradas_concluidas: paradasConcluidas,
      });
    } catch (error) {
      console.error('Error loading expired route:', error);
      setExpiredRoute(null);
    }
  }, [motoristaId]);

  // Combined refresh function
  const refresh = useCallback(async () => {
    if (!motoristaId) return;

    setIsLoading(true);
    try {
      await Promise.all([
        loadYesterdayStats(),
        loadTodayStats(),
        loadStreak(),
        loadLastRoute(),
        loadExpiredRoute(),
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [loadYesterdayStats, loadTodayStats, loadStreak, loadLastRoute, loadExpiredRoute, motoristaId]);

  // Load data based on state
  useEffect(() => {
    if (state === 'no-route' && motoristaId) {
      refresh();
    } else if (state === 'completed' && motoristaId) {
      // Also load streak when completed
      loadStreak();
    }
  }, [state, motoristaId, refresh, loadStreak]);

  const dismissExpiredRoute = useCallback(() => {
    setExpiredRouteDismissed(true);
  }, []);

  return {
    stats,
    streak,
    lastRoute,
    expiredRoute,
    expiredRouteDismissed,
    dismissExpiredRoute,
    refresh,
    isLoading,
  };
}
