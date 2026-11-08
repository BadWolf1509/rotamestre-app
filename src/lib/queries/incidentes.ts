/**
 * Incident-related Supabase queries
 * Centralized query layer for incidentes table operations
 */

import { nomeDoMotorista } from '@/lib/incidentes/nomeDoMotorista';

import { logAction } from './logs';
import {
  supabase,
  safeQuery,
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
  'accident' | 'absent' | 'wrong_address' | 'blocked' | 'vehicle' | 'other';

/**
 * Base incidente fields from database
 */
export interface IncidenteDB {
  id: string;
  /** NULL = conta do motorista excluída (Migration 56). */
  motorista_id: string | null;
  rota_id: string | null;
  parada_id: string | null;
  categoria: IncidenteCategoria;
  descricao: string;
  endereco: string;
  foto_url: string | null;
  status: IncidenteStatus;
  observacoes_gestao: string | null;
  resolvido_em: string | null;
  /**
   * Loja do incidente, gravada pelo servidor (gatilho da Migration 43): a da
   * rota; sem rota, a do vínculo ativo do motorista. O app não a envia.
   */
  unidade_id: string | null;
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
  /** NULL = conta do motorista excluída (Migration 56). */
  motorista_id: string | null;
  unidade_nome: string;
  rota_id: string | null;
  rota_data: string | null;
  parada_endereco: string | null;
}

/**
 * Incidente insert data
 */
export interface IncidenteInsert {
  /**
   * Gerado no aparelho: o mesmo id vai para a fila offline se a resposta do
   * INSERT se perder, e a chave primária impede a segunda linha.
   */
  id?: string;
  motorista_id: string;
  categoria: IncidenteCategoria;
  descricao: string;
  endereco: string;
  foto_url?: string | null;
  rota_id?: string | null;
  parada_id?: string | null;
  status?: IncidenteStatus;
}

/**
 * Fetch options for incidentes list
 */
export interface FetchIncidentesOptions {
  motoristasIds: string[];
  /**
   * Só os incidentes gravados nesta loja (`incidentes.unidade_id`).
   * Obrigatório: sem ele a consulta cairia em todas as lojas que a RLS deixa ver.
   */
  unidadeId: string;
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
  motorista_id: string | null;
  motorista: { nome: string } | null;
  rota: { id: string; data: string } | null;
  parada: { endereco: string } | null;
}

/**
 * Fetch incidentes with relations for gestor view
 */
export async function fetchIncidentesForGestor(
  options: FetchIncidentesOptions,
): Promise<QueryResult<IncidenteWithRelations[]>> {
  const { motoristasIds, unidadeId, status, categoria, limit = 100 } = options;

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
      `,
      )
      .in('motorista_id', motoristasIds)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (unidadeId) {
      query = query.eq('unidade_id', unidadeId);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (categoria) {
      query = query.eq('categoria', categoria);
    }

    const { data, error } = await query.returns<IncidenteQueryRow[]>();

    if (error) throw error;

    return (data || []).map((row) => {
      return {
        id: row.id,
        categoria: row.categoria,
        descricao: row.descricao,
        endereco: row.endereco,
        status: row.status,
        foto_url: row.foto_url,
        created_at: row.created_at,
        observacoes_gestao: row.observacoes_gestao,
        motorista_nome: nomeDoMotorista(row.motorista_id, row.motorista?.nome),
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
 * Create a new incidente
 *
 * Sem `withRetry`: INSERT sem chave de idempotência, e a resposta perdida
 * depois do commit (rede caindo, 5xx do gateway) faria a repetição gravar o
 * incidente de novo — e notificar os gestores de novo. O wizard guarda o
 * rascunho e o motorista tenta outra vez. Alternativa descartada: `id` gerado
 * no cliente para a repetição bater no PK — só cobriria a repetição
 * automática se o wizard guardasse o id entre tentativas manuais, e ainda
 * pediria ler de volta a linha no 23505.
 */
export async function createIncidente(
  data: IncidenteInsert,
): Promise<QueryResult<IncidenteDB>> {
  return (async () => {
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
  })().then(
    (data) => ({ success: true as const, data }),
    (error) => ({ success: false as const, error: classifyError(error) }),
  );
}

/**
 * Log incidente action
 */
export async function logIncidenteAction(
  usuarioId: string,
  incidenteId: string,
  evento: string,
  detalhes?: Record<string, unknown>,
): Promise<void> {
  return logAction({
    usuario_id: usuarioId,
    evento,
    detalhes: { ...detalhes, incidente_id: incidenteId },
  });
}
