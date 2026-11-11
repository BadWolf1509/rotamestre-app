/**
 * Types for Historico screen data and filters
 */

export type FiltroStatus =
  | 'todos'
  | 'concluida'
  | 'pendente'
  | 'em_andamento'
  | 'cancelada'
  | 'nao_executada';

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

/** Cabeçalho do período (vem do resumo do banco, não da lista baixada). */
export interface Metricas {
  rotasTotais: number;
  rotasConcluidas: number;
  /** Rotas do mês corrente, qualquer que seja o período escolhido. */
  rotasMes: number;
  paradasTotais: number;
  paradasConcluidas: number;
  distanciaTotal: number;
  /** null = sem base de tempo no período. */
  tempoMedioMinutos: number | null;
  taxaSucesso: number;
}
