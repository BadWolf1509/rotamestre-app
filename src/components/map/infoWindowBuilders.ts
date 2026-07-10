/**
 * Status helpers para componentes de mapa
 *
 * Resolvem cor e label de status de parada para uso nos marcadores
 * (web MapLibre e mobile). Centralizados para manter consistência visual.
 *
 * NOTA: os builders de InfoWindow (HTML/DOM) do antigo mapa Google Maps web
 * foram removidos junto com os hooks Google Maps (mapa atual é MapLibre).
 */

import {
  getStatusColor as getStatusColorFromConfig,
  getStatusLabel as getStatusLabelFromConfig,
  type StatusColorKey,
} from '@/constants/statusConfig';
import { INFO_WINDOW_COLORS } from '@/utils/webTokens';

// ============================================================================
// Color Resolver
// ============================================================================

/**
 * Maps statusColorKey to actual hex color from INFO_WINDOW_COLORS.
 * Used as resolver for getStatusColor from statusConfig.
 */
function infoWindowColorResolver(colorKey: StatusColorKey): string {
  const statusColors = INFO_WINDOW_COLORS.status;
  switch (colorKey) {
    case 'success':
      return statusColors.success;
    case 'info':
      return statusColors.info;
    case 'error':
      return statusColors.error;
    case 'warning':
      return statusColors.warning;
    case 'gray600':
      return statusColors.muted;
    default:
      return statusColors.warning;
  }
}

// ============================================================================
// Utility Functions (delegating to centralized statusConfig)
// ============================================================================

export function getStatusColor(status?: string): string {
  return getStatusColorFromConfig(status, infoWindowColorResolver);
}

export function getStatusLabel(status?: string): string {
  if (!status) return '';
  return getStatusLabelFromConfig(
    status as Parameters<typeof getStatusLabelFromConfig>[0],
  );
}
