/**
 * Parada (stop/checkpoint) related Supabase queries
 * Centralized query layer for paradas table operations
 */

import type { MotivoSkip } from '@/constants/skipReasons';
import { logger } from '@/lib/logger';
import type { StatusCheckpoint } from '@/types/rota';

import {
  supabase,
  withRetry,
  safeQuery,
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
  motivo_skip: MotivoSkip | null;
  foto_url: string | null;
  is_checkpoint: boolean;
  concluida_em: string | null;
  criado_em: string;
}

/**
 * Parada insert data
 */
export interface ParadaInsert {
  rota_id: string;
  ordem: number;
  tipo: 'entrega' | 'retirada';
  endereco: string;
  latitude: number;
  longitude: number;
  destinatario?: string | null;
  telefone?: string | null;
  observacoes?: string | null;
  is_checkpoint?: boolean;
  status?: StatusCheckpoint;
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
  motivo_skip?: MotivoSkip | null;
  foto_url?: string | null;
  concluida_em?: string | null;
}

/**
 * Extended parada with address details
 */
export interface ParadaWithDetails extends ParadaDB {
  progresso?: {
    posicao: number;
    total: number;
  };
}

/**
 * Fetch all paradas for a rota ordered by sequence
 */
export async function fetchParadasByRota(
  rotaId: string
): Promise<QueryResult<ParadaDB[]>> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from('paradas')
      .select('*')
      .eq('rota_id', rotaId)
      .order('ordem', { ascending: true });

    if (error) throw error;
    return (data || []) as ParadaDB[];
  });
}

/**
 * Fetch single parada by ID
 */
export async function fetchParadaById(
  paradaId: string
): Promise<QueryResult<ParadaDB>> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from('paradas')
      .select('*')
      .eq('id', paradaId)
      .single();

    if (error) throw error;
    return data as ParadaDB;
  });
}

/**
 * Fetch checkpoint paradas only (excludes origin/depot)
 */
export async function fetchCheckpointsByRota(
  rotaId: string
): Promise<QueryResult<ParadaDB[]>> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from('paradas')
      .select('*')
      .eq('rota_id', rotaId)
      .eq('is_checkpoint', true)
      .order('ordem', { ascending: true });

    if (error) throw error;
    return (data || []) as ParadaDB[];
  });
}

/**
 * Get paradas stats for a rota
 */
export async function fetchParadasStats(
  rotaId: string
): Promise<QueryResult<{
  total: number;
  concluidas: number;
  pendentes: number;
  puladas: number;
  progresso: number;
}>> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from('paradas')
      .select('id, status, is_checkpoint')
      .eq('rota_id', rotaId)
      .eq('is_checkpoint', true);

    if (error) throw error;

    const stats = {
      total: data?.length || 0,
      concluidas: 0,
      pendentes: 0,
      puladas: 0,
      progresso: 0,
    };

    for (const parada of data || []) {
      switch (parada.status) {
        case 'concluida':
          stats.concluidas++;
          break;
        case 'pendente':
          stats.pendentes++;
          break;
        case 'pulada':
          stats.puladas++;
          break;
      }
    }

    stats.progresso = stats.total > 0
      ? Math.round((stats.concluidas / stats.total) * 100)
      : 0;

    return stats;
  });
}

/**
 * Create multiple paradas in batch
 */
export async function createParadasBatch(
  paradas: ParadaInsert[]
): Promise<QueryResult<ParadaDB[]>> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('paradas')
      .insert(paradas)
      .select();

    if (error) throw error;
    return (data || []) as ParadaDB[];
  }).then(
    (data) => ({ success: true as const, data }),
    (error) => ({ success: false as const, error: classifyError(error) })
  );
}

/**
 * Update parada status
 */
export async function updateParadaStatus(
  paradaId: string,
  status: StatusCheckpoint,
  additionalFields?: Partial<ParadaUpdate>
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
    (error) => ({ success: false as const, error: classifyError(error) })
  );
}

/**
 * Mark parada as completed with optional photo
 */
export async function completeParada(
  paradaId: string,
  options?: {
    fotoUrl?: string;
    observacoes?: string;
  }
): Promise<QueryResult<ParadaDB>> {
  return updateParadaStatus(paradaId, 'concluida', {
    foto_url: options?.fotoUrl,
    observacoes: options?.observacoes,
  });
}

/**
 * Mark parada as skipped with structured reason
 */
export async function skipParada(
  paradaId: string,
  motivo: MotivoSkip,
  observacoes?: string
): Promise<QueryResult<ParadaDB>> {
  return updateParadaStatus(paradaId, 'pulada', {
    motivo_skip: motivo,
    observacoes: observacoes || null,
  });
}

/**
 * Update parada fields
 */
export async function updateParada(
  paradaId: string,
  data: ParadaUpdate
): Promise<QueryResult<ParadaDB>> {
  return withRetry(async () => {
    const { data: parada, error } = await supabase
      .from('paradas')
      .update(data)
      .eq('id', paradaId)
      .select()
      .single();

    if (error) throw error;
    return parada as ParadaDB;
  }).then(
    (data) => ({ success: true as const, data }),
    (error) => ({ success: false as const, error: classifyError(error) })
  );
}

/**
 * Update parada order (reordering stops)
 */
export async function updateParadaOrder(
  paradaId: string,
  newOrder: number
): Promise<QueryResult<ParadaDB>> {
  return updateParada(paradaId, { ordem: newOrder });
}

/**
 * Delete a parada
 */
export async function deleteParada(
  paradaId: string
): Promise<QueryResult<void>> {
  return withRetry(async () => {
    const { error } = await supabase
      .from('paradas')
      .delete()
      .eq('id', paradaId);

    if (error) throw error;
  }).then(
    () => ({ success: true as const, data: undefined }),
    (error) => ({ success: false as const, error: classifyError(error) })
  );
}

/**
 * Delete all paradas for a rota
 */
export async function deleteParadasByRota(
  rotaId: string
): Promise<QueryResult<void>> {
  return withRetry(async () => {
    const { error } = await supabase
      .from('paradas')
      .delete()
      .eq('rota_id', rotaId);

    if (error) throw error;
  }).then(
    () => ({ success: true as const, data: undefined }),
    (error) => ({ success: false as const, error: classifyError(error) })
  );
}

/**
 * Fetch next pending parada for a rota
 */
export async function fetchNextPendingParada(
  rotaId: string
): Promise<QueryResult<ParadaDB | null>> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from('paradas')
      .select('*')
      .eq('rota_id', rotaId)
      .eq('status', 'pendente')
      .eq('is_checkpoint', true)
      .order('ordem', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data as ParadaDB | null;
  });
}

/**
 * Log parada action to audit trail
 */
export async function logParadaAction(
  usuarioId: string,
  paradaId: string,
  rotaId: string,
  evento: string,
  detalhes?: Record<string, unknown>
): Promise<void> {
  try {
    await supabase.from('logs').insert({
      usuario_id: usuarioId,
      parada_id: paradaId,
      rota_id: rotaId,
      evento,
      detalhes,
    });
  } catch (error) {
    // Log failures are not critical, just warn
    logger.warn('Failed to log parada action:', error);
  }
}
