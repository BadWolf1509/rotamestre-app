/**
 * Route optimization module.
 *
 * Optimizes delivery routes respecting pickup/delivery dependencies,
 * with two-tier caching (memory + AsyncStorage) and cycle detection.
 *
 * Re-exports everything for backwards compatibility with
 * `import { ... } from '@/lib/routeOptimization'`.
 */

// Types
export type {
  ParadaParaOtimizar,
  ResultadoOtimizacao,
  ValidacaoRotaResult,
} from './types';
export { MAX_WAYPOINTS, WAYPOINTS_RECOMENDADO } from './types';

// Cache
export {
  limparCacheOtimizacao,
  estatisticasCache,
  precarregarCache,
} from './cache';

// Validation
export { validarVinculos, validarRotaParaOtimizacao } from './validation';

// Optimizer
export { otimizarRotaComDependencias } from './optimizer';

// Utils
export { formatarDescricaoVinculo, encontrarRetiradasDisponiveis } from './utils';
