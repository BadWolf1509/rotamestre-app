/**
 * Hook for navigation-related actions in MapaMobile
 *
 * Handles:
 * - Computing the next pending parada
 * - Opening the external navigation app (showNavigationOptions)
 * - Fitting all paradas into the map viewport (handleFitAll)
 */

import { useCallback, useMemo, type RefObject } from 'react';

import { useMapFitPadding } from '@/components/map/mobile/useMapFitPadding';
import { useAlert } from '@/hooks/useAlert';
import { getBounds } from '@/lib/maplibre';
import type { ParadaMapItem as Parada } from '@/types/parada-map';
import { showNavigationOptions } from '@/utils/navigation';

import type { CameraRef } from '@maplibre/maplibre-react-native';

interface UseNavigationActionsResult {
  proximaParadaPendente: Parada | undefined;
  handleNavigate: () => void;
  handleFitAll: () => void;
}

/**
 * Provides navigation handlers: open external navigation for next stop
 * and fit all paradas into the map viewport.
 */
export function useNavigationActions(
  paradasReais: Parada[],
  paradasComCoord: Parada[],
  cameraRef: RefObject<CameraRef | null>,
): UseNavigationActionsResult {
  const { showWarning } = useAlert();
  const fitPadding = useMapFitPadding();

  const proximaParadaPendente = useMemo(
    () =>
      paradasReais
        .filter((p) => p.status === 'pendente' || p.status === 'em_andamento')
        .sort((a, b) => a.ordem - b.ordem)[0],
    [paradasReais],
  );

  const handleNavigate = useCallback(() => {
    if (!proximaParadaPendente) {
      showWarning('Nenhuma parada', 'Não há paradas pendentes para navegar.');
      return;
    }

    showNavigationOptions({
      latitude: proximaParadaPendente.latitude!,
      longitude: proximaParadaPendente.longitude!,
      label: `Parada ${proximaParadaPendente.ordem} - ${proximaParadaPendente.endereco}`,
    });
  }, [proximaParadaPendente, showWarning]);

  const handleFitAll = useCallback(() => {
    if (paradasComCoord.length > 0 && cameraRef.current) {
      const bounds = getBounds(
        paradasComCoord.map((parada) => ({
          latitude: parada.latitude!,
          longitude: parada.longitude!,
        })),
      );
      if (!bounds) return;
      cameraRef.current.fitBounds(
        [bounds.sw[0], bounds.sw[1], bounds.ne[0], bounds.ne[1]],
        {
          padding: fitPadding,
          duration: 500,
        },
      );
    }
  }, [cameraRef, paradasComCoord, fitPadding]);

  return { proximaParadaPendente, handleNavigate, handleFitAll };
}
