/**
 * Tests for useNavigationFeedback hook
 *
 * Covers haptic feedback.
 */

import { renderHook, act } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { useNavigationFeedback } from '../useNavigationFeedback';

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
}));

describe('useNavigationFeedback', () => {
  const originalPlatform = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    // Default to iOS (non-web)
    Object.defineProperty(Platform, 'OS', { value: 'ios', writable: true });
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', {
      value: originalPlatform,
      writable: true,
    });
  });

  describe('triggerHaptic', () => {
    it('deve chamar impactAsync para tipo impact', async () => {
      const { result } = renderHook(() =>
        useNavigationFeedback({ vibrationAlerts: true }),
      );

      await act(async () => {
        await result.current.triggerHaptic('impact');
      });

      expect(Haptics.impactAsync).toHaveBeenCalledWith(
        Haptics.ImpactFeedbackStyle.Medium,
      );
    });

    it('deve chamar notificationAsync com Success para tipo success', async () => {
      const { result } = renderHook(() =>
        useNavigationFeedback({ vibrationAlerts: true }),
      );

      await act(async () => {
        await result.current.triggerHaptic('success');
      });

      expect(Haptics.notificationAsync).toHaveBeenCalledWith(
        Haptics.NotificationFeedbackType.Success,
      );
    });

    it('deve chamar notificationAsync com Warning para tipo warning', async () => {
      const { result } = renderHook(() =>
        useNavigationFeedback({ vibrationAlerts: true }),
      );

      await act(async () => {
        await result.current.triggerHaptic('warning');
      });

      expect(Haptics.notificationAsync).toHaveBeenCalledWith(
        Haptics.NotificationFeedbackType.Warning,
      );
    });

    it('deve NÃO chamar haptics quando vibrationAlerts=false', async () => {
      const { result } = renderHook(() =>
        useNavigationFeedback({ vibrationAlerts: false }),
      );

      await act(async () => {
        await result.current.triggerHaptic('impact');
      });

      expect(Haptics.impactAsync).not.toHaveBeenCalled();
      expect(Haptics.notificationAsync).not.toHaveBeenCalled();
    });

    it('deve NÃO chamar haptics na web', async () => {
      Object.defineProperty(Platform, 'OS', { value: 'web', writable: true });

      const { result } = renderHook(() =>
        useNavigationFeedback({ vibrationAlerts: true }),
      );

      await act(async () => {
        await result.current.triggerHaptic('impact');
      });

      expect(Haptics.impactAsync).not.toHaveBeenCalled();
    });

    it('deve silenciar erro se haptics não disponível', async () => {
      (Haptics.impactAsync as jest.Mock).mockRejectedValueOnce(
        new Error('not available'),
      );

      const { result } = renderHook(() =>
        useNavigationFeedback({ vibrationAlerts: true }),
      );

      // Should not throw
      await act(async () => {
        await result.current.triggerHaptic('impact');
      });

      expect(Haptics.impactAsync).toHaveBeenCalled();
    });
  });
});
