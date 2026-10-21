import { act, renderHook } from '@testing-library/react-native';
import * as Location from 'expo-location';
import { createRef } from 'react';

import { useLocationTracking } from '../useLocationTracking';

// Mock explícito: o automock do jest-expo não expõe
// getForegroundPermissionsAsync, que o hook consulta antes de pedir (#570).
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { High: 4 },
}));

const mockSetStop = jest.fn();

function makeCameraRef() {
  const ref = createRef<{ setStop: jest.Mock } | null>() as ReturnType<
    typeof createRef
  >;
  // @ts-expect-error - setting current on read-only ref for test
  ref.current = { setStop: mockSetStop };
  return ref;
}

describe('useLocationTracking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Consulta antes de pedir (#570): 'undetermined' mantém o pedido
    // exercitado nos cenários abaixo.
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'undetermined',
      canAskAgain: true,
    });
  });

  it('starts with isLocating=false', () => {
    const cameraRef = makeCameraRef();
    const { result } = renderHook(() => useLocationTracking(cameraRef as any));
    expect(result.current.isLocating).toBe(false);
  });

  // A seleção de um pino põe padding no topo da câmera (espaço do balão,
  // useBalaoSobreposto). "Minha localização" o zera de forma explícita, sem
  // depender do default da lib (setStop com center zera o que falta).
  it('centraliza no usuário zerando o padding deixado pela seleção', async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue(
      { status: 'granted' },
    );
    (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
      coords: { latitude: -23.55, longitude: -46.63 },
    });
    const cameraRef = makeCameraRef();
    const { result } = renderHook(() => useLocationTracking(cameraRef as any));

    await act(async () => {
      await result.current.handleCenterOnUser();
    });

    expect(mockSetStop).toHaveBeenCalledWith(
      expect.objectContaining({
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
      }),
    );
  });

  it('sets isLocating=true while requesting, then false after', async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue(
      { status: 'granted' },
    );
    (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
      coords: { latitude: -23.55, longitude: -46.63 },
    });

    const cameraRef = makeCameraRef();
    const { result } = renderHook(() => useLocationTracking(cameraRef as any));

    await act(async () => {
      await result.current.handleCenterOnUser();
    });

    expect(result.current.isLocating).toBe(false);
    expect(mockSetStop).toHaveBeenCalledTimes(1);
  });

  it('shows warning when permission denied', async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue(
      { status: 'denied' },
    );

    const cameraRef = makeCameraRef();
    const { result } = renderHook(() => useLocationTracking(cameraRef as any));

    await act(async () => {
      await result.current.handleCenterOnUser();
    });

    expect(global.mockUseAlert.showWarning).toHaveBeenCalledWith(
      'Permissão negada',
      expect.any(String),
    );
    expect(mockSetStop).not.toHaveBeenCalled();
  });

  it('shows error when location throws', async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue(
      { status: 'granted' },
    );
    (Location.getCurrentPositionAsync as jest.Mock).mockRejectedValue(
      new Error('Location error'),
    );

    const cameraRef = makeCameraRef();
    const { result } = renderHook(() => useLocationTracking(cameraRef as any));

    await act(async () => {
      await result.current.handleCenterOnUser();
    });

    expect(global.mockUseAlert.showError).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Erro' }),
    );
  });
});
