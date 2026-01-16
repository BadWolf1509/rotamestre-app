/**
 * ParadaCard - Re-exports for clean imports
 */

export { ParadaCard } from './ParadaCard';
export { ParadaCardHeader } from './ParadaCardHeader';
export { ParadaCardAddress } from './ParadaCardAddress';
export { ParadaCardDetails } from './ParadaCardDetails';
export { PrimaryActions, RetomarButton, SwipeHint } from './ParadaCardActions';
export { styles as paradaCardStyles } from './ParadaCard.styles';

// Types
export type {
  Parada,
  ParadaCardProps,
  ParadaStatus,
  ParadaTipo,
  TipoInfo,
} from './ParadaCard.types';

// Utility functions
export {
  getTipoInfo,
  getStatusBadgeText,
  getStatusLabel,
  formatCompletionTime,
} from './ParadaCard.types';
