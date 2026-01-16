/**
 * ParadaCard - Re-export from new modular structure
 * This file maintains backwards compatibility with existing imports
 */

export {
  ParadaCard,
  ParadaCardHeader,
  ParadaCardAddress,
  ParadaCardDetails,
  PrimaryActions,
  RetomarButton,
  SwipeHint,
  paradaCardStyles,
} from './ParadaCard/index';

export type {
  Parada,
  ParadaCardProps,
  ParadaStatus,
  ParadaTipo,
  TipoInfo,
} from './ParadaCard/index';

export {
  getTipoInfo,
  getStatusBadgeText,
  getStatusLabel,
  formatCompletionTime,
} from './ParadaCard/index';
