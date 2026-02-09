/**
 * Tests for useMainCardAnimations hook
 *
 * Mocks: Animated, haptics
 */
import { renderHook } from '@testing-library/react-native';
import { Animated } from 'react-native';

const mockSuccessHaptic = jest.fn();

jest.mock('@/utils/haptics', () => ({
  successHaptic: () => mockSuccessHaptic(),
}));

import { useMainCardAnimations } from '../useMainCardAnimations';

// Spy on Animated methods
const timingSpy = jest.spyOn(Animated, 'timing');
const springSpy = jest.spyOn(Animated, 'spring');
const parallelSpy = jest.spyOn(Animated, 'parallel');

describe('useMainCardAnimations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('returns all animation values', () => {
      const { result } = renderHook(() =>
        useMainCardAnimations({ state: 'no-route' }),
      );

      expect(result.current.fadeAnim).toBeInstanceOf(Animated.Value);
      expect(result.current.slideAnim).toBeInstanceOf(Animated.Value);
      expect(result.current.celebrationScale).toBeInstanceOf(Animated.Value);
      expect(result.current.celebrationOpacity).toBeInstanceOf(Animated.Value);
    });

    it('initializes fadeAnim to 0', () => {
      const { result } = renderHook(() =>
        useMainCardAnimations({ state: 'no-route' }),
      );

      // We can check the internal value via __getValue on Animated.Value
      expect((result.current.fadeAnim as any).__getValue()).toBe(0);
    });

    it('initializes slideAnim to 20', () => {
      const { result } = renderHook(() =>
        useMainCardAnimations({ state: 'no-route' }),
      );

      expect((result.current.slideAnim as any).__getValue()).toBe(20);
    });

    it('initializes celebrationScale to 0', () => {
      const { result } = renderHook(() =>
        useMainCardAnimations({ state: 'no-route' }),
      );

      expect((result.current.celebrationScale as any).__getValue()).toBe(0);
    });

    it('initializes celebrationOpacity to 0', () => {
      const { result } = renderHook(() =>
        useMainCardAnimations({ state: 'no-route' }),
      );

      expect((result.current.celebrationOpacity as any).__getValue()).toBe(0);
    });
  });

  describe('card entry animation', () => {
    it('triggers parallel animation on mount', () => {
      renderHook(() => useMainCardAnimations({ state: 'no-route' }));

      expect(parallelSpy).toHaveBeenCalled();
      expect(timingSpy).toHaveBeenCalled();
      expect(springSpy).toHaveBeenCalled();
    });

    it('animates fadeAnim to 1', () => {
      renderHook(() => useMainCardAnimations({ state: 'no-route' }));

      const timingCall = timingSpy.mock.calls.find(
        (call) => (call[1] as any)?.toValue === 1 && (call[1] as any)?.duration === 300,
      );
      expect(timingCall).toBeDefined();
    });

    it('animates slideAnim to 0 with spring', () => {
      renderHook(() => useMainCardAnimations({ state: 'no-route' }));

      const springCall = springSpy.mock.calls.find(
        (call) => (call[1] as any)?.toValue === 0,
      );
      expect(springCall).toBeDefined();
    });

    it('uses native driver', () => {
      renderHook(() => useMainCardAnimations({ state: 'no-route' }));

      const timingCall = timingSpy.mock.calls[0];
      expect((timingCall[1] as any)?.useNativeDriver).toBe(true);
    });

    it('re-triggers entry animation on state change', () => {
      const { rerender } = renderHook(
        ({ state }) => useMainCardAnimations({ state }),
        { initialProps: { state: 'no-route' as any } },
      );

      const initialCount = parallelSpy.mock.calls.length;

      rerender({ state: 'active' as any });

      expect(parallelSpy.mock.calls.length).toBeGreaterThan(initialCount);
    });
  });

  describe('celebration animation', () => {
    it('triggers celebration on completed state', () => {
      renderHook(() => useMainCardAnimations({ state: 'completed' as any }));

      expect(mockSuccessHaptic).toHaveBeenCalledTimes(1);
    });

    it('does not trigger haptic for non-completed states', () => {
      renderHook(() => useMainCardAnimations({ state: 'no-route' }));

      expect(mockSuccessHaptic).not.toHaveBeenCalled();
    });

    it('triggers celebration animation (scale + opacity)', () => {
      renderHook(() => useMainCardAnimations({ state: 'completed' as any }));

      // Should have celebration spring (scale to 1) and timing (opacity to 1)
      const scaleSpring = springSpy.mock.calls.find(
        (call) => (call[1] as any)?.toValue === 1 && (call[1] as any)?.friction === 3,
      );
      expect(scaleSpring).toBeDefined();
    });

    it('does not re-trigger celebration on re-render with same completed state', () => {
      const { rerender } = renderHook(
        ({ state }) => useMainCardAnimations({ state }),
        { initialProps: { state: 'completed' as any } },
      );

      expect(mockSuccessHaptic).toHaveBeenCalledTimes(1);

      rerender({ state: 'completed' as any });

      // Should still be 1, not 2
      expect(mockSuccessHaptic).toHaveBeenCalledTimes(1);
    });

    it('resets celebration when leaving completed state', () => {
      const { result, rerender } = renderHook(
        ({ state }) => useMainCardAnimations({ state }),
        { initialProps: { state: 'completed' as any } },
      );

      expect(mockSuccessHaptic).toHaveBeenCalledTimes(1);

      // Leave completed state
      rerender({ state: 'no-route' as any });

      // Scale and opacity should be reset to 0
      expect((result.current.celebrationScale as any).__getValue()).toBe(0);
      expect((result.current.celebrationOpacity as any).__getValue()).toBe(0);
    });

    it('re-triggers celebration after leaving and returning to completed', () => {
      const { rerender } = renderHook(
        ({ state }) => useMainCardAnimations({ state }),
        { initialProps: { state: 'completed' as any } },
      );

      expect(mockSuccessHaptic).toHaveBeenCalledTimes(1);

      // Leave completed
      rerender({ state: 'no-route' as any });

      // Return to completed
      rerender({ state: 'completed' as any });

      expect(mockSuccessHaptic).toHaveBeenCalledTimes(2);
    });
  });

  describe('animation value stability', () => {
    it('returns same animation value references across re-renders', () => {
      const { result, rerender } = renderHook(
        ({ state }) => useMainCardAnimations({ state }),
        { initialProps: { state: 'no-route' as any } },
      );

      const firstFade = result.current.fadeAnim;
      const firstSlide = result.current.slideAnim;

      rerender({ state: 'active' as any });

      expect(result.current.fadeAnim).toBe(firstFade);
      expect(result.current.slideAnim).toBe(firstSlide);
    });
  });
});
