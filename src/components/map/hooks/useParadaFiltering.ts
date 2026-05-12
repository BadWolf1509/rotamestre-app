/**
 * Hook for filtering and categorizing paradas in MapaMobile
 *
 * Pure data transforms — no side effects.
 *
 * Returns:
 * - paradasComCoord: paradas with valid lat/lng
 * - paradasReais: paradas that are NOT checkpoints (is_checkpoint !== false means real deliveries)
 * - paradasFiltradas: paradasReais filtered by statusFilter
 * - checkpoints: paradas that ARE checkpoints (is_checkpoint === false in DB means unit markers)
 * - hasParadasComCoordenadas: boolean shorthand
 */

import { useMemo } from 'react';

import type { ParadaMapItem as Parada, StatusFilter } from '@/types/parada-map';

interface UseParadaFilteringResult {
  paradasComCoord: Parada[];
  paradasReais: Parada[];
  paradasFiltradas: Parada[];
  checkpoints: Parada[];
  hasParadasComCoordenadas: boolean;
}

/**
 * Memoized filtering of paradas by coordinate validity, checkpoint status,
 * and status filter.
 *
 * Note: `is_checkpoint !== false` selects real delivery stops (null/undefined/true are real).
 * `is_checkpoint === false` selects unit checkpoint markers (PARTIDA/CHEGADA).
 */
export function useParadaFiltering(
  paradas: Parada[],
  statusFilter: StatusFilter = 'all',
): UseParadaFilteringResult {
  const paradasComCoord = useMemo(
    () => paradas.filter((p) => p.latitude !== null && p.longitude !== null),
    [paradas],
  );

  const hasParadasComCoordenadas = paradasComCoord.length > 0;

  const paradasReais = useMemo(
    () => paradasComCoord.filter((p) => p.is_checkpoint !== false),
    [paradasComCoord],
  );

  const paradasFiltradas = useMemo(() => {
    if (statusFilter === 'all') return paradasReais;
    return paradasReais.filter((p) => p.status === statusFilter);
  }, [paradasReais, statusFilter]);

  const checkpoints = useMemo(
    () => paradasComCoord.filter((p) => p.is_checkpoint === false),
    [paradasComCoord],
  );

  return {
    paradasComCoord,
    paradasReais,
    paradasFiltradas,
    checkpoints,
    hasParadasComCoordenadas,
  };
}
