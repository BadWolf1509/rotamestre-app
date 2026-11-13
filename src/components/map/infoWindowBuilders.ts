/**
 * Status helpers para componentes de mapa
 *
 * Resolvem o label de status de parada para uso nos marcadores
 * (web MapLibre e mobile). Centralizados para manter consistência visual.
 *
 * NOTA: os builders de InfoWindow (HTML/DOM) do antigo mapa Google Maps web
 * foram removidos junto com os hooks Google Maps (mapa atual é MapLibre).
 */

import { getStatusLabel as getStatusLabelFromConfig } from '@/constants/statusConfig';

// ============================================================================
// Utility Functions (delegating to centralized statusConfig)
// ============================================================================

export function getStatusLabel(status?: string): string {
  if (!status) return '';
  return getStatusLabelFromConfig(
    status as Parameters<typeof getStatusLabelFromConfig>[0],
  );
}
