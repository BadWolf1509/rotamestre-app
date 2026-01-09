import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

import { useRealtimeRoutes } from '@/hooks/useRealtimeRoutes';
import { useUnidadeAtiva } from '@/hooks/useUnidadeAtiva';
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
  totalHoje: number;
}

export interface KPIs {
  rotasSemana: number;
  rotasMes: number;
  taxaSucesso: number;
  tempoMedioMinutos: number;
  totalParadas: number;
  paradasConcluidas: number;
  motoristaDestaque: {
    nome: string;
    rotasConcluidas: number;
  } | null;
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
  todayStats: TodayStats;
  kpis: KPIs;
  rotas: RotaResumo[];
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => Promise<void>;
  userData: any;
}

export interface UseDashboardDataOptions {
  filters?: {
    status?: string | null;
    dataInicio?: Date | null;
    dataFim?: Date | null;
    motoristaId?: string | null;
  };
}

// ============================================================================
// HELPERS - Funções utilitárias extraídas
// ============================================================================

/**
 * Valida e formata uma data para string ISO (YYYY-MM-DD)
 */
function formatDateToISO(date: Date | null | undefined): string | null {
  if (!date) return null;
  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) return null;
  return parsed.toISOString().split('T')[0];
}

/**
 * Calcula o tempo médio de conclusão das rotas em minutos
 */
function calcularTempoMedio(rotas: any[]): number {
  let tempoTotalMinutos = 0;
  let rotasComTempo = 0;

  rotas.forEach((rota) => {
    if (rota.status === 'concluida' && rota.iniciada_em && rota.concluida_em) {
      const inicio = new Date(rota.iniciada_em);
      const fim = new Date(rota.concluida_em);
      const diffMinutos = (fim.getTime() - inicio.getTime()) / (1000 * 60);
      // Ignora tempos inválidos (negativos ou maiores que 24h)
      if (diffMinutos > 0 && diffMinutos < 1440) {
        tempoTotalMinutos += diffMinutos;
        rotasComTempo++;
      }
    }
  });

  return rotasComTempo > 0 ? Math.round(tempoTotalMinutos / rotasComTempo) : 0;
}

/**
 * Encontra o motorista com mais rotas concluídas
 */
function encontrarMotoristaDestaque(
  rotas: any[]
): { nome: string; rotasConcluidas: number } | null {
  const motoristasCount: Record<string, { nome: string; count: number }> = {};

  rotas.forEach((rota) => {
    if (rota.status === 'concluida' && rota.motorista_id) {
      const nome = rota.usuarios?.nome || 'Desconhecido';
      if (!motoristasCount[rota.motorista_id]) {
        motoristasCount[rota.motorista_id] = { nome, count: 0 };
      }
      motoristasCount[rota.motorista_id].count++;
    }
  });

  let motoristaDestaque: { nome: string; rotasConcluidas: number } | null = null;
  let maxRotas = 0;

  Object.values(motoristasCount).forEach((m) => {
    if (m.count > maxRotas) {
      maxRotas = m.count;
      motoristaDestaque = { nome: m.nome, rotasConcluidas: m.count };
    }
  });

  return motoristaDestaque;
}

/**
 * Processa os dados das rotas vindas do Supabase (com JOIN de paradas)
 */
function processarRotasComParadas(rotasData: any[]): RotaResumo[] {
  return rotasData.map((rota) => {
    // Filtra apenas paradas reais (checkpoints, não base)
    const paradasReais = (rota.paradas || []).filter(
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
  });
}

// ============================================================================
// HOOK PRINCIPAL
// ============================================================================

/**
 * Hook compartilhado para dados do dashboard
 * Usado tanto na versão mobile quanto desktop
 */
export function useDashboardData(options: UseDashboardDataOptions = {}): DashboardData {
  const { filters } = options;
  const { userData } = useUser();
  const { unidadeAtiva } = useUnidadeAtiva();
  const unidadeId = unidadeAtiva;

  // Estados
  const [stats, setStats] = useState<Stats>({
    total: 0,
    emAndamento: 0,
    concluidas: 0,
    distanciaTotal: 0,
  });
  const [todayStats, setTodayStats] = useState<TodayStats>({ totalHoje: 0 });
  const [kpis, setKpis] = useState<KPIs>({
    rotasSemana: 0,
    rotasMes: 0,
    taxaSucesso: 0,
    tempoMedioMinutos: 0,
    totalParadas: 0,
    paradasConcluidas: 0,
    motoristaDestaque: null,
  });
  const [rotas, setRotas] = useState<RotaResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Refs para controle de execução
  const loadingRef = useRef(false);
  const mountedRef = useRef(true);

  // ============================================================================
  // FUNÇÃO PRINCIPAL DE FETCH (extraída para eliminar duplicação)
  // ============================================================================
  const fetchDashboardData = useCallback(
    async (isRefresh = false) => {
      // Prevenir execução duplicada ou em componente desmontado
      if (loadingRef.current || !mountedRef.current) return;

      loadingRef.current = true;

      // Se não há unidade, limpar dados
      if (!unidadeId) {
        if (mountedRef.current) {
          setStats({ total: 0, emAndamento: 0, concluidas: 0, distanciaTotal: 0 });
          setTodayStats({ totalHoje: 0 });
          setRotas([]);
          setLoading(false);
          setRefreshing(false);
        }
        loadingRef.current = false;
        return;
      }

      try {
        if (mountedRef.current) {
          if (isRefresh) {
            setRefreshing(true);
          } else {
            setLoading(true);
          }
        }

        const hoje = new Date().toISOString().split('T')[0];

        // =====================================================================
        // QUERY OTIMIZADA: Busca rotas COM paradas em uma única query (JOIN)
        // Elimina o problema N+1 (antes: 1 + N queries, agora: 1 query)
        // =====================================================================
        let query = supabase
          .from('rotas')
          .select(`
            id,
            data,
            status,
            distancia_total,
            motorista_id,
            usuarios!motorista_id(nome),
            paradas(id, status, is_checkpoint)
          `)
          .eq('unidade_id', unidadeId);

        // Aplicar filtros de data
        const dataInicioStr = formatDateToISO(filters?.dataInicio);
        const dataFimStr = formatDateToISO(filters?.dataFim);

        if (dataInicioStr) {
          query = query.gte('data', dataInicioStr);
        } else {
          // Por padrão, mostrar apenas rotas de hoje
          query = query.gte('data', hoje);
        }

        if (dataFimStr) {
          query = query.lte('data', dataFimStr);
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

        // Processar rotas com paradas (já vieram no JOIN)
        const rotasComDetalhes = processarRotasComParadas(rotasData || []);

        setRotas(rotasComDetalhes);

        // =====================================================================
        // BUSCAR INCIDENTES ABERTOS (em paralelo com outras queries)
        // =====================================================================
        const incidentesPromise = (async () => {
          const { data: vinculacoes } = await supabase
            .from('usuario_unidades')
            .select('usuario_id')
            .eq('unidade_id', unidadeId)
            .eq('papel', 'motorista')
            .eq('ativo', true);

          if (!vinculacoes?.length) return 0;

          const motoristasIds = vinculacoes.map((v) => v.usuario_id);
          const { count } = await supabase
            .from('incidentes')
            .select('*', { count: 'exact', head: true })
            .in('motorista_id', motoristasIds)
            .eq('status', 'aberto');

          return count || 0;
        })();

        // =====================================================================
        // BUSCAR STATS DE HOJE (ignorando filtros de data)
        // =====================================================================
        const todayPromise = supabase
          .from('rotas')
          .select('id')
          .eq('unidade_id', unidadeId)
          .gte('data', hoje);

        // =====================================================================
        // BUSCAR KPIS (semana e mês) - apenas no load inicial, não no refresh
        // =====================================================================
        const agora = new Date();
        const inicioSemana = new Date(agora);
        inicioSemana.setDate(agora.getDate() - agora.getDay());
        const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);

        const kpisPromise = Promise.all([
          supabase
            .from('rotas')
            .select('id, status, iniciada_em, concluida_em, motorista_id, usuarios!motorista_id(nome)')
            .eq('unidade_id', unidadeId)
            .gte('data', inicioSemana.toISOString().split('T')[0]),
          supabase
            .from('rotas')
            .select('id, status, iniciada_em, concluida_em, motorista_id, usuarios!motorista_id(nome)')
            .eq('unidade_id', unidadeId)
            .gte('data', inicioMes.toISOString().split('T')[0]),
        ]);

        // Executar queries em paralelo
        const [incidentesAbertos, todayResult, kpisResult] = await Promise.all([
          incidentesPromise,
          todayPromise,
          kpisPromise,
        ]);

        if (!mountedRef.current) return;

        // Calcular estatísticas
        const statsData: Stats = {
          total: rotasComDetalhes.length,
          emAndamento: rotasComDetalhes.filter((r) => r.status === 'em_andamento').length,
          concluidas: rotasComDetalhes.filter((r) => r.status === 'concluida').length,
          distanciaTotal: rotasComDetalhes.reduce((sum, r) => sum + r.distancia_total, 0),
          incidentesAbertos,
        };

        setStats(statsData);

        // Stats de hoje
        if (!todayResult.error && todayResult.data) {
          setTodayStats({ totalHoje: todayResult.data.length });
        }

        // KPIs
        const [kpiSemana, kpiMes] = kpisResult;
        const rotasSemanaData = kpiSemana.data || [];
        const rotasMesData = kpiMes.data || [];

        const totalParadas = rotasComDetalhes.reduce((sum, r) => sum + r.total_paradas, 0);
        const paradasConcluidas = rotasComDetalhes.reduce((sum, r) => sum + r.paradas_concluidas, 0);
        const taxaSucesso = totalParadas > 0 ? Math.round((paradasConcluidas / totalParadas) * 100) : 0;

        setKpis({
          rotasSemana: rotasSemanaData.length,
          rotasMes: rotasMesData.length,
          taxaSucesso,
          tempoMedioMinutos: calcularTempoMedio(rotasMesData),
          totalParadas,
          paradasConcluidas,
          motoristaDestaque: encontrarMotoristaDestaque(rotasMesData),
        });
      } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
      } finally {
        if (mountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
        loadingRef.current = false;
      }
    },
    [unidadeId, filters]
  );

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Cleanup ao desmontar
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Carregar dados quando unidadeId ou filters mudam
  useEffect(() => {
    if (!loadingRef.current) {
      fetchDashboardData(false);
    }
  }, [fetchDashboardData]);

  // Realtime: Escutar mudanças em rotas e paradas
  useRealtimeRoutes({
    enabled: !!unidadeId,
    onRouteUpdate: () => {
      if (!loadingRef.current && mountedRef.current) {
        fetchDashboardData(true);
      }
    },
  });

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const onRefresh = useCallback(async () => {
    await fetchDashboardData(true);
  }, [fetchDashboardData]);

  // ============================================================================
  // MEMOIZAÇÃO
  // ============================================================================

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

  // ============================================================================
  // RETURN
  // ============================================================================

  return {
    stats: calculatedStats,
    todayStats,
    kpis,
    rotas,
    loading,
    refreshing,
    onRefresh,
    userData,
  };
}
