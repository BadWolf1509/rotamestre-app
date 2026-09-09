/**
 * Hook to load active route from Supabase
 *
 * Priority: em_andamento > pendente > concluída (within 1h)
 */

import { useCallback } from 'react';

import { buildRouteData } from '@/context/route-status/calculations';
import type { ParadaData, RouteData } from '@/context/route-status/types';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

interface UseLoadActiveRouteOptions {
  userLoading: boolean;
  motoristaId: string | undefined;
  setRoute: (route: RouteData | null) => void;
  setParadas: (paradas: ParadaData[]) => void;
  setPendingRoutesCount: (count: number) => void;
  setLoading: (loading: boolean) => void;
}

export function useLoadActiveRoute({
  userLoading,
  motoristaId,
  setRoute,
  setParadas,
  setPendingRoutesCount,
  setLoading,
}: UseLoadActiveRouteOptions) {
  const loadActiveRoute = useCallback(async () => {
    // Aguardar carregamento completo do userData antes de fazer queries
    if (userLoading || !motoristaId) {
      if (!userLoading && !motoristaId) {
        setRoute(null);
        setParadas([]);
        setPendingRoutesCount(0);
        setLoading(false);
      }
      return;
    }

    try {
      setLoading(true);

      // ========================================
      // QUERY 1: Buscar rotas ATIVAS primeiro
      // (pendente ou em_andamento)
      // ========================================
      const { data: rotasAtivas, error: errorAtivas } = await supabase
        .from('rotas')
        .select(
          `
          id,
          status,
          distancia_total,
          tempo_total,
          polyline,
          iniciada_em,
          concluida_em,
          created_at,
          data,
          unidades (nome)
        `,
        )
        .eq('motorista_id', motoristaId)
        .in('status', ['pendente', 'em_andamento'])
        .order('data', { ascending: true })
        .order('created_at', { ascending: true })
        .limit(10);

      if (errorAtivas) {
        logger.error('[RouteStatus] Erro ao buscar rotas ativas', errorAtivas);
        setRoute(null);
        setParadas([]);
        setPendingRoutesCount(0);
        setLoading(false);
        return;
      }

      // Se tem rotas ativas, usa a de maior prioridade
      if (rotasAtivas && rotasAtivas.length > 0) {
        // Prioridade: em_andamento > pendente (por data ASC)
        const inProgressRoute = rotasAtivas.find(
          (r) => r.status === 'em_andamento',
        );
        const pendingRoutes = rotasAtivas.filter(
          (r) => r.status === 'pendente',
        );
        const selectedRoute = inProgressRoute || pendingRoutes[0];

        // Contar outras rotas pendentes (excluindo a selecionada)
        const otherPendingCount = inProgressRoute
          ? pendingRoutes.length
          : Math.max(0, pendingRoutes.length - 1);

        setPendingRoutesCount(otherPendingCount);
        setRoute(buildRouteData(selectedRoute));

        // Carrega paradas da rota selecionada
        const { data: paradasData } = await supabase
          .from('paradas')
          .select('*')
          .eq('rota_id', selectedRoute.id)
          .order('ordem');

        setParadas(paradasData || []);
        setLoading(false);
        return;
      }

      // ========================================
      // QUERY 2: Se NÃO tem rotas ativas,
      // buscar última rota concluída (para celebração)
      // ========================================
      setPendingRoutesCount(0);

      // Timeout de celebração: 1 hora
      const umaHoraAtras = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      const { data: rotaConcluida, error: errorConcluida } = await supabase
        .from('rotas')
        .select(
          `
          id,
          status,
          distancia_total,
          tempo_total,
          polyline,
          iniciada_em,
          concluida_em,
          created_at,
          data,
          unidades (nome)
        `,
        )
        .eq('motorista_id', motoristaId)
        .eq('status', 'concluida')
        .gte('concluida_em', umaHoraAtras)
        .order('concluida_em', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (errorConcluida) {
        logger.error(
          '[RouteStatus] Erro ao buscar rota concluída',
          errorConcluida,
        );
        setRoute(null);
        setParadas([]);
        setLoading(false);
        return;
      }

      // Se tem rota concluída recente, mostra ela
      if (rotaConcluida) {
        setRoute(buildRouteData(rotaConcluida));

        const { data: paradasData } = await supabase
          .from('paradas')
          .select('*')
          .eq('rota_id', rotaConcluida.id)
          .order('ordem');

        setParadas(paradasData || []);
        setLoading(false);
        return;
      }

      // Sem rotas ativas nem concluídas recentes
      setRoute(null);
      setParadas([]);
    } catch (error) {
      logger.error('[RouteStatus] Erro ao carregar rota', error);
      setRoute(null);
      setParadas([]);
    } finally {
      setLoading(false);
    }
  }, [
    userLoading,
    motoristaId,
    setRoute,
    setParadas,
    setPendingRoutesCount,
    setLoading,
  ]);

  return loadActiveRoute;
}
