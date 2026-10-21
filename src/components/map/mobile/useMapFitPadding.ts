/**
 * Padding usado nos `fitBounds` do mapa mobile.
 *
 * A coluna de FABs (ajustar, centralizar, navegar) flutua sobre o canto
 * inferior direito do mapa. Os dois `fitBounds` existentes usavam
 * `right: 50` escrito a mao, menor que a largura real da coluna — entao
 * marcadores proximos da borda direita nasciam ATRAS dos botoes. Foi assim que
 * a parada 2 apareceu escondida no teste em aparelho (moto g15, build 3026).
 *
 * O valor sai dos mesmos tokens que dimensionam os botoes, para nao voltar a
 * divergir quando alguem mudar o tamanho do FAB.
 */

import { useMemo } from 'react';

import { useUnistyles } from '@/utils/styles';

export interface MapFitPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export function useMapFitPadding(): MapFitPadding {
  const { theme } = useUnistyles();
  // Memo pelos VALORES: o `theme` do Unistyles é um objeto novo a cada render
  // no aparelho, e um padding novo a cada render re-agendava o fitBounds de
  // useMobileMapCamera, devolvendo o mapa à visão geral (PR #594).
  const toque = theme.components.minTouchTarget;
  const fab = theme.spacing['14'];
  const folga = theme.spacing['4'];
  const margem = theme.spacing['12'];

  return useMemo(() => {
    // O maior dos dois botoes define a largura da coluna.
    const larguraColuna = Math.max(toque, fab);
    // `fabContainer` encosta a coluna a `spacing[4]` da borda; a folga extra
    // impede que o marcador fique colado no botao.
    return {
      top: margem,
      right: larguraColuna + folga * 2,
      bottom: larguraColuna + folga * 2,
      left: margem,
    };
  }, [toque, fab, folga, margem]);
}
