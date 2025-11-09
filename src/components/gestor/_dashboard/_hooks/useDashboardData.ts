import { useState, useEffect, useCallback } from 'react';

import { useUser } from '@/hooks/useUser';
import { supabase } from '@/lib/supabase';

export interface Stats {
  total: number;
  emAndamento: number;
  concluidas: number;
  distanciaTotal: number;
}

export interface RotaResumo {
  id: string;
  data: string;
  status: string;
  motorista_nome: string;
  total_paradas: number;
  paradas_concluidas: number;
  distancia_total: number;
}

export interface DashboardData {
  stats: Stats;
  rotas: RotaResumo[];
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => Promise<void>;
}

/**
 * Hook compartilhado para dados do dashboard
 * Usado tanto na versão mobile quanto desktop
 */
export function useDashboardData(): DashboardData {
  const { userData } = useUser();
  const unidadeId = userData?.unidade_id;
  const [stats, setStats] = useState<Stats>({
    total: 0,
    emAndamento: 0,
    concluidas: 0,
    distanciaTotal: 0,
  });
  const [rotas, setRotas] = useState<RotaResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboard = useCallback(async () => {
    if (!unidadeId) {
      setStats({
        total: 0,
        emAndamento: 0,
        concluidas: 0,
        distanciaTotal: 0,
      });
      setRotas([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setLoading(true);

      // Buscar rotas da unidade (hoje)
      const hoje = new Date().toISOString().split('T')[0];

      const { data: rotasData, error: rotasError } = await supabase
        .from('rotas')
        .select(`
          id,
          data,
          status,
          distancia_total,
          usuarios!motorista_id (nome)
        `)
        .eq('unidade_id', unidadeId)
        .gte('data', hoje)
        .order('created_at', { ascending: false });

      if (rotasError) throw rotasError;

      // Buscar paradas para cada rota (apenas entregas reais, não base)
      const rotasComDetalhes = await Promise.all(
        (rotasData || []).map(async (rota: any) => {
          const { data: paradas } = await supabase
            .from('paradas')
            .select('id, status')
            .eq('rota_id', rota.id)
            .eq('is_checkpoint', true); // Filtra apenas entregas reais

          return {
            id: rota.id,
            data: rota.data,
            status: rota.status,
            motorista_nome: rota.usuarios?.nome || 'Sem motorista',
            total_paradas: paradas?.length || 0,
            paradas_concluidas: paradas?.filter((p: any) => p.status === 'concluida').length || 0,
            distancia_total: rota.distancia_total || 0,
          };
        })
      );

      setRotas(rotasComDetalhes);

      // Calcular estatísticas
      const statsData: Stats = {
        total: rotasComDetalhes.length,
        emAndamento: rotasComDetalhes.filter((r) => r.status === 'em_andamento').length,
        concluidas: rotasComDetalhes.filter((r) => r.status === 'concluida').length,
        distanciaTotal: rotasComDetalhes.reduce((sum, r) => sum + r.distancia_total, 0),
      };

      setStats(statsData);
    } catch (error) {
      console.error('Erro ao carregar dashboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [unidadeId]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDashboard();
  }, [loadDashboard]);

  return {
    stats,
    rotas,
    loading,
    refreshing,
    onRefresh,
  };
}
