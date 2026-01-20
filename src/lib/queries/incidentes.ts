/**
 * Incident-related Supabase queries
 * Centralized query layer for incidentes table operations
 */

import { logger } from '@/lib/logger';

import {
  supabase,
  safeQuery,
  withRetry,
  classifyError,
  type QueryResult,
} from './queryClient';

/**
 * Incident status types
 */
export type IncidenteStatus = 'aberto' | 'em_analise' | 'resolvido' | 'fechado';

/**
 * Incident category types
 */
export type IncidenteCategoria =
  | 'accident'
  | 'absent'
  | 'wrong_address'
  | 'blocked'
  | 'vehicle'
  | 'other';

/**
 * Base incidente fields from database
 */
export interface IncidenteDB {
  id: string;
  motorista_id: string;
  rota_id: string | null;
  parada_id: string | null;
  categoria: IncidenteCategoria;
  descricao: string;
  endereco: string;
  latitude: number | null;
  longitude: number | null;
  foto_url: string | null;
  status: IncidenteStatus;
  observacoes_gestao: string | null;
  resolvido_em: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Incidente with related data for listing
 */
export interface IncidenteWithRelations {
  id: string;
  categoria: IncidenteCategoria;
  descricao: string;
  endereco: string;
  status: IncidenteStatus;
  foto_url: string | null;
  created_at: string;
  observacoes_gestao: string | null;
  motorista_nome: string;
  motorista_id: string;
  unidade_nome: string;
  rota_id: string | null;
  rota_data: string | null;
  parada_endereco: string | null;
}

/**
 * Incidente insert data
 */
export interface IncidenteInsert {
  motorista_id: string;
  categoria: IncidenteCategoria;
  descricao: string;
  endereco: string;
  latitude?: number | null;
  longitude?: number | null;
  foto_url?: string | null;
  rota_id?: string | null;
  parada_id?: string | null;
  status?: IncidenteStatus;
}

/**
 * Incidente update data
 */
export interface IncidenteUpdate {
  status?: IncidenteStatus;
  observacoes_gestao?: string | null;
  resolvido_em?: string | null;
}

/**
 * Fetch options for incidentes list
 */
export interface FetchIncidentesOptions {
  motoristasIds: string[];
  status?: IncidenteStatus;
  categoria?: IncidenteCategoria;
  limit?: number;
}

/**
 * Raw incidente query result with relations (from Supabase join)
 */
interface IncidenteQueryRow {
  id: string;
  categoria: IncidenteCategoria;
  descricao: string;
  endereco: string;
  status: IncidenteStatus;
  foto_url: string | null;
  created_at: string;
  observacoes_gestao: string | null;
  motorista_id: string;
  motorista: { nome: string } | null;
  rota: { id: string; data: string } | null;
  parada: { endereco: string } | null;
}

/**
 * Fetch incidentes with relations for gestor view
 */
export async function fetchIncidentesForGestor(
  options: FetchIncidentesOptions
): Promise<QueryResult<IncidenteWithRelations[]>> {
  const { motoristasIds, status, categoria, limit = 100 } = options;

  if (motoristasIds.length === 0) {
    return { success: true, data: [] };
  }

  return safeQuery(async () => {
    let query = supabase
      .from('incidentes')
      .select(
        `
        id,
        categoria,
        descricao,
        endereco,
        status,
        foto_url,
        created_at,
        observacoes_gestao,
        motorista_id,
        motorista:usuarios!motorista_id (nome),
        rota:rotas (id, data),
        parada:paradas (endereco)
      `
      )
      .in('motorista_id', motoristasIds)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq('status', status);
    }
    if (categoria) {
      query = query.eq('categoria', categoria);
    }

    const { data, error } = await query;

    if (error) throw error;

    return (data || []).map((inc) => {
      const row = inc as unknown as IncidenteQueryRow;
      return {
        id: row.id,
        categoria: row.categoria,
        descricao: row.descricao,
        endereco: row.endereco,
        status: row.status,
        foto_url: row.foto_url,
        created_at: row.created_at,
        observacoes_gestao: row.observacoes_gestao,
        motorista_nome: row.motorista?.nome || 'Desconhecido',
        motorista_id: row.motorista_id,
        unidade_nome: '',
        rota_id: row.rota?.id || null,
        rota_data: row.rota?.data || null,
        parada_endereco: row.parada?.endereco || null,
      };
    });
  });
}

/**
 * Fetch single incidente by ID
 */
export async function fetchIncidenteById(
  incidenteId: string
): Promise<QueryResult<IncidenteDB>> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from('incidentes')
      .select('*')
      .eq('id', incidenteId)
      .single();

    if (error) throw error;
    return data as IncidenteDB;
  });
}

/**
 * Fetch incidentes by motorista
 */
export async function fetchIncidentesByMotorista(
  motoristaId: string,
  options?: { status?: IncidenteStatus; limit?: number }
): Promise<QueryResult<IncidenteDB[]>> {
  return safeQuery(async () => {
    let query = supabase
      .from('incidentes')
      .select('*')
      .eq('motorista_id', motoristaId)
      .order('created_at', { ascending: false });

    if (options?.status) {
      query = query.eq('status', options.status);
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) throw error;
    return (data || []) as IncidenteDB[];
  });
}

/**
 * Create a new incidente
 */
export async function createIncidente(
  data: IncidenteInsert
): Promise<QueryResult<IncidenteDB>> {
  return withRetry(async () => {
    const { data: incidente, error } = await supabase
      .from('incidentes')
      .insert({
        ...data,
        status: data.status || 'aberto',
      })
      .select()
      .single();

    if (error) throw error;
    return incidente as IncidenteDB;
  }).then(
    (data) => ({ success: true as const, data }),
    (error) => ({ success: false as const, error: classifyError(error) })
  );
}

/**
 * Update incidente status
 */
export async function updateIncidenteStatus(
  incidenteId: string,
  status: IncidenteStatus,
  observacoes?: string | null
): Promise<QueryResult<IncidenteDB>> {
  return withRetry(async () => {
    const updateData: IncidenteUpdate = {
      status,
      observacoes_gestao: observacoes,
    };

    if (status === 'resolvido') {
      updateData.resolvido_em = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('incidentes')
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', incidenteId)
      .select()
      .single();

    if (error) throw error;
    return data as IncidenteDB;
  }).then(
    (data) => ({ success: true as const, data }),
    (error) => ({ success: false as const, error: classifyError(error) })
  );
}

/**
 * Update incidente fields
 */
export async function updateIncidente(
  incidenteId: string,
  data: IncidenteUpdate
): Promise<QueryResult<IncidenteDB>> {
  return withRetry(async () => {
    const { data: incidente, error } = await supabase
      .from('incidentes')
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', incidenteId)
      .select()
      .single();

    if (error) throw error;
    return incidente as IncidenteDB;
  }).then(
    (data) => ({ success: true as const, data }),
    (error) => ({ success: false as const, error: classifyError(error) })
  );
}

/**
 * Get incidentes statistics for a unit
 */
export async function fetchIncidentesStats(
  motoristasIds: string[]
): Promise<
  QueryResult<{
    total: number;
    abertos: number;
    emAnalise: number;
    resolvidos: number;
    fechados: number;
    porCategoria: Record<string, number>;
  }>
> {
  if (motoristasIds.length === 0) {
    return {
      success: true,
      data: {
        total: 0,
        abertos: 0,
        emAnalise: 0,
        resolvidos: 0,
        fechados: 0,
        porCategoria: {},
      },
    };
  }

  return safeQuery(async () => {
    const { data, error } = await supabase
      .from('incidentes')
      .select('id, status, categoria')
      .in('motorista_id', motoristasIds);

    if (error) throw error;

    const stats = {
      total: data?.length || 0,
      abertos: 0,
      emAnalise: 0,
      resolvidos: 0,
      fechados: 0,
      porCategoria: {} as Record<string, number>,
    };

    for (const inc of data || []) {
      switch (inc.status) {
        case 'aberto':
          stats.abertos++;
          break;
        case 'em_analise':
          stats.emAnalise++;
          break;
        case 'resolvido':
          stats.resolvidos++;
          break;
        case 'fechado':
          stats.fechados++;
          break;
      }
      stats.porCategoria[inc.categoria] =
        (stats.porCategoria[inc.categoria] || 0) + 1;
    }

    return stats;
  });
}

/**
 * Log incidente action
 */
export async function logIncidenteAction(
  usuarioId: string,
  incidenteId: string,
  evento: string,
  detalhes?: Record<string, unknown>
): Promise<void> {
  try {
    await supabase.from('logs').insert({
      usuario_id: usuarioId,
      evento,
      detalhes: {
        ...detalhes,
        incidente_id: incidenteId,
      },
    });
  } catch (error) {
    logger.warn('Failed to log incidente action:', error);
  }
}
