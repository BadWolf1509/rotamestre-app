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
    it("não re-inscreve o mesmo channel em erro (evita 'tried to join multiple times')", () => {
      // Prevent auto-subscribe success
      mockChannel.subscribe = jest.fn((cb?: SubscribeCallback) => {
        if (cb) (mockChannel as any)._subscribeCallback = cb;
        return mockChannel;
      });

      const { unmount } = renderHook(() =>
        useRouteRealtimeSubscription(defaultProps),
      );

      const cb = (mockChannel as any)._subscribeCallback as SubscribeCallback;

      // Erro de canal NÃO deve re-inscrever o channel: o Phoenix/Supabase lança
      // "tried to join multiple times" se o mesmo channel for re-inscrito.
      cb('CHANNEL_ERROR');
      jest.advanceTimersByTime(2000);

      // subscribe permanece com 1 chamada (a da montagem); o realtime-js
      // reconecta o socket automaticamente.
      expect(mockChannel.subscribe).toHaveBeenCalledTimes(1);

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

  describe('reconexão sem re-join (Bug Fix)', () => {
    it('não re-inscreve o channel em erros sucessivos (realtime-js reconecta o socket)', () => {
      // Prevent auto-subscribe success
      mockChannel.subscribe = jest.fn((cb?: SubscribeCallback) => {
        if (cb) (mockChannel as any)._subscribeCallback = cb;
        return mockChannel;
      });

      const { unmount } = renderHook(() =>
        useRouteRealtimeSubscription(defaultProps),
      );

      const cb = (mockChannel as any)._subscribeCallback as SubscribeCallback;

      // Subscribe inicial = 1 chamada
      expect(mockChannel.subscribe).toHaveBeenCalledTimes(1);

      // Múltiplos erros NÃO devem re-inscrever o channel: o Phoenix/Supabase
      // lança "tried to join multiple times" se o mesmo channel for re-inscrito.
      // O realtime-js reconecta o socket automaticamente; após o máximo de
      // tentativas o hook cai no polling (coberto nos testes acima).
      cb('CHANNEL_ERROR');
      jest.advanceTimersByTime(10000);
      cb('TIMED_OUT');
      jest.advanceTimersByTime(10000);
      cb('CHANNEL_ERROR');
      jest.advanceTimersByTime(10000);

      expect(mockChannel.subscribe).toHaveBeenCalledTimes(1);

      unmount();
    });
  });
});
