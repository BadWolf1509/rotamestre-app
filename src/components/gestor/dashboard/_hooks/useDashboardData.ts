
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

import { useRealtimeRoutes } from '@/hooks/useRealtimeRoutes';
import { useUser } from '@/hooks/useUser';
import { supabase } from '@/lib/supabase';

export interface Stats {
  total: number;
  emAndamento: number;
  concluidas: number;
  distanciaTotal: number;
  incidentesAbertos?: number;
}

export interface TodayStats {
  totalHoje: number; // Sempre reflete rotas de hoje, ignorando filtros
}

export interface RotaResumo {
  id: string;
  data: string;
  status: string;
  motorista_nome: string;
  motorista_id: string | null;
  total_paradas: number;
  paradas_concluidas: number;
  distancia_total: number;
}

export interface DashboardData {
  stats: Stats;
  todayStats: TodayStats; // ✅ Stats de hoje (ignora filtros)
  rotas: RotaResumo[];
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => Promise<void>;
  userData: any; // Incluir userData para evitar chamadas duplicadas de useUser
}

export interface UseDashboardDataOptions {
  filters?: any;
}

/**
 * Hook compartilhado para dados do dashboard
 * Usado tanto na versão mobile quanto desktop
 */
export function useDashboardData(options: UseDashboardDataOptions = {}): DashboardData {
  const { filters } = options;
  const { userData } = useUser();
  const unidadeId = userData?.unidade_id;

  const [stats, setStats] = useState<Stats>({
    total: 0,
    emAndamento: 0,
    concluidas: 0,
    distanciaTotal: 0,
  });
  const [todayStats, setTodayStats] = useState<TodayStats>({
    totalHoje: 0,
  });
  const [rotas, setRotas] = useState<RotaResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ✅ FIX DEFINITIVO: Usar ref para evitar recriações
  const loadingRef = useRef(false);
  const mountedRef = useRef(true);

  // ✅ Realtime: Escutar mudanças em rotas e paradas
  const { updateTrigger: _updateTrigger } = useRealtimeRoutes({
    enabled: !!unidadeId,
    onRouteUpdate: () => {
      // Quando houver atualização via realtime, recarregar dados
      if (!loadingRef.current && mountedRef.current) {
        onRefresh();
      }
    },
  });

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

        // Buscar rotas da unidade com filtros
        const hoje = new Date().toISOString().split('T')[0];

        let query = supabase
          .from('rotas')
          .select(`
id,
  data,
  status,
  distancia_total,
  motorista_id,
  usuarios!motorista_id(nome)
    `)
          .eq('unidade_id', unidadeId);

        // Aplicar filtros de data
        console.log('[useDashboardData] Filtros recebidos:', {
          dataInicio: filters?.dataInicio,
          dataFim: filters?.dataFim,
          status: filters?.status,
          motoristaId: filters?.motoristaId,
        });

        if (filters?.dataInicio) {
          const dataInicio = new Date(filters.dataInicio);
          // ✅ Validar se a data é válida antes de usar
          if (!isNaN(dataInicio.getTime())) {
            const dataInicioStr = dataInicio.toISOString().split('T')[0];
            console.log('[useDashboardData] Aplicando filtro dataInicio:', dataInicioStr);
            query = query.gte('data', dataInicioStr);
          }
        } else {
          // Por padrão, mostrar apenas rotas de hoje
          console.log('[useDashboardData] Usando filtro padrão (hoje):', hoje);
          query = query.gte('data', hoje);
        }

        if (filters?.dataFim) {
          const dataFim = new Date(filters.dataFim);
          // ✅ Validar se a data é válida antes de usar
          if (!isNaN(dataFim.getTime())) {
            const dataFimStr = dataFim.toISOString().split('T')[0];
            console.log('[useDashboardData] Aplicando filtro dataFim:', dataFimStr);
            query = query.lte('data', dataFimStr);
          }
        }

        // Aplicar filtro de status
        if (filters?.status) {
          query = query.eq('status', filters.status);
        }

        // Aplicar filtro de motorista
        if (filters?.motoristaId) {
          query = query.eq('motorista_id', filters.motoristaId);
        }

        query = query.order('created_at', { ascending: false });

        const { data: rotasData, error: rotasError } = await query;

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
              motorista_id: rota.motorista_id,
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

        // ✅ Buscar stats de HOJE (ignorando filtros de data)
        const queryHoje = supabase
          .from('rotas')
          .select('id, status')
          .eq('unidade_id', unidadeId)
          .gte('data', hoje);

        const { data: rotasHoje, error: errorHoje } = await queryHoje;

        if (!errorHoje && rotasHoje && mountedRef.current) {
          setTodayStats({
            totalHoje: rotasHoje.length,
          });
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
  }, [unidadeId, filters]); // unidadeId e filters

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

      // Buscar rotas da unidade com filtros
      const hoje = new Date().toISOString().split('T')[0];

      let query = supabase
        .from('rotas')
        .select(`
id,
  data,
  status,
  distancia_total,
  motorista_id,
  usuarios!motorista_id(nome)
    `)
        .eq('unidade_id', unidadeId);

      // Aplicar filtros de data
      console.log('[onRefresh] Filtros recebidos:', {
        dataInicio: filters?.dataInicio,
        dataFim: filters?.dataFim,
        status: filters?.status,
        motoristaId: filters?.motoristaId,
      });

      if (filters?.dataInicio) {
        const dataInicio = new Date(filters.dataInicio);
        // ✅ Validar se a data é válida antes de usar
        if (!isNaN(dataInicio.getTime())) {
          const dataInicioStr = dataInicio.toISOString().split('T')[0];
          console.log('[onRefresh] Aplicando filtro dataInicio:', dataInicioStr);
          query = query.gte('data', dataInicioStr);
        }
      } else {
        // Por padrão, mostrar apenas rotas de hoje
        console.log('[onRefresh] Usando filtro padrão (hoje):', hoje);
        query = query.gte('data', hoje);
      }

      if (filters?.dataFim) {
        const dataFim = new Date(filters.dataFim);
        // ✅ Validar se a data é válida antes de usar
        if (!isNaN(dataFim.getTime())) {
          const dataFimStr = dataFim.toISOString().split('T')[0];
          console.log('[onRefresh] Aplicando filtro dataFim:', dataFimStr);
          query = query.lte('data', dataFimStr);
        }
      }

      // Aplicar filtro de status
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      // Aplicar filtro de motorista
      if (filters?.motoristaId) {
        query = query.eq('motorista_id', filters.motoristaId);
      }

      query = query.order('created_at', { ascending: false });

      const { data: rotasData, error: rotasError } = await query;

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
            motorista_id: rota.motorista_id,
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

      // ✅ Buscar stats de HOJE (ignorando filtros de data)
      // Reutilizar variável 'hoje' já declarada no início da função
      const queryHoje = supabase
        .from('rotas')
        .select('id, status')
        .eq('unidade_id', unidadeId)
        .gte('data', hoje);

      const { data: rotasHoje, error: errorHoje } = await queryHoje;

      if (!errorHoje && rotasHoje && mountedRef.current) {
        setTodayStats({
          totalHoje: rotasHoje.length,
        });
      }
    } catch (error) {
      console.error('Erro ao atualizar dashboard:', error);
    } finally {
      if (mountedRef.current) {
        setRefreshing(false);
      }
      loadingRef.current = false;
    }
  }, [unidadeId, filters]); // Dependências estáveis

  // ✅ Otimização: Calcular stats usando useMemo para evitar recálculos desnecessários
  const calculatedStats = useMemo<Stats>(() => {
    if (rotas.length === 0) {
      return {
        total: 0,
        emAndamento: 0,
        concluidas: 0,
        distanciaTotal: 0,
        incidentesAbertos: stats.incidentesAbertos || 0,
      };
    }

    return {
      total: rotas.length,
      emAndamento: rotas.filter((r) => r.status === 'em_andamento').length,
      concluidas: rotas.filter((r) => r.status === 'concluida').length,
      distanciaTotal: rotas.reduce((sum, r) => sum + r.distancia_total, 0),
      incidentesAbertos: stats.incidentesAbertos || 0,
    };
  }, [rotas, stats.incidentesAbertos]);

  // Retornar diretamente sem memoização do objeto
  // A memoização está causando problemas com dependências
  return {
    stats: calculatedStats,
    todayStats, // ✅ Stats de hoje (ignora filtros)
    rotas,
    loading,
    refreshing,
    onRefresh,
    userData, // Incluir userData no retorno
  };
}
