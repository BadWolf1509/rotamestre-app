import AsyncStorage from "@react-native-async-storage/async-storage";
import { renderHook, act, waitFor } from "@testing-library/react-native";

import {
  useTimelineLastSeen,
  clearTimelineLastSeen,
  clearAllTimelineLastSeen,
} from "../useTimelineLastSeen";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  getAllKeys: jest.fn(),
  removeMany: jest.fn(),
}));

describe("useTimelineLastSeen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([]);
    (AsyncStorage.removeMany as jest.Mock).mockResolvedValue(undefined);
  });

  it("carrega lastSeen do storage", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
      "2024-01-01T00:00:00.000Z",
    );

    const { result } = renderHook(() => useTimelineLastSeen("rota-1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.lastSeenTimestamp).toBe("2024-01-01T00:00:00.000Z");
    expect(result.current.isNewEvent("2024-01-01T00:00:00.000Z")).toBe(false);
    expect(result.current.isNewEvent("2024-01-01T01:00:00.000Z")).toBe(true);
  });

  it("usa fallback quando storage vazio", async () => {
    const { result } = renderHook(() =>
      useTimelineLastSeen("rota-2", "2024-01-01T02:00:00.000Z"),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.lastSeenTimestamp).toBeNull();
    expect(result.current.isNewEvent("2024-01-01T01:00:00.000Z")).toBe(false);
    expect(result.current.isNewEvent("2024-01-01T03:00:00.000Z")).toBe(true);
  });

  it("nao consulta storage quando rotaId esta vazio", async () => {
    const { result } = renderHook(() => useTimelineLastSeen(""));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(AsyncStorage.getItem).not.toHaveBeenCalled();
  });

  it("markAsSeen atualiza quando timestamp e mais recente", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
      "2024-01-01T00:00:00.000Z",
    );

    const { result } = renderHook(() => useTimelineLastSeen("rota-3"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.markAsSeen("2024-01-01T01:00:00.000Z");
    });

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      "@timeline_last_seen_rota-3",
      "2024-01-01T01:00:00.000Z",
    );
    expect(result.current.lastSeenTimestamp).toBe("2024-01-01T01:00:00.000Z");
  });

  it("markAsSeen ignora timestamp mais antigo", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
      "2024-01-01T02:00:00.000Z",
    );

    const { result } = renderHook(() => useTimelineLastSeen("rota-4"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.markAsSeen("2024-01-01T01:00:00.000Z");
    });

    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it("markAsSeen lida com erro ao salvar", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockRejectedValue(
      new Error("save error"),
    );
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();

    const { result } = renderHook(() => useTimelineLastSeen("rota-5"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.markAsSeen("2024-01-01T05:00:00.000Z");
    });

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("markAllAsSeen usa evento mais recente e ignora lista vazia", async () => {
    const { result } = renderHook(() => useTimelineLastSeen("rota-6"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.markAllAsSeen([]);
    });

    expect(AsyncStorage.setItem).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.markAllAsSeen([
        { timestamp: "2024-01-01T01:00:00.000Z" },
        { timestamp: "2024-01-01T03:00:00.000Z" },
      ]);
    });

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      "@timeline_last_seen_rota-6",
      "2024-01-01T03:00:00.000Z",
    );
  });

  it("countNewEvents retorna 0 quando nao ha referencia", async () => {
    const { result } = renderHook(() => useTimelineLastSeen("rota-7"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const count = result.current.countNewEvents([
      { timestamp: "2024-01-01T01:00:00.000Z" },
    ]);

    expect(count).toBe(0);
  });
});

describe("clearTimelineLastSeen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
  });

  it("remove chave da rota", async () => {
    await clearTimelineLastSeen("rota-1");

    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
      "@timeline_last_seen_rota-1",
    );
  });

  it("trata erro ao remover", async () => {
    (AsyncStorage.removeItem as jest.Mock).mockRejectedValue(
      new Error("remove error"),
    );
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();

    await clearTimelineLastSeen("rota-2");

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe("clearAllTimelineLastSeen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([
      "@timeline_last_seen_rota-1",
      "@timeline_last_seen_rota-2",
      "@other_key",
    ]);
    (AsyncStorage.removeMany as jest.Mock).mockResolvedValue(undefined);
  });

  it("remove todas as chaves com prefixo", async () => {
    await clearAllTimelineLastSeen();

    expect(AsyncStorage.removeMany).toHaveBeenCalledWith([
      "@timeline_last_seen_rota-1",
      "@timeline_last_seen_rota-2",
    ]);
  });

  it("trata erro ao limpar", async () => {
    (AsyncStorage.getAllKeys as jest.Mock).mockRejectedValue(
      new Error("get keys error"),
    );
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();

    await clearAllTimelineLastSeen();

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
