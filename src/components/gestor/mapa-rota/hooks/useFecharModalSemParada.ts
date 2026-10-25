/**
 * Mantém a flag de um modal coerente com a parada que ele mostra.
 *
 * Os handlers zeram `paradaToEdit`/`paradaToRemove` quando recusam o clique ou
 * quando a parada deixa de ser alterável (o motorista concluiu ou iniciou),
 * mas a flag `show…Modal` vive em outro hook e ficava `true` sem parada — um
 * uso futuro da flag sozinha reabriria o modal. Aberto sem parada, fecha.
 */

import { useEffect } from 'react';

export function useFecharModalSemParada(
  aberto: boolean,
  parada: unknown,
  fechar: () => void,
): void {
  useEffect(() => {
    if (aberto && !parada) fechar();
  }, [aberto, parada, fechar]);
}
