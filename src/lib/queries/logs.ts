/**
 * Logging-related Supabase queries
 * Centralized audit trail operations
 */

import { logger } from '@/lib/logger';

import { supabase } from './queryClient';

/**
 * Log entry for audit trail
 */
export interface LogEntry {
  usuario_id: string;
  evento: string;
  rota_id?: string | null;
  /** Conveniência da API: `logAction` dobra este valor dentro de `detalhes`. */
  parada_id?: string | null;
  detalhes?: Record<string, unknown> | null;
}

/**
 * Linha da tabela `logs` como ela realmente é.
 *
 * Antes esta interface declarava `parada_id` e `criado_em` — nenhum dos dois
 * existe: a coluna de data chama-se `timestamp`, e a parada nunca teve coluna
 * própria. Um tipo que descreve um schema imaginário não protege ninguém; foi
 * ele que deu cobertura ao insert que falhava em silêncio.
 */
export interface LogDB {
  id: string;
  usuario_id: string | null;
  evento: string;
  rota_id: string | null;
  detalhes: Record<string, unknown> | null;
  timestamp: string;
}

/**
 * Log an action to the audit trail (fire-and-forget)
 * Failures are logged but don't throw - logging should never break the app
 */
export async function logAction(entry: LogEntry): Promise<void> {
  try {
    // A tabela `logs` tem exatamente: id, usuario_id, rota_id, evento,
    // detalhes, timestamp. **Não existe coluna `parada_id`** — mandá-la fazia o
    // PostgREST recusar com 400, e como a falha só virava `logger.warn`, todo o
    // rastro que passa por aqui morria em silêncio (a auditoria de gestão de
    // motoristas parou em dez/2025 por isso). O vínculo com a parada vai em
    // `detalhes`, que é o padrão já usado em useAddStopForm, useEditStopForm e
    // routeUtils. Os eventos de parada/rota continuam cobertos pelos triggers
    // `log_parada_status` e `log_rota_status`, no banco.
    const { error } = await supabase.from('logs').insert({
      usuario_id: entry.usuario_id,
      evento: entry.evento,
      rota_id: entry.rota_id ?? null,
      detalhes: entry.parada_id
        ? { ...(entry.detalhes ?? {}), parada_id: entry.parada_id }
        : (entry.detalhes ?? null),
    });

    if (error) {
      logger.warn('Failed to log action:', { evento: entry.evento, error });
    }
  } catch (error) {
    logger.warn('Failed to log action:', { evento: entry.evento, error });
  }
}

/**
 * Log route-related action
 */
export async function logRotaAction(
  usuarioId: string,
  rotaId: string,
  evento: string,
  detalhes?: Record<string, unknown>,
): Promise<void> {
  return logAction({
    usuario_id: usuarioId,
    evento,
    rota_id: rotaId,
    detalhes,
  });
}

/**
 * Log parada-related action
 */
export async function logParadaAction(
  usuarioId: string,
  paradaId: string,
  rotaId: string,
  evento: string,
  detalhes?: Record<string, unknown>,
): Promise<void> {
  return logAction({
    usuario_id: usuarioId,
    evento,
    rota_id: rotaId,
    parada_id: paradaId,
    detalhes,
  });
}

/**
 * Log user-related action (no rota/parada context)
 */
export async function logUserAction(
  usuarioId: string,
  evento: string,
  detalhes?: Record<string, unknown>,
): Promise<void> {
  return logAction({
    usuario_id: usuarioId,
    evento,
    detalhes,
  });
}

/**
 * Common log events
 */
export const LOG_EVENTS = {
  // Rota events
  ROTA_CRIADA: 'rota_criada',
  ROTA_INICIADA: 'rota_iniciada',
  ROTA_CONCLUIDA: 'rota_concluida',
  ROTA_CANCELADA: 'rota_cancelada',
  ROTA_ATRIBUIDA: 'rota_atribuida',
  ROTA_EXCLUIDA: 'rota_excluida',

  // Parada events
  PARADA_CONCLUIDA: 'parada_concluida',
  PARADA_PULADA: 'parada_pulada',
  PARADA_FOTO_ENVIADA: 'parada_foto_enviada',

  // Incidente events
  INCIDENTE_CRIADO: 'incidente_criado',
  INCIDENTE_STATUS_ALTERADO: 'incidente_status_alterado',

  // User events
  MOTORISTA_CRIADO: 'motorista_criado',
  MOTORISTA_ATUALIZADO: 'motorista_atualizado',
  MOTORISTA_DESATIVADO: 'motorista_desativado',
  PERFIL_ATUALIZADO: 'perfil_atualizado',
} as const;

export type LogEvent = (typeof LOG_EVENTS)[keyof typeof LOG_EVENTS];
