/**
 * Route optimization - barrel re-export for backwards compatibility.
 *
 * Implementation has been split into focused modules under ./route-optimization/:
 * - types.ts: Interfaces and constants
 * - cache.ts: Two-tier cache (memory + AsyncStorage)
 * - cycleDetection.ts: DFS cycle detection in dependencies
 * - validation.ts: Route and dependency validation
 * - optimizer.ts: Main optimization algorithm
 * - utils.ts: Display and filtering utilities
 */

export {
  // Types
  type ParadaParaOtimizar,
  type ResultadoOtimizacao,
  type ValidacaoRotaResult,
  // Constants
  MAX_WAYPOINTS,
  WAYPOINTS_RECOMENDADO,
  // Cache
  limparCacheOtimizacao,
  estatisticasCache,
  precarregarCache,
  // Validation
  validarVinculos,
  validarRotaParaOtimizacao,
  // Optimizer
  otimizarRotaComDependencias,
  // Utils
  formatarDescricaoVinculo,
  encontrarRetiradasDisponiveis,
} from './route-optimization';
