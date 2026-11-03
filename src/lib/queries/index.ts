/**
 * Supabase Query Layer
 *
 * Centralized query services for all database operations.
 * Provides typed queries, automatic retry, caching, and error handling.
 *
 * Usage:
 * ```typescript
 * import { paradasQueries, usuariosQueries } from '@/lib/queries';
 *
 * // Update the status of a parada
 * const result = await paradasQueries.updateParadaStatus(paradaId, 'concluida');
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
  type QueryResult,
  type QueryError,
  type QueryErrorType,
} from './queryClient';

// Paradas queries
export * as paradasQueries from './paradas';
export type { ParadaDB as ParadaDBFromParadas, ParadaUpdate } from './paradas';

// Usuarios queries
export * as usuariosQueries from './usuarios';
export type { UsuarioDB, UsuarioUpdate as UsuarioUpdateType } from './usuarios';

// Incidentes queries
export * as incidentesQueries from './incidentes';
export type {
  IncidenteDB,
  IncidenteWithRelations,
  IncidenteInsert,
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
  // Paradas
  updateParadaStatus,
  logParadaAction,
} from './paradas';

export {
  // Usuarios
  updateUsuario,
} from './usuarios';

export {
  // Incidentes
  fetchIncidentesForGestor,
  createIncidente,
  logIncidenteAction,
} from './incidentes';

export {
  // Logs (centralized logging utilities)
  logAction,
  logUserAction,
  // Note: logRotaAction and logParadaAction are also available in paradas.ts
  // Use logsQueries.logRotaAction or logsQueries.logParadaAction for the centralized versions
} from './logs';
