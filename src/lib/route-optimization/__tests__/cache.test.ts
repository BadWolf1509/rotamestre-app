/**
 * Tests for two-tier route optimization cache (memory + AsyncStorage).
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

import type { ResultadoOtimizacao } from "../types";

// Need to reset module state between tests since cache uses module-level variables
let gerarHashRota: typeof import("../cache").gerarHashRota;
let obterDoCache: typeof import("../cache").obterDoCache;
let salvarNoCache: typeof import("../cache").salvarNoCache;
let limparCacheOtimizacao: typeof import("../cache").limparCacheOtimizacao;
let _precarregarCache: typeof import("../cache").precarregarCache;
let estatisticasCache: typeof import("../cache").estatisticasCache;

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  },
}));

const mockGetItem = AsyncStorage.getItem as jest.Mock;
const mockSetItem = AsyncStorage.setItem as jest.Mock;
const mockRemoveItem = AsyncStorage.removeItem as jest.Mock;

function makeResultado(
  overrides?: Partial<ResultadoOtimizacao>,
): ResultadoOtimizacao {
  return {
    paradasOrdenadas: [],
    distanciaTotalMetros: 1000,
    duracaoTotalSegundos: 600,
    polyline: "abc123",
    ordemIndices: [0, 1],
    ...overrides,
  };
}

function makeParada(id: string) {
  return {
    id,
    tipo: "entrega" as const,
    endereco: `Rua ${id}`,
    latitude: -23.55,
    longitude: -46.63,
    ordem: 1,
  };
}

describe("gerarHashRota", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    const cacheModule = require("../cache");
    gerarHashRota = cacheModule.gerarHashRota;
  });

  it("generates deterministic hash for same inputs", () => {
    const origem = { latitude: -23.55052, longitude: -46.633308 };
    const paradas = [makeParada("p1")];

    const hash1 = gerarHashRota(origem, paradas);
    const hash2 = gerarHashRota(origem, paradas);
    expect(hash1).toBe(hash2);
  });

  it("generates different hashes for different origins", () => {
    const origem1 = { latitude: -23.55, longitude: -46.63 };
    const origem2 = { latitude: -22.9, longitude: -43.17 };
    const paradas = [makeParada("p1")];

    expect(gerarHashRota(origem1, paradas)).not.toBe(
      gerarHashRota(origem2, paradas),
    );
  });

  it("generates different hashes for different stops", () => {
    const origem = { latitude: -23.55, longitude: -46.63 };
    const paradas1 = [makeParada("p1")];
    const paradas2 = [makeParada("p2")];

    expect(gerarHashRota(origem, paradas1)).not.toBe(
      gerarHashRota(origem, paradas2),
    );
  });

  it("includes destino in hash when provided", () => {
    const origem = { latitude: -23.55, longitude: -46.63 };
    const destino = { latitude: -23.6, longitude: -46.7 };
    const paradas = [makeParada("p1")];

    const hashSem = gerarHashRota(origem, paradas);
    const hashCom = gerarHashRota(origem, paradas, destino);
    expect(hashSem).not.toBe(hashCom);
  });

  it("sorts paradas for order-independent hash", () => {
    const origem = { latitude: -23.55, longitude: -46.63 };
    const p1 = makeParada("a");
    const p2 = makeParada("b");

    const hash1 = gerarHashRota(origem, [p1, p2]);
    const hash2 = gerarHashRota(origem, [p2, p1]);
    expect(hash1).toBe(hash2);
  });

  it("uses 6 decimal places for coordinates", () => {
    const origem = { latitude: -23.5505201234, longitude: -46.6333081234 };
    const paradas = [makeParada("p1")];

    const hash = gerarHashRota(origem, paradas);
    expect(hash).toContain("-23.550520");
    expect(hash).toContain("-46.633308");
  });
});

describe("cache operations", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    // Default: AsyncStorage returns null (empty storage)
    mockGetItem.mockResolvedValue(null);
    mockSetItem.mockResolvedValue(null);
    mockRemoveItem.mockResolvedValue(null);

    const cacheModule = require("../cache");
    gerarHashRota = cacheModule.gerarHashRota;
    obterDoCache = cacheModule.obterDoCache;
    salvarNoCache = cacheModule.salvarNoCache;
    limparCacheOtimizacao = cacheModule.limparCacheOtimizacao;
    _precarregarCache = cacheModule.precarregarCache;
    estatisticasCache = cacheModule.estatisticasCache;
  });

  describe("obterDoCache", () => {
    it("returns null for unknown hash", async () => {
      const result = await obterDoCache("nonexistent-hash");
      expect(result).toBeNull();
    });

    it("returns cached result after salvarNoCache", async () => {
      const resultado = makeResultado();
      await salvarNoCache("test-hash", resultado);

      const cached = await obterDoCache("test-hash");
      expect(cached).toEqual(resultado);
    });

    it("returns null for expired entry", async () => {
      const resultado = makeResultado();
      await salvarNoCache("expired-hash", resultado);

      // Fast-forward time past TTL (24h + 1ms)
      const originalNow = Date.now;
      Date.now = jest.fn(() => originalNow() + 24 * 60 * 60 * 1000 + 1);

      const cached = await obterDoCache("expired-hash");
      expect(cached).toBeNull();

      Date.now = originalNow;
    });
  });

  describe("salvarNoCache", () => {
    it("saves and retrieves result", async () => {
      const resultado = makeResultado({ distanciaTotalMetros: 5000 });
      await salvarNoCache("save-test", resultado);

      const cached = await obterDoCache("save-test");
      expect(cached?.distanciaTotalMetros).toBe(5000);
    });

    it("calls AsyncStorage.setItem to persist", async () => {
      // Get the same AsyncStorage mock instance used by the cache module
      const currentAsyncStorage = require("@react-native-async-storage/async-storage");
      const setItemSpy = currentAsyncStorage.setItem as jest.Mock;
      setItemSpy.mockClear();

      const resultado = makeResultado();
      await salvarNoCache("persist-test", resultado);

      // Wait for fire-and-forget persistirCacheNoStorage
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(setItemSpy).toHaveBeenCalledWith(
        "@rotamestre/route-optimization-cache",
        expect.stringContaining("persist-test"),
      );
    });

    it("evicts oldest entry when exceeding MAX_CACHE_ENTRIES", async () => {
      // Save 50 entries (max)
      for (let i = 0; i < 50; i++) {
        await salvarNoCache(`entry-${i}`, makeResultado());
      }

      // Save one more - should evict the oldest
      await salvarNoCache("entry-new", makeResultado());

      const stats = await estatisticasCache();
      expect(stats.tamanho).toBeLessThanOrEqual(50);
      expect(stats.entradas).toContain("entry-new");
    });

    it("cleans expired entries before adding new ones", async () => {
      await salvarNoCache("old-entry", makeResultado());

      // Advance time past TTL
      const originalNow = Date.now;
      const baseTime = originalNow();
      Date.now = jest.fn(() => baseTime + 24 * 60 * 60 * 1000 + 1);

      await salvarNoCache("new-entry", makeResultado());

      const stats = await estatisticasCache();
      expect(stats.entradas).toContain("new-entry");
      expect(stats.entradas).not.toContain("old-entry");

      Date.now = originalNow;
    });
  });

  describe("limparCacheOtimizacao", () => {
    it("clears all cache entries", async () => {
      await salvarNoCache("entry1", makeResultado());
      await salvarNoCache("entry2", makeResultado());

      await limparCacheOtimizacao();

      const stats = await estatisticasCache();
      expect(stats.tamanho).toBe(0);
    });

    it("removes from AsyncStorage", async () => {
      const currentAsyncStorage = require("@react-native-async-storage/async-storage");
      const removeItemSpy = currentAsyncStorage.removeItem as jest.Mock;
      removeItemSpy.mockClear();

      await salvarNoCache("entry1", makeResultado());
      await limparCacheOtimizacao();

      expect(removeItemSpy).toHaveBeenCalledWith(
        "@rotamestre/route-optimization-cache",
      );
    });
  });

  describe("precarregarCache", () => {
    it("loads valid entries from AsyncStorage", async () => {
      const cacheData = {
        version: 1,
        entries: {
          "preloaded-hash": {
            resultado: makeResultado(),
            timestamp: Date.now(),
          },
        },
      };
      mockGetItem.mockResolvedValue(JSON.stringify(cacheData));

      // Reset module to clear memory cache, re-setup mock
      jest.resetModules();
      const freshAsyncStorage = require("@react-native-async-storage/async-storage");
      (freshAsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(cacheData),
      );

      const freshModule = require("../cache");
      await freshModule.precarregarCache();

      const cached = await freshModule.obterDoCache("preloaded-hash");
      expect(cached).not.toBeNull();
      expect(cached.distanciaTotalMetros).toBe(1000);
    });

    it("handles corrupt AsyncStorage data gracefully", async () => {
      jest.resetModules();
      const freshAsyncStorage = require("@react-native-async-storage/async-storage");
      (freshAsyncStorage.getItem as jest.Mock).mockResolvedValue(
        "not-valid-json{",
      );

      const freshModule = require("../cache");

      // Should not throw
      await freshModule.precarregarCache();

      const stats = await freshModule.estatisticasCache();
      expect(stats.tamanho).toBe(0);
    });

    it("discards entries from different cache version", async () => {
      const cacheData = {
        version: 999, // wrong version
        entries: {
          "old-version": {
            resultado: makeResultado(),
            timestamp: Date.now(),
          },
        },
      };

      jest.resetModules();
      const freshAsyncStorage = require("@react-native-async-storage/async-storage");
      (freshAsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(cacheData),
      );

      const freshModule = require("../cache");
      await freshModule.precarregarCache();

      const stats = await freshModule.estatisticasCache();
      expect(stats.tamanho).toBe(0);
    });

    it("skips expired entries when loading from storage", async () => {
      const cacheData = {
        version: 1,
        entries: {
          "expired-hash": {
            resultado: makeResultado(),
            timestamp: Date.now() - 25 * 60 * 60 * 1000, // 25h ago
          },
          "valid-hash": {
            resultado: makeResultado(),
            timestamp: Date.now(),
          },
        },
      };

      jest.resetModules();
      const freshAsyncStorage = require("@react-native-async-storage/async-storage");
      (freshAsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(cacheData),
      );

      const freshModule = require("../cache");
      await freshModule.precarregarCache();

      const stats = await freshModule.estatisticasCache();
      expect(stats.tamanho).toBe(1);
      expect(stats.entradas).toContain("valid-hash");
      expect(stats.entradas).not.toContain("expired-hash");
    });
  });

  describe("estatisticasCache", () => {
    it("returns correct size and keys", async () => {
      await salvarNoCache("key-a", makeResultado());
      await salvarNoCache("key-b", makeResultado());

      const stats = await estatisticasCache();
      expect(stats.tamanho).toBe(2);
      expect(stats.entradas).toContain("key-a");
      expect(stats.entradas).toContain("key-b");
    });

    it("returns empty stats for fresh cache", async () => {
      const stats = await estatisticasCache();
      expect(stats.tamanho).toBe(0);
      expect(stats.entradas).toEqual([]);
    });
  });
});
