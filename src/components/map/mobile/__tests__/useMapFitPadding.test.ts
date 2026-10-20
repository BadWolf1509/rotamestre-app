/**
 * useMapFitPadding – identidade estável entre renders.
 *
 * POR QUE EXISTE. O padding é dependência do efeito que faz o `fitBounds`
 * inicial (useMobileMapCamera). No aparelho, o `useUnistyles()` devolve um
 * objeto `theme` NOVO a cada render; com o memo em `[theme]`, o padding
 * mudava sempre e o efeito re-agendava o fitBounds a cada render: 500 ms
 * depois do último, o mapa voltava para a visão geral. Medido em 20/10/2026
 * no moto g15 (PR #594): selecionar um pino centralizava e o mapa voltava; o
 * balão sobreposto, que re-renderiza o mapa, virava um laço.
 */

import { renderHook } from '@testing-library/react-native';

const tokens = () => ({
  components: { minTouchTarget: 44 },
  spacing: { '4': 16, '12': 48, '14': 56 },
});

// Como no aparelho: objeto novo a cada chamada, mesmos valores.
jest.mock('@/utils/styles', () => ({
  useUnistyles: () => ({ theme: tokens() }),
}));

import { useMapFitPadding } from '../useMapFitPadding';

describe('useMapFitPadding', () => {
  it('devolve o mesmo objeto quando o tema muda de identidade, mas não de valor', () => {
    const { result, rerender } = renderHook(() => useMapFitPadding());
    const primeiro = result.current;

    rerender({});

    expect(result.current).toBe(primeiro);
  });

  it('deixa espaço para a coluna de FABs à direita e embaixo', () => {
    const { result } = renderHook(() => useMapFitPadding());
    expect(result.current).toEqual({
      top: 48,
      right: 56 + 16 * 2,
      bottom: 56 + 16 * 2,
      left: 48,
    });
  });
});
