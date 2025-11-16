import { useState, useEffect, useRef, useCallback } from 'react';

import { useUser } from '@/hooks/useUser';
import { supabase } from '@/lib/supabase';

export interface Stats {
  total: number;
  emAndamento: number;
  concluidas: number;
  distanciaTotal: number;
  incidentesAbertos?: number;
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
  userData: any; // Incluir userData para evitar chamadas duplicadas de useUser
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

  // ✅ FIX DEFINITIVO: Usar ref para evitar recriações
  const loadingRef = useRef(false);
  const mountedRef = useRef(true);

  // ✅ FIX: useEffect com controle rigoroso para evitar loops
  useEffect(() => {
    // Cleanup ao desmontar
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    // Evitar múltiplas execuções simultâneas
    if (loadingRef.current) return;

    const loadDashboard = async () => {
      // Prevenir execução se já estiver carregando
      if (loadingRef.current || !mountedRef.current) return;

      loadingRef.current = true;

      if (!unidadeId) {
        if (mountedRef.current) {
          setStats({
            total: 0,
            emAndamento: 0,
            concluidas: 0,
            distanciaTotal: 0,
          });
          setRotas([]);
          setLoading(false);
        }
        loadingRef.current = false;
        return;
      }

      try {
        if (mountedRef.current) {
          setLoading(true);
        }

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

        // Se componente foi desmontado, parar
        if (!mountedRef.current) return;

        // Buscar paradas para cada rota (apenas entregas reais, não base)
        const rotasComDetalhes = await Promise.all(
          (rotasData || []).map(async (rota: any) => {
            const { data: paradas } = await supabase
              .from('paradas')
              .select('id, status, is_checkpoint')
              .eq('rota_id', rota.id);

            const paradasReais = (paradas || []).filter(
              (parada: any) => parada.is_checkpoint !== false
            );

            return {
              id: rota.id,
              data: rota.data,
              status: rota.status,
              motorista_nome: rota.usuarios?.nome || 'Sem motorista',
              total_paradas: paradasReais.length,
              paradas_concluidas: paradasReais.filter((p: any) => p.status === 'concluida').length,
              distancia_total: rota.distancia_total || 0,
            };
          })
        );

        // Se componente foi desmontado, parar
        if (!mountedRef.current) return;

        setRotas(rotasComDetalhes);

        // Buscar incidentes abertos da unidade
        const { data: motoristas } = await supabase
          .from('usuarios')
          .select('id')
          .eq('unidade_id', unidadeId)
          .eq('papel', 'motorista');

        let incidentesAbertos = 0;
        if (motoristas && motoristas.length > 0) {
          const motoristasIds = motoristas.map(m => m.id);
          const { count } = await supabase
            .from('incidentes')
            .select('*', { count: 'exact', head: true })
            .in('motorista_id', motoristasIds)
            .eq('status', 'aberto');

          incidentesAbertos = count || 0;
        }

        // Calcular estatísticas
        const statsData: Stats = {
          total: rotasComDetalhes.length,
          emAndamento: rotasComDetalhes.filter((r) => r.status === 'em_andamento').length,
          concluidas: rotasComDetalhes.filter((r) => r.status === 'concluida').length,
          distanciaTotal: rotasComDetalhes.reduce((sum, r) => sum + r.distancia_total, 0),
          incidentesAbertos,
        };

        if (mountedRef.current) {
          setStats(statsData);
        }
      } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
      } finally {
        if (mountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
        loadingRef.current = false;
      }
    };

    loadDashboard();
  }, [unidadeId]); // Apenas unidadeId

  // ✅ FIX: onRefresh com useCallback para evitar recriação
  const onRefresh = useCallback(async () => {
    if (loadingRef.current || !mountedRef.current) return;

    loadingRef.current = true;
    setRefreshing(true);

    try {
      if (!unidadeId) {
        setRefreshing(false);
        loadingRef.current = false;
        return;
      }

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

      if (!mountedRef.current) return;

      // Buscar paradas para cada rota
      const rotasComDetalhes = await Promise.all(
        (rotasData || []).map(async (rota: any) => {
          const { data: paradas } = await supabase
            .from('paradas')
            .select('id, status, is_checkpoint')
            .eq('rota_id', rota.id);

          const paradasReais = (paradas || []).filter(
            (parada: any) => parada.is_checkpoint !== false
          );

          return {
            id: rota.id,
            data: rota.data,
            status: rota.status,
            motorista_nome: rota.usuarios?.nome || 'Sem motorista',
            total_paradas: paradasReais.length,
            paradas_concluidas: paradasReais.filter((p: any) => p.status === 'concluida').length,
            distancia_total: rota.distancia_total || 0,
          };
        })
      );

      if (!mountedRef.current) return;

      setRotas(rotasComDetalhes);

      // Buscar incidentes abertos da unidade
      const { data: motoristas } = await supabase
        .from('usuarios')
        .select('id')
        .eq('unidade_id', unidadeId)
        .eq('papel', 'motorista');

      let incidentesAbertos = 0;
      if (motoristas && motoristas.length > 0) {
        const motoristasIds = motoristas.map(m => m.id);
        const { count } = await supabase
          .from('incidentes')
          .select('*', { count: 'exact', head: true })
          .in('motorista_id', motoristasIds)
          .eq('status', 'aberto');

        incidentesAbertos = count || 0;
      }

      // Calcular estatísticas
      const statsData: Stats = {
        total: rotasComDetalhes.length,
        emAndamento: rotasComDetalhes.filter((r) => r.status === 'em_andamento').length,
        concluidas: rotasComDetalhes.filter((r) => r.status === 'concluida').length,
        distanciaTotal: rotasComDetalhes.reduce((sum, r) => sum + r.distancia_total, 0),
        incidentesAbertos,
      };

      if (mountedRef.current) {
        setStats(statsData);
      }
    } catch (error) {
      console.error('Erro ao atualizar dashboard:', error);
    } finally {
      if (mountedRef.current) {
        setRefreshing(false);
      }
      loadingRef.current = false;
    }
  }, [unidadeId]); // Dependência estável

  // Retornar diretamente sem memoização do objeto
  // A memoização está causando problemas com dependências
  return {
    stats,
    rotas,
    loading,
    refreshing,
    onRefresh,
    userData, // Incluir userData no retorno
  };
}
