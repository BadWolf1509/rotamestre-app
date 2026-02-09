/**
 * Types for Historico screen data and filters
 */

export type FiltroStatus = 'todos' | 'concluida' | 'pendente' | 'em_andamento' | 'cancelada' | 'nao_executada';
export type FiltroPeriodo = 'todos' | 'hoje' | 'semana' | 'mes';

export interface RotaHistorico {
  id: string;
  data: string;
  status: string;
  distancia_total?: number;
  iniciada_em?: string;
  concluida_em?: string;
  unidades: {
    nome: string;
  };
  paradas_count?: number;
  paradas_concluidas?: number;
}

export interface Metricas {
  rotasTotais: number;
  rotasConcluidas: number;
  rotasMes: number;
  paradasTotais: number;
  paradasConcluidas: number;
  distanciaTotal: number;
  tempoMedioMinutos: number;
  taxaSucesso: number;
}
