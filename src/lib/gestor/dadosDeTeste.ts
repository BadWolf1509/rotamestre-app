/**
 * Dados falsos do painel do gestor para E2E/CI SEM Supabase configurado
 * (`isSupabaseConfigured === false`). Moravam dentro de `useDashboardData` e
 * `useGestaoRotas`, ao lado da carga real. Aqui a coluna `date` usa
 * `getTodayISO` (a armadilha de fuso: nada de `new Date().toISOString()`).
 */

import type {
  KPIs,
  RotaResumo,
  Stats,
  TodayStats,
} from '@/components/gestor/dashboard/_hooks/useDashboardData';
import type { RotaHistorico } from '@/hooks/gestao-rotas/types';
import { toLocalISODate, getTodayISO } from '@/lib/dateUtils';
import type { StatusParada } from '@/types/rota';

const DIA_MS = 86400000;

function repetir(status: StatusParada, vezes: number): StatusParada[] {
  return Array.from({ length: vezes }, () => status);
}

export interface DadosDeTesteDoInicio {
  rotas: RotaResumo[];
  stats: Stats;
  todayStats: TodayStats;
  kpis: KPIs;
}

export function dadosDeTesteDoInicio(): DadosDeTesteDoInicio {
  const hoje = getTodayISO();
  return {
    rotas: [
      {
        id: 'rota-1',
        data: hoje,
        status: 'em_andamento',
        motorista_nome: 'Motorista Teste 1',
        motorista_id: 'mot-1',
        total_paradas: 10,
        paradas_concluidas: 4,
        distancia_total: 15.5,
        paradas_status: [
          ...repetir('concluida', 4),
          'em_andamento',
          ...repetir('pendente', 5),
        ],
      },
      {
        id: 'rota-2',
        data: hoje,
        status: 'concluida',
        motorista_nome: 'Motorista Teste 2',
        motorista_id: 'mot-2',
        total_paradas: 8,
        paradas_concluidas: 8,
        distancia_total: 12.0,
        paradas_status: repetir('concluida', 8),
      },
      {
        id: 'rota-3',
        data: hoje,
        status: 'pendente',
        motorista_nome: 'Sem motorista',
        motorista_id: null,
        total_paradas: 5,
        paradas_concluidas: 0,
        distancia_total: 8.2,
        paradas_status: repetir('pendente', 5),
      },
    ],
    stats: {
      total: 3,
      emAndamento: 1,
      concluidas: 1,
      distanciaTotal: 35.7,
      incidentesAbertos: 1,
    },
    todayStats: { totalHoje: 3 },
    kpis: {
      rotasSemana: 15,
      rotasMes: 45,
      taxaSucesso: 95,
      tempoMedioMinutos: 45,
      totalParadas: 150,
      paradasConcluidas: 142,
      motoristaDestaque: { nome: 'Motorista Teste 2', rotasConcluidas: 20 },
    },
  };
}

export function rotasDeTesteDaGestao(): RotaHistorico[] {
  const agora = Date.now();
  return [
    {
      id: 'rota-1',
      // `data` é coluna `date`; os instantes (iniciada/concluída) são timestamps.
      data: getTodayISO(),
      status: 'em_andamento',
      distancia_total: 15.5,
      iniciada_em: new Date(agora).toISOString(),
      concluida_em: undefined,
      motorista_id: 'mot-1',
      motorista_nome: 'Motorista Teste 1',
      paradas_count: 10,
      paradas_concluidas: 4,
    },
    {
      id: 'rota-2',
      data: toLocalISODate(new Date(agora - DIA_MS)),
      status: 'concluida',
      distancia_total: 12.0,
      iniciada_em: new Date(agora - 90000000).toISOString(),
      concluida_em: new Date(agora - DIA_MS).toISOString(),
      motorista_id: 'mot-2',
      motorista_nome: 'Motorista Teste 2',
      paradas_count: 8,
      paradas_concluidas: 8,
    },
    {
      id: 'rota-3',
      data: getTodayISO(),
      status: 'pendente',
      distancia_total: 8.2,
      iniciada_em: undefined,
      concluida_em: undefined,
      motorista_id: undefined,
      motorista_nome: 'Sem motorista',
      paradas_count: 5,
      paradas_concluidas: 0,
    },
  ];
}
