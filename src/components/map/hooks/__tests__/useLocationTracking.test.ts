import { act, renderHook } from '@testing-library/react-native';
import * as Location from 'expo-location';
import { createRef } from 'react';

import { useLocationTracking } from '../useLocationTracking';

// expo-location is mocked globally via jest.setup.js / jest-expo

const mockSetCamera = jest.fn();

function makeCameraRef() {
  const ref = createRef<{ setCamera: jest.Mock } | null>() as ReturnType<
    typeof createRef
  >;
  // @ts-expect-error - setting current on read-only ref for test
  ref.current = { setCamera: mockSetCamera };
  return ref;
}

describe('useLocationTracking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('starts with isLocating=false', () => {
    const cameraRef = makeCameraRef();
    const { result } = renderHook(() => useLocationTracking(cameraRef as any));
    expect(result.current.isLocating).toBe(false);
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
    expect(mockSetCamera).toHaveBeenCalledTimes(1);
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
    expect(mockSetCamera).not.toHaveBeenCalled();
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
