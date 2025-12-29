import { Endereco, Coordenadas } from './endereco';

export type TipoCheckpoint = 'entrega' | 'retirada' | 'origem';
export type StatusRota = 'pendente' | 'em_andamento' | 'concluida' | 'cancelada';
export type StatusCheckpoint = 'pendente' | 'concluido' | 'pulado';

export interface Checkpoint {
  id: string;
  rota_id: string;
  tipo: TipoCheckpoint;
  endereco: Endereco;
  ordem: number;
  status: StatusCheckpoint;
  observacoes?: string;
  timestamp_conclusao?: string;
  created_at: string;
  /** ID da parada que deve ser executada ANTES desta (ex: retirada antes da entrega) */
  vinculo_parada_id?: string;
  /** Dados da parada vinculada (populated em queries) */
  vinculo_parada?: {
    id: string;
    endereco: string;
    destinatario?: string;
  };
}

export interface Rota {
  id: string;
  unidade_id: string;
  motorista_id?: string;
  status: StatusRota;
  origem: Coordenadas;
  checkpoints: Checkpoint[];
  distancia_total?: number; // em km
  tempo_estimado?: number; // em minutos
  tempo_real?: number; // em minutos
  tempo_total?: number; // em minutos
  polyline?: string; // encoded polyline do Google
  created_at: string;
  updated_at: string;
  iniciada_em?: string;
  concluida_em?: string;
}

export interface RotaOtimizada {
  rota_original: Rota;
  ordem_otimizada: number[];
  distancia_total: number; // em km
  tempo_estimado: number; // em minutos
  polyline: string;
}

export interface ResumoRota {
  distancia_km: string;
  tempo_estimado: string;
  total_entregas: number;
  total_retiradas: number;
  checkpoints_concluidos: number;
  progresso_percentual: number;
}
