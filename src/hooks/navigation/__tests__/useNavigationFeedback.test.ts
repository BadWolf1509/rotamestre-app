/**
 * Tests for useNavigationFeedback hook
 *
 * Covers haptic feedback, notification sounds, and cleanup.
 */

import { renderHook, act } from '@testing-library/react-native';
import { setAudioModeAsync } from 'expo-audio';
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

// Mock expo-audio (substitui expo-av no SDK 56)
jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
  createAudioPlayer: jest.fn(() => ({
    volume: 1,
    play: jest.fn(),
    remove: jest.fn(),
  })),
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
        useNavigationFeedback({ vibrationAlerts: true, soundAlerts: false }),
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
        useNavigationFeedback({ vibrationAlerts: true, soundAlerts: false }),
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
        useNavigationFeedback({ vibrationAlerts: true, soundAlerts: false }),
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
        useNavigationFeedback({ vibrationAlerts: false, soundAlerts: false }),
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
        useNavigationFeedback({ vibrationAlerts: true, soundAlerts: false }),
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
        useNavigationFeedback({ vibrationAlerts: true, soundAlerts: false }),
      );

      // Should not throw
      await act(async () => {
        await result.current.triggerHaptic('impact');
      });

      expect(Haptics.impactAsync).toHaveBeenCalled();
    });
  });

  describe('playNotificationSound', () => {
    it('deve configurar audio mode quando soundAlerts=true', async () => {
      const { result } = renderHook(() =>
        useNavigationFeedback({ vibrationAlerts: false, soundAlerts: true }),
      );

      await act(async () => {
        await result.current.playNotificationSound();
      });

      expect(setAudioModeAsync).toHaveBeenCalledWith({
        allowsRecording: false,
        shouldPlayInBackground: false,
        playsInSilentMode: false,
        interruptionMode: 'mixWithOthers',
        shouldRouteThroughEarpiece: false,
      });
    });

    it('deve NÃO tocar som quando soundAlerts=false', async () => {
      const { result } = renderHook(() =>
        useNavigationFeedback({ vibrationAlerts: false, soundAlerts: false }),
      );

      await act(async () => {
        await result.current.playNotificationSound();
      });

      expect(setAudioModeAsync).not.toHaveBeenCalled();
    });

    it('deve NÃO tocar som na web', async () => {
      Object.defineProperty(Platform, 'OS', { value: 'web', writable: true });

      const { result } = renderHook(() =>
        useNavigationFeedback({ vibrationAlerts: false, soundAlerts: true }),
      );

      await act(async () => {
        await result.current.playNotificationSound();
      });

      expect(setAudioModeAsync).not.toHaveBeenCalled();
    });
  });

  describe('cleanupSound', () => {
    it('deve ser uma função callable sem erros', async () => {
      const { result } = renderHook(() =>
        useNavigationFeedback({ vibrationAlerts: false, soundAlerts: false }),
      );

      // Should not throw even with no active sound
      await act(async () => {
        await result.current.cleanupSound();
      });

      expect(result.current.cleanupSound).toBeDefined();
    });
  });
});
