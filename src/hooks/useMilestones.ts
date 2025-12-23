/**
 * Hook para calcular milestones em tempo real
 * Calcula progresso baseado em histórico de entregas do motorista
 */

import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

// Milestones disponíveis
const MILESTONES = [10, 25, 50, 100, 250, 500, 1000] as const;

export interface MilestoneData {
  totalEntregas: number;
  currentMilestone: number | null; // Milestone atual alcançado
  nextMilestone: number | null; // Próximo milestone a alcançar
  progress: number; // Progresso para o próximo (0-100)
  remaining: number; // Quantas faltam para o próximo
  isLoading: boolean;
  error: string | null;
  // Dados adicionais
  weeklyData: WeeklyData[];
  averagePerDay: number;
  bestDay: number;
  totalRotas: number;
}

export interface WeeklyData {
  day: string; // Ex: "Seg", "Ter"
  date: string; // Ex: "2025-12-15"
  entregas: number;
  rotas: number;
}

interface UseMilestonesOptions {
  motoristaId?: string;
  enabled?: boolean;
}

export function useMilestones(options: UseMilestonesOptions = {}): MilestoneData {
  const { motoristaId, enabled = true } = options;

  const [data, setData] = useState<MilestoneData>({
    totalEntregas: 0,
    currentMilestone: null,
    nextMilestone: MILESTONES[0],
    progress: 0,
    remaining: MILESTONES[0],
    isLoading: true,
    error: null,
    weeklyData: [],
    averagePerDay: 0,
    bestDay: 0,
    totalRotas: 0,
  });

  const loadMilestoneData = useCallback(async () => {
    if (!motoristaId || !enabled) {
      setData(prev => ({ ...prev, isLoading: false }));
      return;
    }

    try {
      setData(prev => ({ ...prev, isLoading: true, error: null }));

      // 1. Buscar total de entregas (paradas concluídas) do motorista
      const { data: rotasConcluidas, error: rotasError } = await supabase
        .from('rotas')
        .select('id')
        .eq('motorista_id', motoristaId)
        .eq('status', 'concluida');

      if (rotasError) throw rotasError;

      let totalEntregas = 0;
      const totalRotas = rotasConcluidas?.length || 0;

      if (rotasConcluidas && rotasConcluidas.length > 0) {
        const rotaIds = rotasConcluidas.map(r => r.id);
        // IMPORTANTE: .neq('is_checkpoint', false) não funciona em PostgreSQL
        // porque NULL != false retorna NULL (não true), excluindo entregas reais
        // Usamos .or() para pegar is_checkpoint IS NULL ou is_checkpoint = true
        const { count, error: paradasError } = await supabase
          .from('paradas')
          .select('id', { count: 'exact', head: true })
          .in('rota_id', rotaIds)
          .eq('status', 'concluida')
          .or('is_checkpoint.is.null,is_checkpoint.eq.true');

        if (paradasError) throw paradasError;
        totalEntregas = count || 0;
      }

      // 2. Calcular milestone atual e próximo
      let currentMilestone: number | null = null;
      let nextMilestone: number | null = null;

      for (const milestone of MILESTONES) {
        if (totalEntregas >= milestone) {
          currentMilestone = milestone;
        } else {
          nextMilestone = milestone;
          break;
        }
      }

      // Se passou de todos os milestones
      if (totalEntregas >= MILESTONES[MILESTONES.length - 1]) {
        nextMilestone = null;
      }

      // 3. Calcular progresso
      let progress = 0;
      let remaining = 0;

      if (nextMilestone) {
        const previousMilestone = currentMilestone || 0;
        const range = nextMilestone - previousMilestone;
        const achieved = totalEntregas - previousMilestone;
        progress = Math.round((achieved / range) * 100);
        remaining = nextMilestone - totalEntregas;
      } else {
        progress = 100;
        remaining = 0;
      }

      // 4. Buscar dados dos últimos 7 dias
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      sevenDaysAgo.setHours(0, 0, 0, 0);

      const { data: rotasRecentes, error: recentError } = await supabase
        .from('rotas')
        .select('id, concluida_em')
        .eq('motorista_id', motoristaId)
        .eq('status', 'concluida')
        .gte('concluida_em', sevenDaysAgo.toISOString())
        .order('concluida_em', { ascending: true });

      if (recentError) throw recentError;

      // Agrupar por dia
      const dailyMap = new Map<string, { entregas: number; rotas: number }>();
      const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

      // Inicializar os 7 dias
      for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i));
        const dateStr = date.toISOString().split('T')[0];
        dailyMap.set(dateStr, { entregas: 0, rotas: 0 });
      }

      // Contar rotas por dia
      if (rotasRecentes) {
        for (const rota of rotasRecentes) {
          const dateStr = new Date(rota.concluida_em).toISOString().split('T')[0];
          if (dailyMap.has(dateStr)) {
            const current = dailyMap.get(dateStr)!;
            current.rotas += 1;
          }
        }

        // Contar entregas por rota
        if (rotasRecentes.length > 0) {
          const rotaIds = rotasRecentes.map(r => r.id);
          // Mesma correção: usar .or() ao invés de .neq() para filtrar checkpoints
          const { data: paradasRecentes } = await supabase
            .from('paradas')
            .select('rota_id')
            .in('rota_id', rotaIds)
            .eq('status', 'concluida')
            .or('is_checkpoint.is.null,is_checkpoint.eq.true');

          if (paradasRecentes) {
            // Mapear paradas por rota
            const paradasPorRota = new Map<string, number>();
            for (const p of paradasRecentes) {
              paradasPorRota.set(p.rota_id, (paradasPorRota.get(p.rota_id) || 0) + 1);
            }

            // Atribuir entregas ao dia correto
            for (const rota of rotasRecentes) {
              const dateStr = new Date(rota.concluida_em).toISOString().split('T')[0];
              if (dailyMap.has(dateStr)) {
                const current = dailyMap.get(dateStr)!;
                current.entregas += paradasPorRota.get(rota.id) || 0;
              }
            }
          }
        }
      }

      // Converter para array
      const weeklyData: WeeklyData[] = [];
      dailyMap.forEach((value, dateStr) => {
        const date = new Date(dateStr + 'T12:00:00');
        weeklyData.push({
          day: dayNames[date.getDay()],
          date: dateStr,
          entregas: value.entregas,
          rotas: value.rotas,
        });
      });

      // 5. Calcular médias
      const totalEntregasSemana = weeklyData.reduce((sum, d) => sum + d.entregas, 0);
      const diasComAtividade = weeklyData.filter(d => d.entregas > 0).length;
      const averagePerDay = diasComAtividade > 0
        ? Math.round(totalEntregasSemana / diasComAtividade)
        : 0;
      const bestDay = Math.max(...weeklyData.map(d => d.entregas));

      setData({
        totalEntregas,
        currentMilestone,
        nextMilestone,
        progress,
        remaining,
        isLoading: false,
        error: null,
        weeklyData,
        averagePerDay,
        bestDay,
        totalRotas,
      });
    } catch (error) {
      console.error('Error loading milestone data:', error);
      setData(prev => ({
        ...prev,
        isLoading: false,
        error: 'Erro ao carregar dados',
      }));
    }
  }, [motoristaId, enabled]);

  useEffect(() => {
    loadMilestoneData();
  }, [loadMilestoneData]);

  return data;
}

/**
 * Verifica se um milestone foi recém-alcançado
 * Útil para mostrar celebração quando atinge um marco
 */
export function checkNewMilestone(
  previousTotal: number,
  currentTotal: number
): number | null {
  for (const milestone of MILESTONES) {
    if (previousTotal < milestone && currentTotal >= milestone) {
      return milestone;
    }
  }
  return null;
}

/**
 * Retorna texto descritivo do progresso
 */
export function getMilestoneProgressText(data: MilestoneData): string {
  if (data.isLoading) return 'Carregando...';
  if (data.error) return 'Erro ao carregar';
  if (!data.nextMilestone) return `${data.totalEntregas} entregas - Mestre!`;
  return `${data.totalEntregas}/${data.nextMilestone} entregas`;
}

/**
 * Retorna cor baseada no progresso
 */
export function getMilestoneColor(progress: number): 'warning' | 'primary' | 'success' {
  if (progress >= 90) return 'success';
  if (progress >= 50) return 'primary';
  return 'warning';
}
