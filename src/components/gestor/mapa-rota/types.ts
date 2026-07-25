/**
 * Types para componentes do Mapa da Rota
 */

import type { MotivoSkip } from '@/constants/skipReasons';

export interface Parada {
  id: string;
  ordem: number;
  endereco: string;
  tipo: 'entrega' | 'retirada';
  status: string;
  latitude: number | null;
  longitude: number | null;
  destinatario?: string;
  telefone?: string;
  observacoes?: string;
  motivo_skip?: MotivoSkip;
  foto_url?: string | null;
  is_checkpoint?: boolean;
  concluida_em?: string;
}

export interface Rota {
  id: string;
  data: string;
  status: string;
  distancia_total?: number;
  tempo_total?: number;
  polyline?: string | null;
  created_at?: string;
  updated_at?: string;
  motorista_id?: string;
  unidade_id?: string;
  motorista?: {
    nome: string;
  };
  unidade?: {
    nome: string;
  };
}

export interface ResumoParadas {
  total: number;
  concluidas: number;
  pendentes: number;
  emAndamento: number;
  puladas: number;
}

export interface BaseInfo {
  label: string;
  value: string;
  icon: string;
  color: string;
}
