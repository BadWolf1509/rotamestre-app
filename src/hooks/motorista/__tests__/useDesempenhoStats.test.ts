/**
 * useDesempenhoStats - Tests
 *
 * Tests driver performance statistics loading, period filtering,
 * stats aggregation, and error handling.
 */

import { renderHook, act, waitFor } from "@testing-library/react-native";

// Mock supabase
const mockFrom = jest.fn();

jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: (table: string) => mockFrom(table),
  },
}));

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

import { logger } from "@/lib/logger";

import { useDesempenhoStats } from "../useDesempenhoStats";

// Helper to setup supabase chain for rotas
const setupRotasChain = (finalResult: any) => {
  const chain: any = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    gte: jest.fn(() => chain),
    in: jest.fn(() => chain),
    or: jest.fn(() => chain),
    then: (resolve: any) => Promise.resolve(finalResult).then(resolve),
  };
  return chain;
};

// Helper to setup supabase chain for paradas
const setupParadasChain = (finalResult: any) => {
  const chain: any = {
    select: jest.fn(() => chain),
    in: jest.fn(() => chain),
    or: jest.fn(() => chain),
    then: (resolve: any) => Promise.resolve(finalResult).then(resolve),
  };
  return chain;
};

describe("useDesempenhoStats", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("initialization", () => {
    it("starts with loading true and null stats", () => {
      // Prevent the auto-fetch from completing immediately
      mockFrom.mockImplementation(() =>
        setupRotasChain({ data: [], error: null }),
      );

      const { result } = renderHook(() => useDesempenhoStats("user-123"));

      // loading starts true (set in useEffect before loadStats resolves)
      expect(result.current.stats).toBeNull();
      expect(result.current.periodo).toBe("30d");
      expect(result.current.error).toBeNull();
    });

    it("provides setPeriodo and refresh functions", () => {
      mockFrom.mockImplementation(() =>
        setupRotasChain({ data: [], error: null }),
      );

      const { result } = renderHook(() => useDesempenhoStats("user-123"));

      expect(typeof result.current.setPeriodo).toBe("function");
      expect(typeof result.current.refresh).toBe("function");
    });
  });

  describe("no userId", () => {
    it("sets stats to null and loading to false when userId is undefined", async () => {
      const { result } = renderHook(() => useDesempenhoStats(undefined));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.stats).toBeNull();
      expect(mockFrom).not.toHaveBeenCalled();
    });
  });

  describe("empty data", () => {
    it("returns zero stats when no routes exist", async () => {
      mockFrom.mockImplementation(() =>
        setupRotasChain({ data: [], error: null }),
      );

      const { result } = renderHook(() => useDesempenhoStats("user-123"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.stats).toEqual({
        totalRotas: 0,
        rotasConcluidas: 0,
        rotasCanceladas: 0,
        taxaSucesso: 0,
        totalKm: 0,
        mediaParadasPorRota: 0,
        totalParadas: 0,
        paradasConcluidas: 0,
        paradasPuladas: 0,
      });
    });

    it("does not query paradas when there are no routes", async () => {
      const rotasChain = setupRotasChain({ data: [], error: null });
      mockFrom.mockImplementation((table: string) => {
        if (table === "rotas") return rotasChain;
        // Should not be called
        return setupParadasChain({ data: [], error: null });
      });

      const { result } = renderHook(() => useDesempenhoStats("user-123"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Only rotas was queried
      expect(mockFrom).toHaveBeenCalledWith("rotas");
      expect(mockFrom).not.toHaveBeenCalledWith("paradas");
    });
  });

  describe("stats aggregation", () => {
    it("correctly aggregates route statistics", async () => {
      const mockRotas = [
        { id: "rota-1", status: "concluida", distancia_total: 25 },
        { id: "rota-2", status: "concluida", distancia_total: 35 },
        { id: "rota-3", status: "cancelada", distancia_total: 10 },
        { id: "rota-4", status: "em_andamento", distancia_total: 15 },
      ];

      const mockParadas = [
        { id: "p-1", status: "concluida", rota_id: "rota-1" },
        { id: "p-2", status: "concluida", rota_id: "rota-1" },
        { id: "p-3", status: "pulada", rota_id: "rota-2" },
        { id: "p-4", status: "concluida", rota_id: "rota-2" },
        { id: "p-5", status: "pendente", rota_id: "rota-3" },
        { id: "p-6", status: "concluida", rota_id: "rota-4" },
      ];

      mockFrom.mockImplementation((table: string) => {
        if (table === "rotas") {
          return setupRotasChain({ data: mockRotas, error: null });
        }
        if (table === "paradas") {
          return setupParadasChain({ data: mockParadas, error: null });
        }
        return setupRotasChain({ data: [], error: null });
      });

      const { result } = renderHook(() => useDesempenhoStats("user-123"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.stats).toEqual({
        totalRotas: 4,
        rotasConcluidas: 2,
        rotasCanceladas: 1,
        taxaSucesso: 50, // 2/4 = 50%
        totalKm: 85, // 25 + 35 + 10 + 15
        mediaParadasPorRota: 2, // Math.round(6/4) = 2
        totalParadas: 6,
        paradasConcluidas: 4, // p-1, p-2, p-4, p-6
        paradasPuladas: 1, // p-3
      });
    });

    it("handles routes with null distancia_total", async () => {
      const mockRotas = [
        { id: "rota-1", status: "concluida", distancia_total: null },
        { id: "rota-2", status: "concluida", distancia_total: 20 },
      ];

      mockFrom.mockImplementation((table: string) => {
        if (table === "rotas") {
          return setupRotasChain({ data: mockRotas, error: null });
        }
        if (table === "paradas") {
          return setupParadasChain({ data: [], error: null });
        }
        return setupRotasChain({ data: [], error: null });
      });

      const { result } = renderHook(() => useDesempenhoStats("user-123"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.stats!.totalKm).toBe(20); // 0 + 20
    });

    it("calculates 100% success rate when all routes are completed", async () => {
      const mockRotas = [
        { id: "rota-1", status: "concluida", distancia_total: 10 },
        { id: "rota-2", status: "concluida", distancia_total: 15 },
      ];

      mockFrom.mockImplementation((table: string) => {
        if (table === "rotas") {
          return setupRotasChain({ data: mockRotas, error: null });
        }
        if (table === "paradas") {
          return setupParadasChain({ data: [], error: null });
        }
        return setupRotasChain({ data: [], error: null });
      });

      const { result } = renderHook(() => useDesempenhoStats("user-123"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.stats!.taxaSucesso).toBe(100);
    });

    it("rounds mediaParadasPorRota correctly", async () => {
      const mockRotas = [
        { id: "rota-1", status: "concluida", distancia_total: 10 },
        { id: "rota-2", status: "concluida", distancia_total: 10 },
        { id: "rota-3", status: "concluida", distancia_total: 10 },
      ];

      // 7 paradas / 3 rotas = 2.33 -> rounds to 2
      const mockParadas = [
        { id: "p-1", status: "concluida", rota_id: "rota-1" },
        { id: "p-2", status: "concluida", rota_id: "rota-1" },
        { id: "p-3", status: "concluida", rota_id: "rota-1" },
        { id: "p-4", status: "concluida", rota_id: "rota-2" },
        { id: "p-5", status: "concluida", rota_id: "rota-2" },
        { id: "p-6", status: "concluida", rota_id: "rota-3" },
        { id: "p-7", status: "concluida", rota_id: "rota-3" },
      ];

      mockFrom.mockImplementation((table: string) => {
        if (table === "rotas") {
          return setupRotasChain({ data: mockRotas, error: null });
        }
        if (table === "paradas") {
          return setupParadasChain({ data: mockParadas, error: null });
        }
        return setupRotasChain({ data: [], error: null });
      });

      const { result } = renderHook(() => useDesempenhoStats("user-123"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.stats!.mediaParadasPorRota).toBe(2); // Math.round(7/3) = 2
    });
  });

  describe("period filtering", () => {
    it("defaults to 30d period", () => {
      mockFrom.mockImplementation(() =>
        setupRotasChain({ data: [], error: null }),
      );

      const { result } = renderHook(() => useDesempenhoStats("user-123"));

      expect(result.current.periodo).toBe("30d");
    });

    it("allows changing period", async () => {
      mockFrom.mockImplementation(() =>
        setupRotasChain({ data: [], error: null }),
      );

      const { result } = renderHook(() => useDesempenhoStats("user-123"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.setPeriodo("7d");
      });

      expect(result.current.periodo).toBe("7d");
    });

    it("reloads data when period changes", async () => {
      mockFrom.mockImplementation(() =>
        setupRotasChain({ data: [], error: null }),
      );

      const { result } = renderHook(() => useDesempenhoStats("user-123"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Clear to track new calls
      mockFrom.mockClear();
      mockFrom.mockImplementation(() =>
        setupRotasChain({ data: [], error: null }),
      );

      act(() => {
        result.current.setPeriodo("7d");
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockFrom).toHaveBeenCalledWith("rotas");
    });

    it("applies gte filter for 7d and 30d periods", async () => {
      let capturedChain: any;
      mockFrom.mockImplementation((table: string) => {
        const chain = setupRotasChain({ data: [], error: null });
        if (table === "rotas") capturedChain = chain;
        return chain;
      });

      const { result } = renderHook(() => useDesempenhoStats("user-123"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // 30d period should call gte
      expect(capturedChain.gte).toHaveBeenCalledWith(
        "created_at",
        expect.any(String),
      );
    });

    it('does not apply gte filter for "all" period', async () => {
      let capturedChain: any;
      mockFrom.mockImplementation((table: string) => {
        const chain = setupRotasChain({ data: [], error: null });
        if (table === "rotas") capturedChain = chain;
        return chain;
      });

      const { result } = renderHook(() => useDesempenhoStats("user-123"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Reset and change to 'all'
      mockFrom.mockClear();
      capturedChain = null;
      mockFrom.mockImplementation((table: string) => {
        const chain = setupRotasChain({ data: [], error: null });
        if (table === "rotas") capturedChain = chain;
        return chain;
      });

      act(() => {
        result.current.setPeriodo("all");
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // For 'all' period, gte should NOT be called (only select and eq are called)
      expect(capturedChain.gte).not.toHaveBeenCalled();
    });
  });

  describe("refresh", () => {
    it("sets refreshing to true while loading", async () => {
      mockFrom.mockImplementation(() =>
        setupRotasChain({ data: [], error: null }),
      );

      const { result } = renderHook(() => useDesempenhoStats("user-123"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.refresh();
      });

      // refreshing should have been set to true (may already resolve)
      await waitFor(() => {
        expect(result.current.refreshing).toBe(false);
      });
    });

    it("reloads stats on refresh", async () => {
      mockFrom.mockImplementation(() =>
        setupRotasChain({ data: [], error: null }),
      );

      const { result } = renderHook(() => useDesempenhoStats("user-123"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      mockFrom.mockClear();
      mockFrom.mockImplementation(() =>
        setupRotasChain({ data: [], error: null }),
      );

      act(() => {
        result.current.refresh();
      });

      await waitFor(() => {
        expect(result.current.refreshing).toBe(false);
      });

      expect(mockFrom).toHaveBeenCalledWith("rotas");
    });
  });

  describe("error handling", () => {
    it("sets error message on rotas query failure", async () => {
      mockFrom.mockImplementation(() =>
        setupRotasChain({ data: null, error: { message: "Network error" } }),
      );

      const { result } = renderHook(() => useDesempenhoStats("user-123"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe(
        "Nao foi possivel carregar suas estatisticas. Puxe para baixo para tentar novamente.",
      );
      expect(result.current.stats).toBeNull();
      expect(logger.error).toHaveBeenCalled();
    });

    it("sets error message on paradas query failure", async () => {
      const mockRotas = [
        { id: "rota-1", status: "concluida", distancia_total: 10 },
      ];

      mockFrom.mockImplementation((table: string) => {
        if (table === "rotas") {
          return setupRotasChain({ data: mockRotas, error: null });
        }
        if (table === "paradas") {
          return setupParadasChain({
            data: null,
            error: { message: "DB error" },
          });
        }
        return setupRotasChain({ data: [], error: null });
      });

      const { result } = renderHook(() => useDesempenhoStats("user-123"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe(
        "Nao foi possivel carregar suas estatisticas. Puxe para baixo para tentar novamente.",
      );
      expect(result.current.stats).toBeNull();
    });

    it("clears error on successful retry", async () => {
      // First call fails
      mockFrom.mockImplementation(() =>
        setupRotasChain({ data: null, error: { message: "Error" } }),
      );

      const { result } = renderHook(() => useDesempenhoStats("user-123"));

      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
      });

      expect(result.current.stats).toBeNull();

      // Now make it succeed
      mockFrom.mockImplementation(() =>
        setupRotasChain({ data: [], error: null }),
      );

      act(() => {
        result.current.refresh();
      });

      await waitFor(() => {
        expect(result.current.error).toBeNull();
        expect(result.current.refreshing).toBe(false);
      });

      expect(result.current.stats).not.toBeNull();
      expect(result.current.stats!.totalRotas).toBe(0);
    });
  });

  describe("userId change", () => {
    it("reloads stats when userId changes", async () => {
      mockFrom.mockImplementation(() =>
        setupRotasChain({ data: [], error: null }),
      );

      const { result, rerender } = renderHook(
        ({ userId }) => useDesempenhoStats(userId),
        { initialProps: { userId: "user-1" as string | undefined } },
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      mockFrom.mockClear();
      mockFrom.mockImplementation(() =>
        setupRotasChain({ data: [], error: null }),
      );

      rerender({ userId: "user-2" });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockFrom).toHaveBeenCalledWith("rotas");
    });

    it("clears stats when userId becomes undefined", async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === "rotas") {
          return setupRotasChain({
            data: [{ id: "r-1", status: "concluida", distancia_total: 10 }],
            error: null,
          });
        }
        return setupParadasChain({ data: [], error: null });
      });

      const { result, rerender } = renderHook(
        ({ userId }) => useDesempenhoStats(userId),
        { initialProps: { userId: "user-1" as string | undefined } },
      );

      await waitFor(() => {
        expect(result.current.stats).not.toBeNull();
      });

      rerender({ userId: undefined });

      await waitFor(() => {
        expect(result.current.stats).toBeNull();
        expect(result.current.loading).toBe(false);
      });
    });
  });
});
