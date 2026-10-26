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
  /** Instrução do gestor. */
  observacoes?: string;
  motivo_skip?: MotivoSkip;
  /** Texto do motorista ao pular (Migration 73). */
  observacao_pulo?: string | null;
  foto_url?: string | null;
  is_checkpoint?: boolean;
  concluida_em?: string;
  /** Retirada de que esta entrega depende (só entregas). */
  vinculo_parada_id?: string | null;
}

export interface Rota {
  id: string;
  data: string;
  /**
   * Era `string`, e foi esse alargamento que escondeu por meses a ausência de
   * `nao_executada` em `StatusRota` — o compilador não tinha como reclamar.
   *
   * O tipo é uma **afirmação** sobre o que o Supabase devolve, não uma
   * garantia: o select devolve string crua do Postgres e a tipagem só a
   * afirma. Por isso quem consome mantém fallback de runtime —
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
  /**
   * Nome do motorista quando a RLS esconde o embed `motorista` (vínculo
   * inativo com a loja), pela RPC `nomes_motoristas_das_rotas` (Migration
   * 72). `null`/ausente = sem nome: a tela usa `ROTULO_MOTORISTA_OCULTO`.
   */
  motorista_fora_da_loja_nome?: string | null;
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
