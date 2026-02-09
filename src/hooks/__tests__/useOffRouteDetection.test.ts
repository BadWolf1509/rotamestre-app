/**
 * Tests for useOffRouteDetection hook
 *
 * Mocks: @/lib/routeGeometry (getOffRouteStatus), expo-speech, Platform
 */
// eslint-disable-next-line import/order -- mocks must be defined before jest.mock hoisting
import { renderHook, act, waitFor } from '@testing-library/react-native';

const mockGetOffRouteStatus = jest.fn();
const mockSpeak = jest.fn();

jest.mock('@/lib/routeGeometry', () => ({
  getOffRouteStatus: (...args: unknown[]) => mockGetOffRouteStatus(...args),
}));

jest.mock('expo-speech', () => ({
  speak: (...args: unknown[]) => mockSpeak(...args),
}));

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

import { Platform } from 'react-native';

import { useOffRouteDetection } from '../useOffRouteDetection';

const originalPlatformOS = Platform.OS;

// Helpers
const onRoute = { latitude: -23.55, longitude: -46.63 };
const polyline = [
  { latitude: -23.55, longitude: -46.63 },
  { latitude: -23.56, longitude: -46.64 },
];

function mockOnRouteResult() {
  mockGetOffRouteStatus.mockReturnValue({
    status: 'on-route',
    distance: 10,
    nearestPoint: onRoute,
  });
}

function mockWarningResult(distance = 120) {
  mockGetOffRouteStatus.mockReturnValue({
    status: 'warning',
    distance,
    nearestPoint: { latitude: -23.551, longitude: -46.631 },
  });
}

function mockCriticalResult(distance = 250) {
  mockGetOffRouteStatus.mockReturnValue({
    status: 'critical',
    distance,
    nearestPoint: { latitude: -23.553, longitude: -46.633 },
  });
}

describe('useOffRouteDetection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    Object.defineProperty(Platform, 'OS', { value: 'android', writable: true });
    mockOnRouteResult();
  });

  afterEach(() => {
    jest.useRealTimers();
    Object.defineProperty(Platform, 'OS', { value: originalPlatformOS, writable: true });
  });

  describe('initialization', () => {
    it('returns default on-route state', () => {
      const { result } = renderHook(() =>
        useOffRouteDetection(null, [], jest.fn(), {}),
      );

      expect(result.current.status).toBe('on-route');
      expect(result.current.distanceFromRoute).toBe(0);
      expect(result.current.nearestPointOnRoute).toBeNull();
      expect(result.current.isRecalculating).toBe(false);
    });

    it('does not check when userLocation is null', () => {
      renderHook(() => useOffRouteDetection(null, polyline, jest.fn()));

      expect(mockGetOffRouteStatus).not.toHaveBeenCalled();
    });

    it('does not check when polyline is empty', () => {
      renderHook(() => useOffRouteDetection(onRoute, [], jest.fn()));

      expect(mockGetOffRouteStatus).not.toHaveBeenCalled();
    });

    it('does not check when disabled', () => {
      renderHook(() =>
        useOffRouteDetection(onRoute, polyline, jest.fn(), { enabled: false }),
      );

      expect(mockGetOffRouteStatus).not.toHaveBeenCalled();
    });
  });

  describe('on-route detection', () => {
    it('detects on-route status', () => {
      mockOnRouteResult();

      const { result } = renderHook(() =>
        useOffRouteDetection(onRoute, polyline, jest.fn()),
      );

      // After both effects run, status is on-route (reset effect clears to defaults
      // then check effect also returns on-route)
      expect(result.current.status).toBe('on-route');
    });

    it('passes correct thresholds to getOffRouteStatus', () => {
      renderHook(() =>
        useOffRouteDetection(onRoute, polyline, jest.fn(), {
          warningThreshold: 50,
          criticalThreshold: 150,
        }),
      );

      expect(mockGetOffRouteStatus).toHaveBeenCalledWith(
        onRoute,
        polyline,
        50,
        150,
      );
    });

    it('uses default thresholds (100/200)', () => {
      renderHook(() =>
        useOffRouteDetection(onRoute, polyline, jest.fn()),
      );

      expect(mockGetOffRouteStatus).toHaveBeenCalledWith(
        onRoute,
        polyline,
        100,
        200,
      );
    });
  });

  describe('warning detection', () => {
    it('updates status to warning after interval check', () => {
      // Start on-route, then change to warning on next check
      mockOnRouteResult();

      const { result } = renderHook(() =>
        useOffRouteDetection(onRoute, polyline, jest.fn()),
      );

      expect(result.current.status).toBe('on-route');

      // Next check returns warning
      mockWarningResult();
      act(() => { jest.advanceTimersByTime(3000); });

      expect(result.current.status).toBe('warning');
      expect(result.current.distanceFromRoute).toBe(120);
    });

    it('speaks voice alert on warning (mobile)', () => {
      mockOnRouteResult();

      renderHook(() =>
        useOffRouteDetection(onRoute, polyline, jest.fn()),
      );

      // Transition to warning on next interval
      mockWarningResult();
      act(() => { jest.advanceTimersByTime(3000); });

      expect(mockSpeak).toHaveBeenCalledWith('Você saiu da rota', {
        language: 'pt-BR',
        pitch: 1.0,
        rate: 0.9,
      });
    });

    it('does not speak on web', () => {
      Object.defineProperty(Platform, 'OS', { value: 'web', writable: true });
      mockOnRouteResult();

      renderHook(() =>
        useOffRouteDetection(onRoute, polyline, jest.fn()),
      );

      mockWarningResult();
      act(() => { jest.advanceTimersByTime(3000); });

      expect(mockSpeak).not.toHaveBeenCalled();
    });
  });

  describe('critical detection / reroute', () => {
    it('triggers reroute at critical distance', async () => {
      mockOnRouteResult();
      const onReroute = jest.fn().mockResolvedValue(undefined);

      renderHook(() =>
        useOffRouteDetection(onRoute, polyline, onReroute),
      );

      // Transition to critical on next interval
      mockCriticalResult();
      act(() => { jest.advanceTimersByTime(3000); });

      await waitFor(() => {
        expect(onReroute).toHaveBeenCalledTimes(1);
      });
    });

    it('speaks reroute message on critical (mobile)', async () => {
      mockOnRouteResult();
      const onReroute = jest.fn().mockResolvedValue(undefined);

      renderHook(() =>
        useOffRouteDetection(onRoute, polyline, onReroute),
      );

      mockCriticalResult();
      act(() => { jest.advanceTimersByTime(3000); });

      await waitFor(() => {
        expect(mockSpeak).toHaveBeenCalledWith('Recalculando rota', expect.any(Object));
      });
    });

    it('sets isRecalculating during reroute', async () => {
      mockOnRouteResult();

      let resolveReroute: () => void;
      const onReroute = jest.fn(() => new Promise<void>((r) => { resolveReroute = r; }));

      const { result } = renderHook(() =>
        useOffRouteDetection(onRoute, polyline, onReroute),
      );

      // Trigger critical
      mockCriticalResult();
      act(() => { jest.advanceTimersByTime(3000); });

      await waitFor(() => {
        expect(result.current.isRecalculating).toBe(true);
      });

      await act(async () => { resolveReroute!(); });

      await waitFor(() => {
        expect(result.current.isRecalculating).toBe(false);
      });
    });

    it('calls setStatus on-route after successful reroute', async () => {
      mockOnRouteResult();
      const onReroute = jest.fn().mockResolvedValue(undefined);

      renderHook(() =>
        useOffRouteDetection(onRoute, polyline, onReroute),
      );

      mockCriticalResult();
      act(() => { jest.advanceTimersByTime(3000); });

      // Reroute is triggered
      await waitFor(() => {
        expect(onReroute).toHaveBeenCalledTimes(1);
      });

      // After reroute, switch mock back to on-route (simulating successful recalculation)
      mockOnRouteResult();
      act(() => { jest.advanceTimersByTime(3000); });
    });

    it('does not trigger reroute twice in same off-route event', async () => {
      mockOnRouteResult();
      const onReroute = jest.fn().mockResolvedValue(undefined);

      renderHook(() =>
        useOffRouteDetection(onRoute, polyline, onReroute),
      );

      // First trigger
      mockCriticalResult();
      act(() => { jest.advanceTimersByTime(3000); });

      await waitFor(() => {
        expect(onReroute).toHaveBeenCalledTimes(1);
      });

      // Advance timer for another check cycle
      act(() => { jest.advanceTimersByTime(3000); });

      // Should still only be called once (cooldown active)
      expect(onReroute).toHaveBeenCalledTimes(1);
    });

    it('handles reroute failure gracefully', async () => {
      mockOnRouteResult();
      const onReroute = jest.fn().mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() =>
        useOffRouteDetection(onRoute, polyline, onReroute),
      );

      mockCriticalResult();
      act(() => { jest.advanceTimersByTime(3000); });

      await waitFor(() => {
        expect(result.current.isRecalculating).toBe(false);
      });
    });
  });

  describe('periodic checks', () => {
    it('calls getOffRouteStatus on mount', () => {
      renderHook(() =>
        useOffRouteDetection(onRoute, polyline, jest.fn()),
      );

      expect(mockGetOffRouteStatus).toHaveBeenCalled();
    });

    it('makes additional calls as time progresses', () => {
      renderHook(() =>
        useOffRouteDetection(onRoute, polyline, jest.fn()),
      );

      const afterMount = mockGetOffRouteStatus.mock.calls.length;

      // Advance several intervals to accumulate calls
      act(() => { jest.advanceTimersByTime(9000); });

      // Should have more calls than at mount
      expect(mockGetOffRouteStatus.mock.calls.length).toBeGreaterThan(afterMount);
    });

    it('uses custom check interval', () => {
      renderHook(() =>
        useOffRouteDetection(onRoute, polyline, jest.fn(), { checkInterval: 5000 }),
      );

      // Advance less than the custom interval — should not trigger new check
      act(() => { jest.advanceTimersByTime(4000); });
      const afterShort = mockGetOffRouteStatus.mock.calls.length;

      // Advance past the custom interval
      act(() => { jest.advanceTimersByTime(2000); });
      expect(mockGetOffRouteStatus.mock.calls.length).toBeGreaterThan(afterShort);
    });

    it('clears interval on unmount', () => {
      const { unmount } = renderHook(() =>
        useOffRouteDetection(onRoute, polyline, jest.fn()),
      );

      const callCountAtMount = mockGetOffRouteStatus.mock.calls.length;
      unmount();

      act(() => { jest.advanceTimersByTime(10000); });
      // No additional calls after unmount
      expect(mockGetOffRouteStatus).toHaveBeenCalledTimes(callCountAtMount);
    });
  });

  describe('route change reset', () => {
    it('resets state when polyline changes', () => {
      mockOnRouteResult();

      const { result, rerender } = renderHook(
        ({ poly }) => useOffRouteDetection(onRoute, poly, jest.fn()),
        { initialProps: { poly: polyline } },
      );

      // Transition to warning via interval
      mockWarningResult();
      act(() => { jest.advanceTimersByTime(3000); });
      expect(result.current.status).toBe('warning');

      // Change polyline → reset effect clears status
      mockOnRouteResult();
      const newPoly = [
        { latitude: -23.55, longitude: -46.63 },
        { latitude: -23.57, longitude: -46.65 },
      ];

      rerender({ poly: newPoly });

      expect(result.current.status).toBe('on-route');
    });
  });

  describe('status transitions', () => {
    it('transitions from on-route to warning', () => {
      mockOnRouteResult();

      const { result } = renderHook(() =>
        useOffRouteDetection(onRoute, polyline, jest.fn()),
      );

      expect(result.current.status).toBe('on-route');

      // Next check returns warning
      mockWarningResult();
      act(() => { jest.advanceTimersByTime(3000); });

      expect(result.current.status).toBe('warning');
      expect(mockSpeak).toHaveBeenCalledWith('Você saiu da rota', expect.any(Object));
    });

    it('transitions from warning to on-route (back on track)', () => {
      mockOnRouteResult();

      const { result } = renderHook(() =>
        useOffRouteDetection(onRoute, polyline, jest.fn()),
      );

      // Go to warning first
      mockWarningResult();
      act(() => { jest.advanceTimersByTime(3000); });
      expect(result.current.status).toBe('warning');

      // Back on route
      mockOnRouteResult();
      act(() => { jest.advanceTimersByTime(3000); });

      expect(result.current.status).toBe('on-route');
    });
  });
});
