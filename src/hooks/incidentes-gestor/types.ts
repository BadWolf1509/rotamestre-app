/**
 * Types for incident management hooks
 */

import type { IconName } from '@/types/icons';

/**
 * Incident entity from database
 */
export interface Incidente {
  id: string;
  categoria: string;
  descricao: string;
  endereco: string;
  status: string;
  foto_url: string | null;
  created_at: string;
  motorista_nome: string;
  motorista_id: string;
  unidade_nome: string;
  rota_id: string | null;
  rota_data: string | null;
  parada_endereco: string | null;
  observacoes_gestao: string | null;
}

/**
 * Filter by status
 */
export type FiltroStatus =
  | 'todos'
  | 'aberto'
  | 'em_analise'
  | 'resolvido'
  | 'fechado';

/**
 * Filter by category
 */
export type FiltroCategoria =
  | 'todos'
  | 'accident'
  | 'absent'
  | 'wrong_address'
  | 'blocked'
  | 'vehicle'
  | 'other';

/**
 * Category label with icon and color
 */
export interface CategoriaLabel {
  label: string;
  icon: IconName;
  color: string;
}

/**
 * Status label with color
 */
export interface StatusLabel {
  label: string;
  color: string;
}

/**
 * Driver statistics
 */
export interface EstatisticaMotorista {
  id: string;
  nome: string;
  total: number;
  abertos: number;
  resolvidos: number;
}

/**
 * General summary statistics
 */
export interface ResumoGeral {
  total: number;
  abertos: number;
  emAnalise: number;
  resolvidos: number;
  fechados: number;
  porCategoria: Record<string, number>;
}
