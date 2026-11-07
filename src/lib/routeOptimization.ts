/**
 * Route optimization - barrel re-export for backwards compatibility.
 *
 * Implementation has been split into focused modules under ./route-optimization/:
 * - types.ts: Interfaces and constants
 * - cache.ts: Two-tier cache (memory + AsyncStorage)
 * - cycleDetection.ts: DFS cycle detection in dependencies
 * - validation.ts: Route and dependency validation
 * - optimizer.ts: Main optimization algorithm
 */

export type {
  ParadaParaOtimizar,
  ResultadoOtimizacao,
  ValidacaoRotaResult,
} from './route-optimization/types';
export {
  MAX_ROUTE_STOPS,
  WAYPOINTS_RECOMENDADO,
} from './route-optimization/types';

// Cache (estatisticasCache e precarregarCache só servem de sonda aos testes)
export {
  limparCacheOtimizacao,
  estatisticasCache,
  precarregarCache,
} from './route-optimization/cache';

// Validation
export {
  validarVinculos,
  validarRotaParaOtimizacao,
} from './route-optimization/validation';

// Optimizer
export { otimizarRotaComDependencias } from './route-optimization/optimizer';
