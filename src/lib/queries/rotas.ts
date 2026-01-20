/**
 * Route-related Supabase queries
 * Centralized query layer for rotas table operations
 */

import { getCache, setCache, CACHE_TTL } from '@/lib/cache';
import { logger } from '@/lib/logger';
import type { StatusRota, StatusCheckpoint } from '@/types/rota';

import {
  supabase,
  withRetry,
  safeQuery,
  classifyError,
  buildCacheKey,
  type QueryResult,
} from './queryClient';

/**
 * Base rota fields from database
 */
export interface RotaDB {
  id: string;
  unidade_id: string;
  motorista_id: string | null;
  criado_por: string | null;
  titulo: string | null;
  data: string;
  status: StatusRota;
  observacoes: string | null;
  distancia_total: number | null;
  duracao_total_minutos: number | null;
  tempo_total: number | null; // Alias for duracao_total_minutos (legacy compatibility)
  polyline: string | null; // Encoded polyline for route visualization
  criado_em: string;
  iniciada_em: string | null;
  concluida_em: string | null;
}

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
  foto_url: string | null;
  is_checkpoint: boolean;
  concluida_em: string | null;
  criado_em: string;
}

/**
 * Extended rota with related data
 */
export interface RotaWithRelations extends RotaDB {
  motorista?: {
    id: string;
    nome: string;
    avatar_url: string | null;
    telefone: string | null;
  } | null;
  unidade?: {
    id: string;
    nome: string;
    cidade: string;
  } | null;
  paradas?: ParadaDB[];
}

/**
 * Rota list item with aggregated paradas stats
 */
export interface RotaListItem {
  id: string;
  status: StatusRota;
  data: string;
  titulo: string | null;
  distancia_total: number | null;
  duracao_total_minutos: number | null;
  motorista_id: string | null;
  criado_em: string;
  concluida_em: string | null;
  motorista_nome: string | null;
  paradas_total: number;
  paradas_concluidas: number;
}

/**
 * Fetch options for rotas list
 */
export interface FetchRotasOptions {
  unidadeId: string;
  limit?: number;
  status?: StatusRota | StatusRota[];
  motoristaId?: string;
  dataInicio?: string;
  dataFim?: string;
  abortSignal?: AbortSignal;
}

/**
 * Rota insert data
 */
export interface RotaInsert {
  unidade_id: string;
  motorista_id?: string | null;
  criado_por?: string | null;
  titulo?: string | null;
  data?: string;
  status?: StatusRota;
  observacoes?: string | null;
  distancia_total?: number | null;
  duracao_total_minutos?: number | null;
  tempo_total?: number | null; // Alias for duracao_total_minutos (legacy compatibility)
  polyline?: string | null; // Encoded polyline for route visualization
}

/**
 * Rota update data
 */
export interface RotaUpdate {
  motorista_id?: string | null;
  titulo?: string | null;
  data?: string;
  status?: StatusRota;
  observacoes?: string | null;
  distancia_total?: number | null;
  duracao_total_minutos?: number | null;
  iniciada_em?: string | null;
  concluida_em?: string | null;
}

/**
 * Fetch rotas list with paradas stats
 * Uses parallel queries to avoid N+1 problem
 */
export async function fetchRotasWithStats(
  options: FetchRotasOptions
): Promise<QueryResult<RotaListItem[]>> {
  const { unidadeId, limit = 100, status, motoristaId, dataInicio, dataFim, abortSignal } = options;

  return safeQuery(async () => {
    // Build rotas query
    let rotasQuery = supabase
      .from('rotas')
      .select(`
        id, status, data, titulo, distancia_total, duracao_total_minutos,
        motorista_id, criado_em, concluida_em,
        motorista:usuarios!rotas_motorista_id_fkey(nome)
      `)
      .eq('unidade_id', unidadeId)
      .order('data', { ascending: false })
      .limit(limit);

    // Apply optional filters
    if (status) {
      if (Array.isArray(status)) {
        rotasQuery = rotasQuery.in('status', status);
      } else {
        rotasQuery = rotasQuery.eq('status', status);
      }
    }
    if (motoristaId) {
      rotasQuery = rotasQuery.eq('motorista_id', motoristaId);
    }
    if (dataInicio) {
      rotasQuery = rotasQuery.gte('data', dataInicio);
    }
    if (dataFim) {
      rotasQuery = rotasQuery.lte('data', dataFim);
    }
    if (abortSignal) {
      rotasQuery = rotasQuery.abortSignal(abortSignal);
    }

    // Build paradas query for aggregation
    let paradasQuery = supabase
      .from('paradas')
      .select('rota_id, status, is_checkpoint, rotas!inner(unidade_id)')
      .eq('rotas.unidade_id', unidadeId);

    if (abortSignal) {
      paradasQuery = paradasQuery.abortSignal(abortSignal);
    }

    // Execute queries in parallel
    const [rotasResult, paradasResult] = await Promise.all([
      rotasQuery,
      paradasQuery,
    ]);

    if (rotasResult.error) throw rotasResult.error;
    if (paradasResult.error) throw paradasResult.error;

    // Aggregate paradas stats per rota
    const paradasStats = new Map<string, { total: number; concluidas: number }>();
    for (const parada of paradasResult.data || []) {
      if (parada.is_checkpoint === false) continue;
      const stats = paradasStats.get(parada.rota_id) || { total: 0, concluidas: 0 };
      stats.total++;
      if (parada.status === 'concluida') stats.concluidas++;
      paradasStats.set(parada.rota_id, stats);
    }

    // Transform and return
    const rotas: RotaListItem[] = (rotasResult.data || []).map((rota) => {
      const stats = paradasStats.get(rota.id) || { total: 0, concluidas: 0 };
      // Handle motorista - extract nome from relation result
      const motoristaData = rota.motorista;
      let motoristaNome: string | null = null;
      if (motoristaData && typeof motoristaData === 'object' && 'nome' in motoristaData) {
        motoristaNome = (motoristaData as { nome: string }).nome;
      }
      return {
        id: rota.id,
        status: rota.status as StatusRota,
        data: rota.data,
        titulo: rota.titulo,
        distancia_total: rota.distancia_total,
        duracao_total_minutos: rota.duracao_total_minutos,
        motorista_id: rota.motorista_id,
        criado_em: rota.criado_em,
        concluida_em: rota.concluida_em,
        motorista_nome: motoristaNome,
        paradas_total: stats.total,
        paradas_concluidas: stats.concluidas,
      };
    });

    return rotas;
  });
}

/**
 * Fetch single rota with full details including paradas
 */
export async function fetchRotaDetalhada(
  rotaId: string
): Promise<QueryResult<RotaWithRelations>> {
  return safeQuery(async () => {
    const [rotaResult, paradasResult] = await Promise.all([
      supabase
        .from('rotas')
        .select(`
          *,
          motorista:usuarios!rotas_motorista_id_fkey(id, nome, avatar_url, telefone),
          unidade:unidades(id, nome, cidade)
        `)
        .eq('id', rotaId)
        .single(),
      supabase
        .from('paradas')
        .select('*')
        .eq('rota_id', rotaId)
        .order('ordem', { ascending: true }),
    ]);

    if (rotaResult.error) throw rotaResult.error;
    if (paradasResult.error) throw paradasResult.error;

    const rota = rotaResult.data as RotaDB & {
      motorista: { id: string; nome: string; avatar_url: string | null; telefone: string | null } | null;
      unidade: { id: string; nome: string; cidade: string } | null;
    };

    return {
      ...rota,
      paradas: (paradasResult.data || []) as ParadaDB[],
    };
  });
}

/**
 * Fetch rotas ativas for a motorista
 */
export async function fetchRotasAtivasMotorista(
  motoristaId: string
): Promise<QueryResult<RotaWithRelations[]>> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from('rotas')
      .select(`
        *,
        motorista:usuarios!rotas_motorista_id_fkey(id, nome, avatar_url, telefone),
        unidade:unidades(id, nome, cidade),
        paradas(*)
      `)
      .eq('motorista_id', motoristaId)
      .in('status', ['pendente', 'em_andamento'])
      .order('data', { ascending: true });

    if (error) throw error;

    return (data || []) as unknown as RotaWithRelations[];
  });
}

/**
 * Fetch rota with cache (SWR pattern)
 * Returns cached data immediately if available, then revalidates
 */
export async function fetchRotaWithCache(
  rotaId: string,
  options?: { forceRefresh?: boolean }
): Promise<QueryResult<RotaWithRelations>> {
  const cacheKey = buildCacheKey('rota', rotaId);

  // Check cache first (unless force refresh)
  if (!options?.forceRefresh) {
    const cached = await getCache<RotaWithRelations>(cacheKey);
    if (cached) {
      // Revalidate in background
      fetchRotaDetalhada(rotaId).then((result) => {
        if (result.success) {
          setCache(cacheKey, result.data, CACHE_TTL.ROUTES_LIST);
        }
      });
      return { success: true, data: cached };
    }
  }

  // Fetch fresh data
  const result = await fetchRotaDetalhada(rotaId);
  if (result.success) {
    await setCache(cacheKey, result.data, CACHE_TTL.ROUTES_LIST);
  }

  return result;
}

/**
 * Create a new rota
 */
export async function createRota(
  data: RotaInsert
): Promise<QueryResult<RotaDB>> {
  return withRetry(async () => {
    const { data: rota, error } = await supabase
      .from('rotas')
      .insert(data)
      .select()
      .single();

    if (error) throw error;
    return rota as RotaDB;
  }).then(
    (data) => ({ success: true as const, data }),
    (error) => ({ success: false as const, error: classifyError(error) })
  );
}

/**
 * Update rota status
 */
export async function updateRotaStatus(
  rotaId: string,
  status: StatusRota,
  additionalFields?: Partial<RotaUpdate>
): Promise<QueryResult<RotaDB>> {
  return withRetry(async () => {
    const updateData: RotaUpdate = {
      status,
      ...additionalFields,
    };

    // Set timestamp based on status
    if (status === 'em_andamento') {
      updateData.iniciada_em = new Date().toISOString();
    } else if (status === 'concluida') {
      updateData.concluida_em = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('rotas')
      .update(updateData)
      .eq('id', rotaId)
      .select()
      .single();

    if (error) throw error;
    return data as RotaDB;
  }).then(
    (data) => ({ success: true as const, data }),
    (error) => ({ success: false as const, error: classifyError(error) })
  );
}

/**
 * Update rota fields
 */
export async function updateRota(
  rotaId: string,
  data: RotaUpdate
): Promise<QueryResult<RotaDB>> {
  return withRetry(async () => {
    const { data: rota, error } = await supabase
      .from('rotas')
      .update(data)
      .eq('id', rotaId)
      .select()
      .single();

    if (error) throw error;
    return rota as RotaDB;
  }).then(
    (data) => ({ success: true as const, data }),
    (error) => ({ success: false as const, error: classifyError(error) })
  );
}

/**
 * Delete a rota (soft delete not implemented, full delete)
 */
export async function deleteRota(
  rotaId: string
): Promise<QueryResult<void>> {
  return withRetry(async () => {
    const { error } = await supabase
      .from('rotas')
      .delete()
      .eq('id', rotaId);

    if (error) throw error;
  }).then(
    () => ({ success: true as const, data: undefined }),
    (error) => ({ success: false as const, error: classifyError(error) })
  );
}

/**
 * Assign motorista to rota
 */
export async function assignMotoristaToRota(
  rotaId: string,
  motoristaId: string | null
): Promise<QueryResult<RotaDB>> {
  return updateRota(rotaId, { motorista_id: motoristaId });
}

/**
 * Fetch rotas for dashboard KPIs
 */
export async function fetchRotasKPIs(
  unidadeId: string,
  periodo: { inicio: string; fim: string }
): Promise<QueryResult<{
  total: number;
  pendentes: number;
  emAndamento: number;
  concluidas: number;
  canceladas: number;
}>> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from('rotas')
      .select('id, status')
      .eq('unidade_id', unidadeId)
      .gte('data', periodo.inicio)
      .lte('data', periodo.fim);

    if (error) throw error;

    const kpis = {
      total: data?.length || 0,
      pendentes: 0,
      emAndamento: 0,
      concluidas: 0,
      canceladas: 0,
    };

    for (const rota of data || []) {
      switch (rota.status) {
        case 'pendente':
          kpis.pendentes++;
          break;
        case 'em_andamento':
          kpis.emAndamento++;
          break;
        case 'concluida':
          kpis.concluidas++;
          break;
        case 'cancelada':
          kpis.canceladas++;
          break;
      }
    }

    return kpis;
  });
}

/**
 * Log rota action to audit trail
 */
export async function logRotaAction(
  usuarioId: string,
  rotaId: string,
  evento: string,
  detalhes?: Record<string, unknown>
): Promise<void> {
  try {
    await supabase.from('logs').insert({
      usuario_id: usuarioId,
      rota_id: rotaId,
      evento,
      detalhes,
    });
  } catch (error) {
    // Log failures are not critical, just warn
    logger.warn('Failed to log rota action:', error);
  }
}
