import { renderHook } from '@testing-library/react-native';

import { useFecharModalSemParada } from '../useFecharModalSemParada';

describe('useFecharModalSemParada', () => {
  it('aberto sem parada (recusada ou zerada pelos handlers): fecha', () => {
    const fechar = jest.fn();
    renderHook(() => useFecharModalSemParada(true, null, fechar));
    expect(fechar).toHaveBeenCalledTimes(1);
  });

  it('aberto com parada: não mexe', () => {
    const fechar = jest.fn();
    renderHook(() => useFecharModalSemParada(true, { id: 'p1' }, fechar));
    expect(fechar).not.toHaveBeenCalled();
  });

  it('fechado: não mexe, com ou sem parada', () => {
    const fechar = jest.fn();
    renderHook(() => useFecharModalSemParada(false, null, fechar));
    renderHook(() => useFecharModalSemParada(false, { id: 'p1' }, fechar));
    expect(fechar).not.toHaveBeenCalled();
  });

  it('a parada some com o modal aberto (motorista concluiu): fecha', () => {
    const fechar = jest.fn();
    const { rerender } = renderHook(
      (props: { parada: { id: string } | null }) =>
        useFecharModalSemParada(true, props.parada, fechar),
      { initialProps: { parada: { id: 'p1' } as { id: string } | null } },
    );
    expect(fechar).not.toHaveBeenCalled();

    rerender({ parada: null });

    expect(fechar).toHaveBeenCalledTimes(1);
  });
});
