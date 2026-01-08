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
