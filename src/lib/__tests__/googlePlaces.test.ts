/**
 * Tests for Google Places Autocomplete Service (via Supabase Edge Functions).
 */

// Mock cache
jest.mock("@/lib/cache", () => ({
  getCache: jest.fn(() => null),
  setCache: jest.fn(),
  CACHE_TTL: {
    AUTOCOMPLETE: 300000,
    GEOCODING: 1800000,
  },
}));

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock global.fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

const MOCK_URL = "https://test-project.supabase.co";
const MOCK_KEY = "test-anon-key-123";

// Must set env vars BEFORE module is loaded
// We use jest.isolateModules + require for this
let googlePlacesService: any;
let getCache: jest.Mock;
let setCache: jest.Mock;
let logger: any;

function loadModule() {
  // Set env before module evaluation
  process.env.EXPO_PUBLIC_SUPABASE_URL = MOCK_URL;
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = MOCK_KEY;

  jest.resetModules();

  const cacheModule = require("@/lib/cache");
  getCache = cacheModule.getCache;
  setCache = cacheModule.setCache;
  logger = require("@/lib/logger").logger;

  const mod = require("../googlePlaces");
  googlePlacesService = mod.googlePlacesService;
}

function makeAutocompleteResponse(overrides?: Record<string, any>) {
  return {
    status: "OK",
    predictions: [
      {
        place_id: "place_123",
        description: "Rua Augusta, 100 - São Paulo, SP",
        structured_formatting: {
          main_text: "Rua Augusta, 100",
          secondary_text: "São Paulo, SP",
        },
      },
    ],
    ...overrides,
  };
}

function makePlaceDetailsResponse(overrides?: Record<string, any>) {
  return {
    logradouro: "Rua Augusta",
    numero: "100",
    bairro: "Consolação",
    cidade: "São Paulo",
    estado: "SP",
    cep: "01304-001",
    coordenadas: { latitude: -23.5534, longitude: -46.6587 },
    formatted_address: "Rua Augusta, 100 - Consolação, São Paulo - SP",
    ...overrides,
  };
}

function mockFetchResponse(data: unknown, ok = true, status = 200) {
  return mockFetch.mockResolvedValueOnce({
    ok,
    status,
    json: () => Promise.resolve(data),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockReset();
  loadModule();
  (getCache as jest.Mock).mockResolvedValue(null);
  (setCache as jest.Mock).mockResolvedValue(undefined);
});

describe("googlePlacesService", () => {
  describe("isAvailable", () => {
    it("returns true when env vars are set", () => {
      expect(googlePlacesService.isAvailable()).toBe(true);
    });

    it("returns false when env vars are missing", () => {
      delete process.env.EXPO_PUBLIC_SUPABASE_URL;
      delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      jest.resetModules();
      const mod = require("../googlePlaces");
      expect(mod.googlePlacesService.isAvailable()).toBe(false);
    });
  });

  describe("autocompleteAddress", () => {
    it("returns suggestions on success", async () => {
      mockFetchResponse(makeAutocompleteResponse());

      const results =
        await googlePlacesService.autocompleteAddress("Rua Augusta");

      expect(results).toHaveLength(1);
      expect(results[0].place_id).toBe("place_123");
      expect(results[0].description).toBe("Rua Augusta, 100 - São Paulo, SP");
      expect(results[0].source).toBe("google");
    });

    it("returns empty array for input shorter than 3 chars", async () => {
      const results = await googlePlacesService.autocompleteAddress("Ru");

      expect(results).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("returns cached results on cache hit", async () => {
      const cached = [
        {
          place_id: "cached_place",
          description: "Cached address",
          structured_formatting: {
            main_text: "Cached",
            secondary_text: "address",
          },
          source: "google",
        },
      ];
      (getCache as jest.Mock).mockResolvedValue(cached);

      const results =
        await googlePlacesService.autocompleteAddress("Rua Augusta");

      expect(results).toBe(cached);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("saves results to cache on success", async () => {
      mockFetchResponse(makeAutocompleteResponse());

      await googlePlacesService.autocompleteAddress("Rua Augusta");

      expect(setCache).toHaveBeenCalledWith(
        expect.stringContaining("google_autocomplete_"),
        expect.arrayContaining([
          expect.objectContaining({ place_id: "place_123" }),
        ]),
        expect.any(Number),
      );
    });

    it("does not cache empty results", async () => {
      mockFetchResponse(makeAutocompleteResponse({ predictions: [] }));

      const results =
        await googlePlacesService.autocompleteAddress("xyz empty");

      expect(results).toEqual([]);
      expect(setCache).not.toHaveBeenCalled();
    });

    it("returns empty array on API error response", async () => {
      mockFetchResponse(
        makeAutocompleteResponse({ error: "INVALID_REQUEST", status: "ERROR" }),
      );

      const results =
        await googlePlacesService.autocompleteAddress("bad input");

      expect(results).toEqual([]);
      expect(logger.warn).toHaveBeenCalled();
    });

    it("returns empty array on network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const results =
        await googlePlacesService.autocompleteAddress("Rua Augusta");

      expect(results).toEqual([]);
      expect(logger.error).toHaveBeenCalled();
    });

    it("returns empty array on timeout (AbortError)", async () => {
      const abortError = new DOMException(
        "The operation was aborted",
        "AbortError",
      );
      mockFetch.mockRejectedValueOnce(abortError);

      const results =
        await googlePlacesService.autocompleteAddress("Rua Augusta");

      expect(results).toEqual([]);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("timeout"),
      );
    });

    it("returns empty array on non-200 response", async () => {
      mockFetchResponse(null, false, 500);

      const results =
        await googlePlacesService.autocompleteAddress("Rua Augusta");

      expect(results).toEqual([]);
      expect(logger.warn).toHaveBeenCalled();
    });

    it("passes auth headers and body to fetch", async () => {
      mockFetchResponse(makeAutocompleteResponse());

      await googlePlacesService.autocompleteAddress(
        "Rua Augusta",
        "session-token-123",
      );

      expect(mockFetch).toHaveBeenCalledWith(
        `${MOCK_URL}/functions/v1/google-places-autocomplete`,
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: `Bearer ${MOCK_KEY}`,
            apikey: MOCK_KEY,
            "Content-Type": "application/json",
          }),
          body: expect.stringContaining("Rua Augusta"),
        }),
      );
    });

    it("handles null fetchEdgeFunction response", async () => {
      mockFetchResponse(null, false, 503);

      const results =
        await googlePlacesService.autocompleteAddress("Rua Augusta");

      expect(results).toEqual([]);
    });

    it("handles multiple predictions", async () => {
      mockFetchResponse(
        makeAutocompleteResponse({
          predictions: [
            {
              place_id: "p1",
              description: "Address 1",
              structured_formatting: { main_text: "A1", secondary_text: "S1" },
            },
            {
              place_id: "p2",
              description: "Address 2",
              structured_formatting: { main_text: "A2", secondary_text: "S2" },
            },
          ],
        }),
      );

      const results = await googlePlacesService.autocompleteAddress("Address");

      expect(results).toHaveLength(2);
      expect(results[0].place_id).toBe("p1");
      expect(results[1].place_id).toBe("p2");
    });

    it("returns empty when service not available", async () => {
      delete process.env.EXPO_PUBLIC_SUPABASE_URL;
      jest.resetModules();
      const freshLogger = require("@/lib/logger").logger;
      const mod = require("../googlePlaces");

      const results =
        await mod.googlePlacesService.autocompleteAddress("Rua Augusta");

      expect(results).toEqual([]);
      expect(freshLogger.warn).toHaveBeenCalled();
    });
  });

  describe("getPlaceDetails", () => {
    it("returns geocoded address on success", async () => {
      mockFetchResponse(makePlaceDetailsResponse());

      const result = await googlePlacesService.getPlaceDetails("place_123");

      expect(result).not.toBeNull();
      expect(result.logradouro).toBe("Rua Augusta");
      expect(result.coordenadas.latitude).toBe(-23.5534);
      expect(result.formatted_address).toContain("Rua Augusta");
    });

    it("returns cached result on cache hit", async () => {
      const cachedDetails = {
        logradouro: "Cached St",
        numero: "1",
        bairro: "B",
        cidade: "C",
        estado: "E",
        cep: "00000-000",
        coordenadas: { latitude: -23.5, longitude: -46.6 },
        formatted_address: "Cached St, 1",
      };
      (getCache as jest.Mock).mockResolvedValue(cachedDetails);

      const result = await googlePlacesService.getPlaceDetails("place_cached");

      expect(result).toBe(cachedDetails);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("saves result to cache on success", async () => {
      mockFetchResponse(makePlaceDetailsResponse());

      await googlePlacesService.getPlaceDetails("place_123");

      expect(setCache).toHaveBeenCalledWith(
        "google_details_place_123",
        expect.objectContaining({ logradouro: "Rua Augusta" }),
        expect.any(Number),
      );
    });

    it("returns null on API error response", async () => {
      mockFetchResponse(makePlaceDetailsResponse({ error: "NOT_FOUND" }));

      const result = await googlePlacesService.getPlaceDetails("bad_place");

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalled();
    });

    it("returns null on network failure", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Connection refused"));

      const result = await googlePlacesService.getPlaceDetails("place_123");

      expect(result).toBeNull();
    });

    it("returns null on non-ok response", async () => {
      mockFetchResponse(null, false, 404);

      const result = await googlePlacesService.getPlaceDetails("place_123");

      expect(result).toBeNull();
    });

    it("returns null when service not available", async () => {
      delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      jest.resetModules();
      const mod = require("../googlePlaces");

      const result = await mod.googlePlacesService.getPlaceDetails("place_123");

      expect(result).toBeNull();
    });
  });

  describe("autocompleteWithCoordinates", () => {
    it("returns suggestion with coordinates on success", async () => {
      // First call: autocomplete
      mockFetchResponse(makeAutocompleteResponse());
      // Second call: place details
      mockFetchResponse(makePlaceDetailsResponse());

      const result =
        await googlePlacesService.autocompleteWithCoordinates("Rua Augusta");

      expect(result).not.toBeNull();
      expect(result.place_id).toBe("place_123");
      expect(result.coordinates.latitude).toBe(-23.5534);
      expect(result.source).toBe("google");
    });

    it("returns null when no suggestions found", async () => {
      mockFetchResponse(makeAutocompleteResponse({ predictions: [] }));

      const result =
        await googlePlacesService.autocompleteWithCoordinates("xyz nothing");

      expect(result).toBeNull();
    });

    it("returns null when place details has no coordinates", async () => {
      mockFetchResponse(makeAutocompleteResponse());
      mockFetchResponse(makePlaceDetailsResponse({ coordenadas: undefined }));

      const result =
        await googlePlacesService.autocompleteWithCoordinates("Rua Augusta");

      expect(result).toBeNull();
    });

    it("returns null when place details fetch fails", async () => {
      mockFetchResponse(makeAutocompleteResponse());
      mockFetchResponse(null, false, 500);

      const result =
        await googlePlacesService.autocompleteWithCoordinates("Rua Augusta");

      expect(result).toBeNull();
    });
  });
});
