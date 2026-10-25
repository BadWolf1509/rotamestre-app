/**
 * Revalidação quando o app volta ao primeiro plano (DP-2): com o app em
 * segundo plano o socket do Realtime cai e o evento perdido não volta.
 */
import { renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';

import { useAoVoltarParaPrimeiroPlano } from '../useAoVoltarParaPrimeiroPlano';

function espiarAppState(inicial: string = 'active') {
  const remove = jest.fn();
  // Todos os ouvintes: o ambiente de teste do RN também registra o seu.
  const ouvintes: ((estado: string) => void)[] = [];
  Object.defineProperty(AppState, 'currentState', {
    value: inicial,
    configurable: true,
  });
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_evento: string, cb: (estado: string) => void) => {
      ouvintes.push(cb);
      return { remove } as never;
    });
  const inscricoes = () =>
    (AppState.addEventListener as jest.Mock).mock.calls.length;
  return {
    remove,
    inscricoes,
    disparar: (estado: string) => ouvintes.forEach((cb) => cb(estado)),
  };
}

afterEach(() => jest.restoreAllMocks());

describe('useAoVoltarParaPrimeiroPlano', () => {
  it('chama ao voltar de segundo plano, não a cada "active" repetido', () => {
    const app = espiarAppState('active');
    const aoVoltar = jest.fn();
    renderHook(() => useAoVoltarParaPrimeiroPlano(aoVoltar));

    app.disparar('active');
    expect(aoVoltar).not.toHaveBeenCalled();

    app.disparar('background');
    app.disparar('active');
    expect(aoVoltar).toHaveBeenCalledTimes(1);

    app.disparar('inactive');
    app.disparar('active');
    expect(aoVoltar).toHaveBeenCalledTimes(2);
  });

  it('usa o callback mais recente sem se reinscrever, e sai no unmount', () => {
    const app = espiarAppState('background');
    const primeiro = jest.fn();
    const segundo = jest.fn();
    const { rerender, unmount } = renderHook(
      ({ cb }) => useAoVoltarParaPrimeiroPlano(cb),
      { initialProps: { cb: primeiro } },
    );
    const depoisDeMontar = app.inscricoes();
    const removidosAntes = app.remove.mock.calls.length;
    rerender({ cb: segundo });

    app.disparar('active');
    expect(primeiro).not.toHaveBeenCalled();
    expect(segundo).toHaveBeenCalledTimes(1);
    expect(app.inscricoes()).toBe(depoisDeMontar);

    unmount();
    expect(app.remove.mock.calls.length).toBeGreaterThan(removidosAntes);
  });

  it('desligado, não escuta', () => {
    const app = espiarAppState('background');
    const aoVoltar = jest.fn();
    renderHook(() => useAoVoltarParaPrimeiroPlano(aoVoltar, false));
    app.disparar('active');
    expect(aoVoltar).not.toHaveBeenCalled();
  });
});
