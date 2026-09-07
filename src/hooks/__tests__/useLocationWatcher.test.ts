import { act, renderHook } from '@testing-library/react-native';
import * as Location from 'expo-location';

import { logger } from '@/lib/logger';

import {
  useLocationWatcher,
  type OpcoesDoWatcher,
} from '../useLocationWatcher';

jest.mock('expo-location', () => ({
  watchPositionAsync: jest.fn(),
  Accuracy: { BestForNavigation: 6, Balanced: 3, High: 4 },
}));

const OPCOES: OpcoesDoWatcher = {
  accuracy: 6 as Location.LocationAccuracy,
  timeInterval: 1000,
  distanceInterval: 5,
};

describe('useLocationWatcher', () => {
  beforeEach(() => jest.clearAllMocks());

  it('remove a assinatura que nasce DEPOIS do unmount', async () => {
    const remove = jest.fn();
    let resolver!: (s: { remove: jest.Mock }) => void;
    (Location.watchPositionAsync as jest.Mock).mockReturnValue(
      new Promise((res) => {
        resolver = res;
      }),
    );

    const { unmount } = renderHook(() =>
      useLocationWatcher({
        enabled: true,
        options: OPCOES,
        onLocation: jest.fn(),
      }),
    );

    // Desmonta ANTES de a promessa do watcher resolver. É esta ordem que
    // reproduz o defeito: sem ela o teste passa com o código quebrado.
    unmount();
    await act(async () => {
      resolver({ remove });
    });

    expect(remove).toHaveBeenCalledTimes(1);
  });

  // MENOR 1: falha ao LIMPAR uma assinatura cancelada é um diagnóstico
  // diferente de falha ao INICIAR o watcher - cada um precisa da sua própria
  // mensagem, para não confundir os dois ao ler os logs.
  it('usa uma mensagem própria quando falha ao remover uma assinatura cancelada, distinta da falha ao iniciar', async () => {
    const remove = jest.fn(() => {
      throw new Error('remove indisponível');
    });
    let resolver!: (s: { remove: jest.Mock }) => void;
    (Location.watchPositionAsync as jest.Mock).mockReturnValue(
      new Promise((res) => {
        resolver = res;
      }),
    );
    const loggerSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});

    const { unmount } = renderHook(() =>
      useLocationWatcher({
        enabled: true,
        options: OPCOES,
        onLocation: jest.fn(),
      }),
    );

    // Mesma ordem do teste acima: desmonta ANTES de a promessa resolver, para
    // cair no ramo `cancelado` que chama `s.remove()`.
    unmount();
    await act(async () => {
      resolver({ remove });
    });

    expect(loggerSpy).toHaveBeenCalledWith(
      '[useLocationWatcher] Falha ao remover a assinatura cancelada',
      expect.any(Error),
    );
    expect(loggerSpy).not.toHaveBeenCalledWith(
      '[useLocationWatcher] Falha ao iniciar o watcher',
      expect.anything(),
    );

    loggerSpy.mockRestore();
  });

  it('remove a assinatura no unmount normal', async () => {
    const remove = jest.fn();
    (Location.watchPositionAsync as jest.Mock).mockResolvedValue({ remove });

    const { unmount } = renderHook(() =>
      useLocationWatcher({
        enabled: true,
        options: OPCOES,
        onLocation: jest.fn(),
      }),
    );
    await act(async () => {});
    unmount();

    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('não cria watcher com enabled: false', async () => {
    (Location.watchPositionAsync as jest.Mock).mockResolvedValue({
      remove: jest.fn(),
    });

    renderHook(() =>
      useLocationWatcher({
        enabled: false,
        options: OPCOES,
        onLocation: jest.fn(),
      }),
    );
    await act(async () => {});

    expect(Location.watchPositionAsync).not.toHaveBeenCalled();
  });

  it('não recria o watcher quando só o callback muda de identidade', async () => {
    (Location.watchPositionAsync as jest.Mock).mockResolvedValue({
      remove: jest.fn(),
    });

    const { rerender } = renderHook(
      ({ cb }) =>
        useLocationWatcher({ enabled: true, options: OPCOES, onLocation: cb }),
      { initialProps: { cb: jest.fn() } },
    );
    await act(async () => {});
    rerender({ cb: jest.fn() });
    await act(async () => {});

    expect(Location.watchPositionAsync).toHaveBeenCalledTimes(1);
  });

  it('não recria o watcher quando só o objeto de opções muda de identidade', async () => {
    (Location.watchPositionAsync as jest.Mock).mockResolvedValue({
      remove: jest.fn(),
    });

    const { rerender } = renderHook(
      ({ opcoes }) =>
        useLocationWatcher({
          enabled: true,
          options: opcoes,
          onLocation: jest.fn(),
        }),
      { initialProps: { opcoes: { ...OPCOES } } },
    );
    await act(async () => {});
    rerender({ opcoes: { ...OPCOES } });
    await act(async () => {});

    expect(Location.watchPositionAsync).toHaveBeenCalledTimes(1);
  });

  it('entrega a localização ao callback mais recente', async () => {
    let emitir!: (l: unknown) => void;
    (Location.watchPositionAsync as jest.Mock).mockImplementation(
      async (_opcoes, cb) => {
        emitir = cb;
        return { remove: jest.fn() };
      },
    );

    const primeiro = jest.fn();
    const segundo = jest.fn();
    const { rerender } = renderHook(
      ({ cb }) =>
        useLocationWatcher({ enabled: true, options: OPCOES, onLocation: cb }),
      { initialProps: { cb: primeiro } },
    );
    await act(async () => {});
    rerender({ cb: segundo });
    await act(async () => {
      emitir({ coords: { latitude: -23.5, longitude: -46.6 } });
    });

    expect(primeiro).not.toHaveBeenCalled();
    expect(segundo).toHaveBeenCalledTimes(1);
  });
});
