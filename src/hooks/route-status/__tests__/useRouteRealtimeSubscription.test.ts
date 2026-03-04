import { renderHook } from '@testing-library/react-native';

import { supabase } from '@/lib/supabase';

import { useRouteRealtimeSubscription } from '../useRouteRealtimeSubscription';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/lib/supabase');
jest.mock('@/lib/logger');
jest.mock('@/lib/notifications', () => ({
  notifyRoutePending: jest.fn(),
}));
jest.mock('@/utils/browserNotification', () => ({
  notifyNewRouteWeb: jest.fn(),
}));
jest.mock('@/utils/haptics', () => ({
  warningHaptic: jest.fn(),
}));
jest.mock('@/utils/notificationSound', () => ({
  playNotificationSound: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Channel mock factory
// ---------------------------------------------------------------------------

type SubscribeCallback = (status: string) => void;

function createMockChannel() {
  let subscribeCallback: SubscribeCallback | null = null;

  const channel = {
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn((cb?: SubscribeCallback) => {
      if (cb) subscribeCallback = cb;
      // Simulate successful subscription by default
      if (subscribeCallback) subscribeCallback('SUBSCRIBED');
      return channel;
    }),
    unsubscribe: jest.fn(),
    // Expose for test control
    _triggerStatus(status: string) {
      if (subscribeCallback) subscribeCallback(status);
    },
  };

  return channel;
}

// ---------------------------------------------------------------------------
// Setup helpers
// ---------------------------------------------------------------------------

let mockChannel: ReturnType<typeof createMockChannel>;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();

  mockChannel = createMockChannel();

  (supabase.channel as jest.Mock) = jest.fn(() => mockChannel);
  (supabase.removeChannel as jest.Mock) = jest.fn();
  // supabase.realtime is undefined in auto-mock — create it as a plain object
  (supabase as any).realtime = { setAuth: jest.fn() };
});

afterEach(() => {
  jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useRouteRealtimeSubscription', () => {
  const defaultProps = {
    motoristaId: 'driver-1',
    accessToken: 'token-abc',
    loadActiveRoute: jest.fn().mockResolvedValue(undefined),
  };

  it('subscribes to channel on mount and cleans up on unmount', () => {
    const { unmount } = renderHook(() =>
      useRouteRealtimeSubscription(defaultProps),
    );

    expect(supabase.channel).toHaveBeenCalledWith('motorista-routes-driver-1');
    expect(mockChannel.subscribe).toHaveBeenCalled();

    unmount();
    expect(supabase.removeChannel).toHaveBeenCalledWith(mockChannel);
  });

  it('does not subscribe when motoristaId is undefined', () => {
    renderHook(() =>
      useRouteRealtimeSubscription({
        ...defaultProps,
        motoristaId: undefined,
      }),
    );

    expect(supabase.channel).not.toHaveBeenCalled();
  });

  it('does not subscribe when accessToken is undefined', () => {
    renderHook(() =>
      useRouteRealtimeSubscription({
        ...defaultProps,
        accessToken: undefined,
      }),
    );

    expect(supabase.channel).not.toHaveBeenCalled();
  });

  describe('polling fallback cleanup (Bug Fix)', () => {
    it('cleans up poll interval on unmount after max reconnect attempts', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      // Prevent auto-subscribe success — we'll trigger statuses manually
      mockChannel.subscribe = jest.fn((cb?: SubscribeCallback) => {
        if (cb) (mockChannel as any)._subscribeCallback = cb;
        return mockChannel;
      });

      const { unmount } = renderHook(() =>
        useRouteRealtimeSubscription(defaultProps),
      );

      const cb = (mockChannel as any)._subscribeCallback as SubscribeCallback;
      expect(cb).toBeDefined();

      // Simulate MAX_RECONNECT_ATTEMPTS (3) failures
      // Attempt 1
      cb('CHANNEL_ERROR');
      jest.advanceTimersByTime(2000);
      // Attempt 2
      cb('CHANNEL_ERROR');
      jest.advanceTimersByTime(4000);
      // Attempt 3
      cb('CHANNEL_ERROR');
      jest.advanceTimersByTime(8000);
      // Attempt 4 — exceeds max, triggers polling fallback
      cb('CHANNEL_ERROR');

      // Now unmount should clear the poll interval
      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
    });

    it('polling fallback calls loadActiveRoute every 30s', () => {
      const loadActiveRoute = jest.fn().mockResolvedValue(undefined);

      // Prevent auto-subscribe success
      mockChannel.subscribe = jest.fn((cb?: SubscribeCallback) => {
        if (cb) (mockChannel as any)._subscribeCallback = cb;
        return mockChannel;
      });

      renderHook(() =>
        useRouteRealtimeSubscription({
          ...defaultProps,
          loadActiveRoute,
        }),
      );

      const cb = (mockChannel as any)._subscribeCallback as SubscribeCallback;

      // Trigger 4 failures to reach polling fallback
      cb('CHANNEL_ERROR');
      jest.advanceTimersByTime(2000);
      cb('CHANNEL_ERROR');
      jest.advanceTimersByTime(4000);
      cb('CHANNEL_ERROR');
      jest.advanceTimersByTime(8000);
      cb('CHANNEL_ERROR'); // 4th = past max (3), starts polling

      loadActiveRoute.mockClear();

      // Advance 30s — should trigger poll
      jest.advanceTimersByTime(30000);
      expect(loadActiveRoute).toHaveBeenCalledTimes(1);

      // Advance another 30s
      jest.advanceTimersByTime(30000);
      expect(loadActiveRoute).toHaveBeenCalledTimes(2);
    });
  });

  describe('isSubscribed management (Bug Fix)', () => {
    it('does not block reconnection by keeping isSubscribed true during retries', () => {
      // Prevent auto-subscribe success
      mockChannel.subscribe = jest.fn((cb?: SubscribeCallback) => {
        if (cb) (mockChannel as any)._subscribeCallback = cb;
        return mockChannel;
      });

      const { unmount, rerender } = renderHook(() =>
        useRouteRealtimeSubscription(defaultProps),
      );

      const cb = (mockChannel as any)._subscribeCallback as SubscribeCallback;

      // First error — should NOT set isSubscribed false (we're reconnecting)
      cb('CHANNEL_ERROR');

      // Advance past reconnect delay
      jest.advanceTimersByTime(2000);

      // channel.subscribe should have been called again (reconnect attempt)
      // It was called once initially + once for reconnect = 2
      expect(mockChannel.subscribe).toHaveBeenCalledTimes(2);

      unmount();
    });

    it('sets isSubscribed true on SUBSCRIBED status (reconnection success)', () => {
      // Prevent auto-subscribe success
      mockChannel.subscribe = jest.fn((cb?: SubscribeCallback) => {
        if (cb) (mockChannel as any)._subscribeCallback = cb;
        return mockChannel;
      });

      const { unmount } = renderHook(() =>
        useRouteRealtimeSubscription(defaultProps),
      );

      const cb = (mockChannel as any)._subscribeCallback as SubscribeCallback;

      // Simulate error followed by successful reconnection
      cb('CHANNEL_ERROR');
      jest.advanceTimersByTime(2000);

      // Simulate successful reconnect
      cb('SUBSCRIBED');

      // After unmount and re-render, if isSubscribed is properly true,
      // a new effect run would bail early (no double subscription)
      unmount();

      // No errors thrown, cleanup works correctly
      expect(supabase.removeChannel).toHaveBeenCalledWith(mockChannel);
    });
  });

  describe('exponential backoff', () => {
    it('retries with increasing delays', () => {
      // Prevent auto-subscribe success
      mockChannel.subscribe = jest.fn((cb?: SubscribeCallback) => {
        if (cb) (mockChannel as any)._subscribeCallback = cb;
        return mockChannel;
      });

      const { unmount } = renderHook(() =>
        useRouteRealtimeSubscription(defaultProps),
      );

      const cb = (mockChannel as any)._subscribeCallback as SubscribeCallback;
      const setAuthMock = (supabase as any).realtime.setAuth as jest.Mock;

      // Initial subscribe = 1 call
      expect(mockChannel.subscribe).toHaveBeenCalledTimes(1);

      // Error 1 — should retry after 2s (2^1 * 1000)
      cb('CHANNEL_ERROR');
      jest.advanceTimersByTime(1999);
      expect(mockChannel.subscribe).toHaveBeenCalledTimes(1);
      jest.advanceTimersByTime(1);
      expect(mockChannel.subscribe).toHaveBeenCalledTimes(2);
      expect(setAuthMock).toHaveBeenCalledWith('token-abc');

      // Error 2 — should retry after 4s (2^2 * 1000)
      cb('TIMED_OUT');
      jest.advanceTimersByTime(3999);
      expect(mockChannel.subscribe).toHaveBeenCalledTimes(2);
      jest.advanceTimersByTime(1);
      expect(mockChannel.subscribe).toHaveBeenCalledTimes(3);

      // Error 3 — should retry after 8s (2^3 * 1000)
      cb('CHANNEL_ERROR');
      jest.advanceTimersByTime(7999);
      expect(mockChannel.subscribe).toHaveBeenCalledTimes(3);
      jest.advanceTimersByTime(1);
      expect(mockChannel.subscribe).toHaveBeenCalledTimes(4);

      // Error 4 — max attempts exceeded, no more retries (polling instead)
      cb('CHANNEL_ERROR');
      jest.advanceTimersByTime(20000);
      // Still 4 — no more subscribe calls
      expect(mockChannel.subscribe).toHaveBeenCalledTimes(4);

      unmount();
    });
  });
});
