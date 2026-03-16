/**
 * Tests for useNotificationRealtime
 * Manages Supabase Realtime subscription for notifications.
 *
 * KEPT LIGHTWEIGHT to avoid OOM issues with heavy renderHook + realtime tests.
 */

import { renderHook } from "@testing-library/react-native";

import { useNotificationRealtime } from "../useNotificationRealtime";

// Mock Supabase realtime channel
const mockOn = jest.fn().mockReturnThis();
const mockChannel: Record<string, jest.Mock> = {
  on: mockOn,
  subscribe: jest.fn(),
};
// subscribe returns the channel itself (like the real Supabase client)
mockChannel.subscribe.mockReturnValue(mockChannel);

jest.mock("@/lib/supabase", () => ({
  supabase: {
    channel: jest.fn(() => mockChannel),
    removeChannel: jest.fn(),
    realtime: {
      setAuth: jest.fn(),
    },
  },
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe("useNotificationRealtime", () => {
  const defaultProps = {
    userId: "user-1",
    accessToken: "mock-token",
    onInsert: jest.fn(),
    onUpdate: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockOn.mockReturnThis();
    mockChannel.subscribe.mockReturnValue(mockChannel);
    // Re-set channel factory after clearAllMocks resets it
    const { supabase } = require("@/lib/supabase");
    supabase.channel.mockReturnValue(mockChannel);
  });

  describe("Subscription setup", () => {
    it("should create a channel with userId in the name", () => {
      renderHook(() => useNotificationRealtime(defaultProps));

      const { supabase } = require("@/lib/supabase");
      expect(supabase.channel).toHaveBeenCalledWith("notificacoes-user-1");
    });

    it("should set auth token before subscribing", () => {
      renderHook(() => useNotificationRealtime(defaultProps));

      const { supabase } = require("@/lib/supabase");
      expect(supabase.realtime.setAuth).toHaveBeenCalledWith("mock-token");
    });

    it("should subscribe to INSERT events for the user", () => {
      renderHook(() => useNotificationRealtime(defaultProps));

      expect(mockOn).toHaveBeenCalledWith(
        "postgres_changes",
        expect.objectContaining({
          event: "INSERT",
          schema: "public",
          table: "notificacoes",
          filter: "usuario_id=eq.user-1",
        }),
        expect.any(Function),
      );
    });

    it("should subscribe to UPDATE events for the user", () => {
      renderHook(() => useNotificationRealtime(defaultProps));

      expect(mockOn).toHaveBeenCalledWith(
        "postgres_changes",
        expect.objectContaining({
          event: "UPDATE",
          schema: "public",
          table: "notificacoes",
          filter: "usuario_id=eq.user-1",
        }),
        expect.any(Function),
      );
    });

    it("should call subscribe on the channel", () => {
      renderHook(() => useNotificationRealtime(defaultProps));

      expect(mockChannel.subscribe).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe("Guard conditions (no subscription)", () => {
    it("should not subscribe when userId is undefined", () => {
      renderHook(() =>
        useNotificationRealtime({
          ...defaultProps,
          userId: undefined,
        }),
      );

      const { supabase } = require("@/lib/supabase");
      expect(supabase.channel).not.toHaveBeenCalled();
    });

    it("should not subscribe when accessToken is undefined", () => {
      renderHook(() =>
        useNotificationRealtime({
          ...defaultProps,
          accessToken: undefined,
        }),
      );

      const { supabase } = require("@/lib/supabase");
      expect(supabase.channel).not.toHaveBeenCalled();
    });

    it("should not subscribe when both are undefined", () => {
      renderHook(() =>
        useNotificationRealtime({
          ...defaultProps,
          userId: undefined,
          accessToken: undefined,
        }),
      );

      const { supabase } = require("@/lib/supabase");
      expect(supabase.channel).not.toHaveBeenCalled();
    });
  });

  describe("Cleanup on unmount", () => {
    it("should remove channel on unmount", () => {
      const { unmount } = renderHook(() =>
        useNotificationRealtime(defaultProps),
      );

      const { supabase } = require("@/lib/supabase");

      unmount();

      expect(supabase.removeChannel).toHaveBeenCalledWith(mockChannel);
    });

    it("should not call removeChannel if never subscribed", () => {
      const { unmount } = renderHook(() =>
        useNotificationRealtime({
          ...defaultProps,
          userId: undefined,
        }),
      );

      const { supabase } = require("@/lib/supabase");

      unmount();

      expect(supabase.removeChannel).not.toHaveBeenCalled();
    });
  });

  describe("Duplicate subscription prevention", () => {
    it("should not re-subscribe when rerendered with same props", () => {
      const { rerender } = renderHook(
        (props) => useNotificationRealtime(props),
        { initialProps: defaultProps },
      );

      const { supabase } = require("@/lib/supabase");
      expect(supabase.channel).toHaveBeenCalledTimes(1);

      // Rerender with same userId/accessToken
      rerender(defaultProps);

      // Should still be 1 (isSubscribed ref prevents duplicate)
      expect(supabase.channel).toHaveBeenCalledTimes(1);
    });
  });

  describe("Event handler callbacks", () => {
    it("should call onInsert ref when INSERT event fires", () => {
      const onInsert = jest.fn();
      renderHook(() => useNotificationRealtime({ ...defaultProps, onInsert }));

      // Find the INSERT handler from the mockOn calls
      const insertCall = mockOn.mock.calls.find(
        (call) => call[1]?.event === "INSERT",
      );
      expect(insertCall).toBeDefined();

      const insertHandler = insertCall![2];
      const mockPayload = {
        new: {
          id: "notif-1",
          usuario_id: "user-1",
          tipo: "rota_atribuida",
          lida: false,
        },
      };

      insertHandler(mockPayload);

      expect(onInsert).toHaveBeenCalledWith(mockPayload.new);
    });

    it("should call onUpdate ref when UPDATE event fires", () => {
      const onUpdate = jest.fn();
      renderHook(() => useNotificationRealtime({ ...defaultProps, onUpdate }));

      // Find the UPDATE handler from the mockOn calls
      const updateCall = mockOn.mock.calls.find(
        (call) => call[1]?.event === "UPDATE",
      );
      expect(updateCall).toBeDefined();

      const updateHandler = updateCall![2];
      const mockPayload = {
        new: {
          id: "notif-1",
          usuario_id: "user-1",
          tipo: "rota_atribuida",
          lida: true,
        },
      };

      updateHandler(mockPayload);

      expect(onUpdate).toHaveBeenCalledWith(mockPayload.new);
    });
  });

  describe("Subscribe status handling", () => {
    it("should log info on SUBSCRIBED status", () => {
      renderHook(() => useNotificationRealtime(defaultProps));

      const subscribeCallback = mockChannel.subscribe.mock.calls[0][0];
      subscribeCallback("SUBSCRIBED", null);

      const { logger } = require("@/lib/logger");
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("Conectado e ouvindo eventos"),
      );
    });

    it("should log warn on CHANNEL_ERROR and reset isSubscribed", () => {
      renderHook(() => useNotificationRealtime(defaultProps));

      const subscribeCallback = mockChannel.subscribe.mock.calls[0][0];
      subscribeCallback("CHANNEL_ERROR", null);

      const { logger } = require("@/lib/logger");
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Conexão falhou"),
        "CHANNEL_ERROR",
        expect.any(String),
      );
    });

    it("should log warn on TIMED_OUT status", () => {
      renderHook(() => useNotificationRealtime(defaultProps));

      const subscribeCallback = mockChannel.subscribe.mock.calls[0][0];
      subscribeCallback("TIMED_OUT", null);

      const { logger } = require("@/lib/logger");
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Conexão falhou"),
        "TIMED_OUT",
        expect.any(String),
      );
    });

    it("should log debug on CLOSED status", () => {
      renderHook(() => useNotificationRealtime(defaultProps));

      const subscribeCallback = mockChannel.subscribe.mock.calls[0][0];
      subscribeCallback("CLOSED", null);

      const { logger } = require("@/lib/logger");
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Canal fechado"),
      );
    });
  });
});
