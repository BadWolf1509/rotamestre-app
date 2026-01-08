/**
 * Supabase Query Layer
 *
 * Centralized query services for all database operations.
 * Provides typed queries, automatic retry, caching, and error handling.
 *
 * Usage:
 * ```typescript
 * import { rotasQueries, paradasQueries, usuariosQueries } from '@/lib/queries';
 *
 * // Fetch rotas with stats
 * const result = await rotasQueries.fetchRotasWithStats({ unidadeId });
 * if (result.success) {
 *   console.log(result.data);
 * } else {
 *   console.error(result.error.message);
 * }
 * ```
 */

// Query client utilities
export {
  supabase,
  withRetry,
  safeQuery,
  classifyError,
  buildCacheKey,
  type QueryResult,
  type QueryError,
  type QueryErrorType,
  ROTA_SELECT_FIELDS,
  PARADA_SELECT_FIELDS,
  USUARIO_SELECT_FIELDS,
} from './queryClient';

// Rotas queries
export * as rotasQueries from './rotas';
export type {
  RotaDB,
  ParadaDB,
  RotaWithRelations,
  RotaListItem,
  FetchRotasOptions,
  RotaInsert,
  RotaUpdate,
} from './rotas';

// Paradas queries
export * as paradasQueries from './paradas';
export type {
  ParadaDB as ParadaDBFromParadas,
  ParadaInsert,
  ParadaUpdate,
  ParadaWithDetails,
} from './paradas';

// Usuarios queries
export * as usuariosQueries from './usuarios';
export type {
  UsuarioDB,
  UsuarioUpdate as UsuarioUpdateType,
  UsuarioWithUnidades,
  MotoristaListItem,
} from './usuarios';

// Incidentes queries
export * as incidentesQueries from './incidentes';
export type {
  IncidenteDB,
  IncidenteWithRelations,
  IncidenteInsert,
  IncidenteUpdate,
  IncidenteStatus,
  IncidenteCategoria,
  FetchIncidentesOptions,
} from './incidentes';

// Logs queries
export * as logsQueries from './logs';
export type { LogEntry, LogDB, LogEvent } from './logs';
export { LOG_EVENTS } from './logs';

// Re-export individual functions for direct imports
export {
  // Rotas
  fetchRotasWithStats,
  fetchRotaDetalhada,
  fetchRotasAtivasMotorista,
  fetchRotaWithCache,
  createRota,
  updateRotaStatus,
  updateRota,
  deleteRota,
  assignMotoristaToRota,
  fetchRotasKPIs,
  logRotaAction,
} from './rotas';

export {
  // Paradas
  fetchParadasByRota,
  fetchParadaById,
  fetchCheckpointsByRota,
  fetchParadasStats,
  createParadasBatch,
  updateParadaStatus,
  completeParada,
  skipParada,
  updateParada,
  updateParadaOrder,
  deleteParada,
  deleteParadasByRota,
  fetchNextPendingParada,
  logParadaAction,
} from './paradas';

export {
  // Usuarios
  fetchCurrentUser,
  fetchCurrentUserWithCache,
  fetchMotoristasByUnidade,
  fetchMotoristasWithCache,
  fetchUsuarioById,
  fetchUsuariosByPapel,
  updateUsuario,
  updateUltimoAcesso,
  updateAvatarUrl,
  checkEmailExists,
  fetchMotoristaKPIs,
} from './usuarios';

export {
  // Incidentes
  fetchIncidentesForGestor,
  fetchIncidenteById,
  fetchIncidentesByMotorista,
  createIncidente,
  updateIncidenteStatus,
  updateIncidente,
  fetchIncidentesStats,
  logIncidenteAction,
} from './incidentes';

export {
  // Logs (centralized logging utilities)
  logAction,
  logUserAction,
  // Note: logRotaAction and logParadaAction are also available in rotas.ts and paradas.ts
  // Use logsQueries.logRotaAction or logsQueries.logParadaAction for the centralized versions
} from './logs';
