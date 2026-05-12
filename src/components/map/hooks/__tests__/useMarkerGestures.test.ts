import { act, renderHook } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';

import { toast } from '@/utils/toast';

import { useMarkerGestures } from '../useMarkerGestures';

jest.mock('@/utils/toast', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
}));

describe('useMarkerGestures', () => {
  const onMarkerPress = jest.fn();
  const onMarkerLongPress = jest.fn();
  const onMapPress = jest.fn();
  const setSelectedCheckpointId = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('handleMarkerPress clears checkpoint and calls onMarkerPress', () => {
    const { result } = renderHook(() =>
      useMarkerGestures({
        onMarkerPress,
        onMarkerLongPress,
        onMapPress,
        setSelectedCheckpointId,
      }),
    );
    act(() => {
      result.current.handleMarkerPress('p1');
    });
    expect(setSelectedCheckpointId).toHaveBeenCalledWith(null);
    expect(onMarkerPress).toHaveBeenCalledWith('p1');
  });

  it('handleMarkerLongPress calls onMarkerLongPress', () => {
    const { result } = renderHook(() =>
      useMarkerGestures({
        onMarkerPress,
        onMarkerLongPress,
        onMapPress,
        setSelectedCheckpointId,
      }),
    );
    act(() => {
      result.current.handleMarkerLongPress('p1');
    });
    expect(onMarkerLongPress).toHaveBeenCalledWith('p1');
  });

  it('handleMapPress clears checkpoint and calls onMapPress', () => {
    const { result } = renderHook(() =>
      useMarkerGestures({
        onMarkerPress,
        onMarkerLongPress,
        onMapPress,
        setSelectedCheckpointId,
      }),
    );
    act(() => {
      result.current.handleMapPress();
    });
    expect(setSelectedCheckpointId).toHaveBeenCalledWith(null);
    expect(onMapPress).toHaveBeenCalled();
  });

  it('handleCopyAddress calls Clipboard and shows success toast', async () => {
    (Clipboard.setStringAsync as jest.Mock).mockResolvedValue(undefined);
    (Haptics.notificationAsync as jest.Mock).mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useMarkerGestures({
        onMarkerPress,
        onMarkerLongPress,
        onMapPress,
        setSelectedCheckpointId,
      }),
    );
    await act(async () => {
      await result.current.handleCopyAddress('Rua Teste, 123');
    });
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith('Rua Teste, 123');
    expect(toast.success).toHaveBeenCalled();
  });

  it('handleCopyAddress shows error toast when Clipboard throws', async () => {
    (Clipboard.setStringAsync as jest.Mock).mockRejectedValue(
      new Error('unavailable'),
    );

    const { result } = renderHook(() =>
      useMarkerGestures({
        onMarkerPress,
        onMarkerLongPress,
        onMapPress,
        setSelectedCheckpointId,
      }),
    );
    await act(async () => {
      await result.current.handleCopyAddress('Rua Teste, 123');
    });
    expect(toast.error).toHaveBeenCalled();
  });
});
