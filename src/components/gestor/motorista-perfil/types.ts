/**
 * Types para componentes do Perfil do Motorista
 */

export interface Motorista {
  id: string;
  nome: string;
  email: string;
  telefone?: string;
  foto_url?: string;
  ativo: boolean;
  created_at: string;
}

export interface MotoristaPerformance {
  id: string;
  nome: string;
  unidade_id: string;
  unidade_nome: string;
  total_rotas: number;
  rotas_concluidas: number;
  rotas_em_andamento: number;
  rotas_nao_executadas: number;
  rotas_canceladas: number;
  taxa_execucao: number;
  distancia_total_km: number | null;
  tempo_medio_minutos: number | null;
}

export interface RotaRecente {
  id: string;
  data: string;
  status: string;
  distancia_total: number | null;
  paradas_count?: number;
}

export interface KPIItem {
  value: string | number;
  label: string;
  icon: string;
  color: string;
  trend?: 'up' | 'down' | 'neutral';
}
