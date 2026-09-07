import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';
import { AppState } from 'react-native';

import { useRevalidarPermissaoDeLocalizacao } from '../useRevalidarPermissaoDeLocalizacao';

jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest.fn(),
}));

/** Captura o listener registrado, para dispará-lo à mão. */
function espiarAppState() {
  const remove = jest.fn();
  let ouvinte: ((estado: string) => void) | null = null;
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_evento: string, cb: (estado: string) => void) => {
      ouvinte = cb;
      return { remove } as never;
    });
  return {
    remove,
    disparar: (estado: string) => ouvinte?.(estado),
  };
}

describe('useRevalidarPermissaoDeLocalizacao', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
    });
  });

  afterEach(() => jest.restoreAllMocks());

  it('avisa que a permissão foi concedida quando o app volta ao foreground', async () => {
    const app = espiarAppState();
    const aoRevalidar = jest.fn();
    renderHook(() => useRevalidarPermissaoDeLocalizacao(aoRevalidar));

    await act(async () => {
      app.disparar('active');
    });

    await waitFor(() => expect(aoRevalidar).toHaveBeenCalledWith(true));
  });

  it('avisa que segue negada', async () => {
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'denied',
    });
    const app = espiarAppState();
    const aoRevalidar = jest.fn();
    renderHook(() => useRevalidarPermissaoDeLocalizacao(aoRevalidar));

    await act(async () => {
      app.disparar('active');
    });

    await waitFor(() => expect(aoRevalidar).toHaveBeenCalledWith(false));
  });

  it('não consulta a permissão em estados que não são active', async () => {
    const app = espiarAppState();
    renderHook(() => useRevalidarPermissaoDeLocalizacao(jest.fn()));

    await act(async () => {
      app.disparar('background');
      app.disparar('inactive');
    });

    expect(Location.getForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it('remove o listener ao desmontar', () => {
    const app = espiarAppState();
    const { unmount } = renderHook(() =>
      useRevalidarPermissaoDeLocalizacao(jest.fn()),
    );
    unmount();
    expect(app.remove).toHaveBeenCalledTimes(1);
  });

  it('não reinscreve o listener quando só o callback muda de identidade', () => {
    espiarAppState();
    const { rerender } = renderHook(
      ({ cb }) => useRevalidarPermissaoDeLocalizacao(cb),
      { initialProps: { cb: jest.fn() } },
    );
    rerender({ cb: jest.fn() });

    expect(AppState.addEventListener).toHaveBeenCalledTimes(1);
  });

  it('chama o callback mais recente', async () => {
    const app = espiarAppState();
    const primeiro = jest.fn();
    const segundo = jest.fn();
    const { rerender } = renderHook(
      ({ cb }) => useRevalidarPermissaoDeLocalizacao(cb),
      { initialProps: { cb: primeiro } },
    );
    rerender({ cb: segundo });

    await act(async () => {
      app.disparar('active');
    });

    await waitFor(() => expect(segundo).toHaveBeenCalled());
    expect(primeiro).not.toHaveBeenCalled();
  });
});
