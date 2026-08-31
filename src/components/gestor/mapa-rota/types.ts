/**
 * Types para componentes do Mapa da Rota
 */

import type { MotivoSkip } from '@/constants/skipReasons';
import type { OtimizacaoEstado, StatusRota } from '@/types/rota';

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
  /**
   * Era `string`, e foi esse alargamento que escondeu por meses a ausência de
   * `nao_executada` em `StatusRota` — o compilador não tinha como reclamar.
   *
   * O tipo é uma **afirmação** sobre o que o Supabase devolve, não uma
   * garantia: `src/lib/queries/rotas.ts` faz `rota.status as StatusRota` sobre
   * string crua do Postgres. Por isso quem consome mantém fallback de runtime —
   * ver `getStatusBadgeVariant` e `formatStatusLabel` em `RouteInfoHeader.tsx`.
   */
  status: StatusRota;
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
  // Auditoria de uso do otimizador. `null`/ausente = sem registro (rota
  // criada antes da feature) — nunca tratar como 'manual'.
  otimizacao_estado?: OtimizacaoEstado | null;
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
