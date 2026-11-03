/**
 * Parada (stop/checkpoint) related Supabase queries
 * Centralized query layer for paradas table operations
 */

import type { MotivoSkip } from '@/constants/skipReasons';
import type { StatusCheckpoint } from '@/types/rota';

import {
  supabase,
  withRetry,
  classifyError,
  type QueryResult,
} from './queryClient';

/**
 * Base parada fields from database
 */
export interface ParadaDB {
  id: string;
  rota_id: string;
  ordem: number;
  tipo: 'entrega' | 'retirada';
  status: StatusCheckpoint;
  endereco: string;
  destinatario: string | null;
  telefone: string | null;
  latitude: number;
  longitude: number;
  observacoes: string | null;
  /** Texto do motorista ao pular (Migration 73); `observacoes` é do gestor. */
  observacao_pulo: string | null;
  motivo_skip: MotivoSkip | null;
  foto_url: string | null;
  is_checkpoint: boolean;
  concluida_em: string | null;
  created_at: string;
}

/**
 * Parada update data
 */
export interface ParadaUpdate {
  ordem?: number;
  status?: StatusCheckpoint;
  endereco?: string;
  destinatario?: string | null;
  telefone?: string | null;
  observacoes?: string | null;
  observacao_pulo?: string | null;
  motivo_skip?: MotivoSkip | null;
  foto_url?: string | null;
  concluida_em?: string | null;
}

/**
 * Update parada status
 */
export async function updateParadaStatus(
  paradaId: string,
  status: StatusCheckpoint,
  additionalFields?: Partial<ParadaUpdate>,
): Promise<QueryResult<ParadaDB>> {
  return withRetry(async () => {
    const updateData: ParadaUpdate = {
      status,
      ...additionalFields,
    };

    // Set completion timestamp if completing
    if (status === 'concluida') {
      updateData.concluida_em = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('paradas')
      .update(updateData)
      .eq('id', paradaId)
      .select()
      .single();

    if (error) throw error;
    return data as ParadaDB;
  }).then(
    (data) => ({ success: true as const, data }),
    (error) => ({ success: false as const, error: classifyError(error) }),
  );
}

/**
 * Log parada action to audit trail.
 *
 * Reexport do helper central: ele checa o `error` do insert e grava `parada_id`
 * dentro de `detalhes` (a tabela `logs` não tem essa coluna).
 */
export { logParadaAction } from './logs';
