/**
 * MainCard - Re-export from new modular structure
 * This file maintains backwards compatibility with existing imports
 */

export { MainCard } from './MainCard/index';
export { MainCardNoRoute } from './MainCard/index';
export { MainCardPending } from './MainCard/index';
export { MainCardActive } from './MainCard/index';
export { MainCardReadyToComplete } from './MainCard/index';
export { MainCardCompleted } from './MainCard/index';

export type {
  MainCardProps,
  Parada,
  Rota,
  Location,
  NoRouteStats,
  ExpiredRouteData,
  LastRouteData,
} from './MainCard/index';

export {
  formatElapsedTime,
  formatEstimatedTime,
  calculateSuccessRate,
  filterRealStops,
} from './MainCard/index';
