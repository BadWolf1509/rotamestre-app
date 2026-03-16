/**
 * Tests for useNotificationPolling
 * Polls unread notification count every 30s as a realtime fallback.
 */

import { renderHook, act } from "@testing-library/react-native";

import { useNotificationPolling } from "../useNotificationPolling";

// Mock supabase
const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockEq2 = jest.fn();

jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: jest.fn(() => ({
      select: mockSelect,
    })),
  },
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    debug: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  },
}));

function setupSupabaseMock(data: unknown[] | null, error: unknown = null) {
  mockEq2.mockResolvedValue({ data, error });
  mockEq.mockReturnValue({ eq: mockEq2 });
  mockSelect.mockReturnValue({ eq: mockEq });
}

describe("useNotificationPolling", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    setupSupabaseMock([]);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe("Initialization", () => {
    it("should not poll when userId is undefined", () => {
      const onCountChange = jest.fn();

      renderHook(() =>
        useNotificationPolling({ userId: undefined, onCountChange }),
      );

      const { supabase } = require("@/lib/supabase");
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it("should poll immediately on mount when userId is provided", async () => {
      const onCountChange = jest.fn();
      setupSupabaseMock([{ id: "1", lida: false }]);

      renderHook(() =>
        useNotificationPolling({ userId: "user-1", onCountChange }),
      );

      // Flush the initial async poll
      await act(async () => {
        await Promise.resolve();
      });

      const { supabase } = require("@/lib/supabase");
      expect(supabase.from).toHaveBeenCalledWith("notificacoes");
      expect(mockSelect).toHaveBeenCalledWith("id, lida");
      expect(mockEq).toHaveBeenCalledWith("usuario_id", "user-1");
      expect(mockEq2).toHaveBeenCalledWith("lida", false);
    });
  });

  describe("Callback invocation", () => {
    it("should call onCountChange when count changes from 0", async () => {
      const onCountChange = jest.fn();
      setupSupabaseMock([
        { id: "1", lida: false },
        { id: "2", lida: false },
      ]);

      renderHook(() =>
        useNotificationPolling({ userId: "user-1", onCountChange }),
      );

      await act(async () => {
        await Promise.resolve();
      });

      expect(onCountChange).toHaveBeenCalledWith(2, 0);
    });

    it("should not call onCountChange when count stays the same", async () => {
      const onCountChange = jest.fn();
      setupSupabaseMock([]);

      renderHook(() =>
        useNotificationPolling({ userId: "user-1", onCountChange }),
      );

      await act(async () => {
        await Promise.resolve();
      });

      // Count is 0 and lastCountRef starts at 0 - no change
      expect(onCountChange).not.toHaveBeenCalled();
    });

    it("should detect count changes on subsequent polls", async () => {
      const onCountChange = jest.fn();
      setupSupabaseMock([]);

      renderHook(() =>
        useNotificationPolling({ userId: "user-1", onCountChange }),
      );

      // Initial poll: count=0, lastCount=0 → no change
      await act(async () => {
        await Promise.resolve();
      });
      expect(onCountChange).not.toHaveBeenCalled();

      // Now mock 3 notifications for the next poll
      setupSupabaseMock([
        { id: "1", lida: false },
        { id: "2", lida: false },
        { id: "3", lida: false },
      ]);

      // Advance to trigger interval poll (30s)
      await act(async () => {
        jest.advanceTimersByTime(30000);
        await Promise.resolve();
      });

      expect(onCountChange).toHaveBeenCalledWith(3, 0);
    });
  });

  describe("Interval management", () => {
    it("should set up 30s interval", () => {
      const onCountChange = jest.fn();

      renderHook(() =>
        useNotificationPolling({ userId: "user-1", onCountChange }),
      );

      // There should be at least 1 timer (the interval)
      expect(jest.getTimerCount()).toBeGreaterThanOrEqual(1);
    });

    it("should clear interval on unmount", async () => {
      const clearIntervalSpy = jest.spyOn(global, "clearInterval");
      const onCountChange = jest.fn();

      const { unmount } = renderHook(() =>
        useNotificationPolling({ userId: "user-1", onCountChange }),
      );

      await act(async () => {
        await Promise.resolve();
      });

      unmount();

      // clearInterval should have been called during cleanup
      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
    });

    it("should clear old interval and create new one when userId changes", async () => {
      const onCountChange = jest.fn();
      setupSupabaseMock([]);

      const { rerender } = renderHook(
        ({ userId }: { userId: string | undefined }) =>
          useNotificationPolling({ userId, onCountChange }),
        { initialProps: { userId: "user-1" } },
      );

      await act(async () => {
        await Promise.resolve();
      });

      const { supabase } = require("@/lib/supabase");
      const callCountBefore = supabase.from.mock.calls.length;

      // Change userId - should re-setup
      rerender({ userId: "user-2" });

      await act(async () => {
        await Promise.resolve();
      });

      // Should have been called again with new userId
      expect(mockEq).toHaveBeenCalledWith("usuario_id", "user-2");
      expect(supabase.from.mock.calls.length).toBeGreaterThan(callCountBefore);
    });
  });

  describe("Ref stability (stale closure avoidance)", () => {
    it("should use latest onCountChange callback via ref", async () => {
      const firstCallback = jest.fn();
      const secondCallback = jest.fn();
      setupSupabaseMock([]);

      const { rerender } = renderHook(
        ({
          onCountChange,
        }: {
          onCountChange: (n: number, p: number) => void;
        }) => useNotificationPolling({ userId: "user-1", onCountChange }),
        { initialProps: { onCountChange: firstCallback } },
      );

      // Initial poll (count=0, lastCount=0, no change)
      await act(async () => {
        await Promise.resolve();
      });

      // Change callback (should NOT re-create interval since userId didn't change)
      rerender({ onCountChange: secondCallback });

      // Now set up data that triggers a count change
      setupSupabaseMock([{ id: "1", lida: false }]);

      // Advance to next poll
      await act(async () => {
        jest.advanceTimersByTime(30000);
        await Promise.resolve();
      });

      // The second (latest) callback should be called, not the first
      expect(secondCallback).toHaveBeenCalledWith(1, 0);
      expect(firstCallback).not.toHaveBeenCalled();
    });
  });

  describe("setLastCount", () => {
    it("should return setLastCount function", () => {
      const onCountChange = jest.fn();

      const { result } = renderHook(() =>
        useNotificationPolling({ userId: "user-1", onCountChange }),
      );

      expect(typeof result.current.setLastCount).toBe("function");
    });

    it("should update internal lastCount ref to prevent false change notifications", async () => {
      const onCountChange = jest.fn();
      setupSupabaseMock([
        { id: "1", lida: false },
        { id: "2", lida: false },
      ]);

      const { result } = renderHook(() =>
        useNotificationPolling({ userId: "user-1", onCountChange }),
      );

      // Initial poll detects 2 unread (from 0)
      await act(async () => {
        await Promise.resolve();
      });
      expect(onCountChange).toHaveBeenCalledWith(2, 0);
      onCountChange.mockClear();

      // Externally set lastCount to 2 (e.g. after manual load)
      act(() => {
        result.current.setLastCount(2);
      });

      // Next poll with same 2 notifications should NOT trigger change
      await act(async () => {
        jest.advanceTimersByTime(30000);
        await Promise.resolve();
      });

      expect(onCountChange).not.toHaveBeenCalled();
    });
  });

  describe("Error handling", () => {
    it("should handle supabase query error gracefully", async () => {
      const onCountChange = jest.fn();
      setupSupabaseMock(null, { message: "Query failed" });

      renderHook(() =>
        useNotificationPolling({ userId: "user-1", onCountChange }),
      );

      await act(async () => {
        await Promise.resolve();
      });

      // Should not call onCountChange on error
      expect(onCountChange).not.toHaveBeenCalled();
    });

    it("should handle thrown errors gracefully", async () => {
      const onCountChange = jest.fn();
      mockEq2.mockRejectedValue(new Error("Network error"));
      mockEq.mockReturnValue({ eq: mockEq2 });
      mockSelect.mockReturnValue({ eq: mockEq });

      renderHook(() =>
        useNotificationPolling({ userId: "user-1", onCountChange }),
      );

      await act(async () => {
        await Promise.resolve();
      });

      const { logger } = require("@/lib/logger");
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Falha ao carregar notificações"),
        expect.any(Error),
      );
      expect(onCountChange).not.toHaveBeenCalled();
    });
  });
});
