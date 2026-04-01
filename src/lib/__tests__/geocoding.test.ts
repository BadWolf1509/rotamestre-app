/**
 * Tests for geocoding.ts
 * Unified geocoding service combining ViaCEP (CEP) + Google Places (text) + Photon (coords)
 */

import type { GooglePlaceSuggestion } from "@/lib/googlePlaces";
import type { ViaCEPPlaceSuggestion } from "@/lib/viacep";
import type { Coordenadas, EnderecoGeocodificado } from "@/types/endereco";

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

// Mock viacepService
const mockViacepSearchByCEP = jest.fn();
const mockViacepContainsCEP = jest.fn();
const mockViacepExtractCEP = jest.fn();
const mockViacepExtractNumberFromCEPInput = jest.fn();

jest.mock("@/lib/viacep", () => ({
  viacepService: {
    searchByCEP: (...args: unknown[]) => mockViacepSearchByCEP(...args),
    containsCEP: (...args: unknown[]) => mockViacepContainsCEP(...args),
    extractCEP: (...args: unknown[]) => mockViacepExtractCEP(...args),
    extractNumberFromCEPInput: (...args: unknown[]) =>
      mockViacepExtractNumberFromCEPInput(...args),
    isCEP: jest.fn(),
    formatCEP: jest.fn(),
  },
}));

// Mock googlePlacesService
const mockGoogleIsAvailable = jest.fn();
const mockGoogleAutocompleteAddress = jest.fn();
const mockGoogleGetPlaceDetails = jest.fn();
const mockGoogleAutocompleteWithCoordinates = jest.fn();

jest.mock("@/lib/googlePlaces", () => ({
  googlePlacesService: {
    isAvailable: (...args: unknown[]) => mockGoogleIsAvailable(...args),
    autocompleteAddress: (...args: unknown[]) =>
      mockGoogleAutocompleteAddress(...args),
    getPlaceDetails: (...args: unknown[]) => mockGoogleGetPlaceDetails(...args),
    autocompleteWithCoordinates: (...args: unknown[]) =>
      mockGoogleAutocompleteWithCoordinates(...args),
  },
}));

// Mock photonService
const mockPhotonGetCoordinates = jest.fn();
const mockPhotonReverseGeocode = jest.fn();

jest.mock("@/lib/photon", () => ({
  photonService: {
    getCoordinates: (...args: unknown[]) => mockPhotonGetCoordinates(...args),
    reverseGeocode: (...args: unknown[]) => mockPhotonReverseGeocode(...args),
  },
}));

// Import after mocks are set up
import { geocodingService } from "../geocoding";

// ============================================================================
// TEST DATA
// ============================================================================

const mockViaCEPSuggestion: ViaCEPPlaceSuggestion = {
  place_id: "cep_58068504",
  description: "Rua Exemplo, Bairro Teste, João Pessoa, PB",
  structured_formatting: {
    main_text: "Rua Exemplo",
    secondary_text: "Bairro Teste, João Pessoa, PB",
  },
  cep: "58068-504",
};

const mockGoogleSuggestion: GooglePlaceSuggestion = {
  place_id: "ChIJxyz123",
  description: "Rua Antonio Leite, 100, Centro, São Paulo, SP",
  structured_formatting: {
    main_text: "Rua Antonio Leite, 100",
    secondary_text: "Centro, São Paulo, SP",
  },
  source: "google",
};

const mockGoogleSuggestionWithCoords: GooglePlaceSuggestion = {
  ...mockGoogleSuggestion,
  coordinates: { latitude: -23.5505, longitude: -46.6333 },
};

const mockCoords: Coordenadas = { latitude: -7.115, longitude: -34.861 };

const mockEnderecoGeocodificado: EnderecoGeocodificado = {
  logradouro: "Rua Antonio Leite",
  numero: "100",
  bairro: "Centro",
  cidade: "São Paulo",
  estado: "SP",
  cep: "01001-000",
  coordenadas: { latitude: -23.5505, longitude: -46.6333 },
  formatted_address: "Rua Antonio Leite, 100, Centro, São Paulo, SP",
};

// ============================================================================
// TESTS
// ============================================================================

describe("geocodingService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    geocodingService.resetStats();
    // Restore default config
    geocodingService.configure({ enableCEPDetection: true });
  });

  // --------------------------------------------------------------------------
  // autocomplete
  // --------------------------------------------------------------------------

  describe("autocomplete", () => {
    it("should return empty array for empty input", async () => {
      const result = await geocodingService.autocomplete("");
      expect(result).toEqual([]);
      expect(mockViacepContainsCEP).not.toHaveBeenCalled();
      expect(mockGoogleAutocompleteAddress).not.toHaveBeenCalled();
    });

    it("should return empty array for input shorter than 3 characters", async () => {
      const result = await geocodingService.autocomplete("Ru");
      expect(result).toEqual([]);
    });

    it("should route CEP input to ViaCEP service", async () => {
      mockViacepContainsCEP.mockReturnValue(true);
      mockViacepExtractCEP.mockReturnValue("58068504");
      mockViacepExtractNumberFromCEPInput.mockReturnValue(null);
      mockViacepSearchByCEP.mockResolvedValue(mockViaCEPSuggestion);

      const result = await geocodingService.autocomplete("58068-504");

      expect(mockViacepContainsCEP).toHaveBeenCalledWith("58068-504");
      expect(mockViacepExtractCEP).toHaveBeenCalledWith("58068-504");
      expect(mockViacepSearchByCEP).toHaveBeenCalledWith("58068504");
      expect(result).toHaveLength(1);
      expect(result[0].source).toBe("viacep");
      expect(result[0].cep).toBe("58068-504");
      expect(result[0].needsCoordinates).toBe(true);
    });

    it("should extract and include house number from CEP input", async () => {
      mockViacepContainsCEP.mockReturnValue(true);
      mockViacepExtractCEP.mockReturnValue("58068504");
      mockViacepExtractNumberFromCEPInput.mockReturnValue("100");
      mockViacepSearchByCEP.mockResolvedValue(mockViaCEPSuggestion);

      const result = await geocodingService.autocomplete("58068-504, 100");

      expect(result).toHaveLength(1);
      // Description should include the number
      expect(result[0].description).toContain("100");
      // place_id should include number suffix
      expect(result[0].place_id).toContain("_100");
    });

    it("should fall through to Google when CEP is not found", async () => {
      mockViacepContainsCEP.mockReturnValue(true);
      mockViacepExtractCEP.mockReturnValue("00000000");
      mockViacepSearchByCEP.mockResolvedValue(null);
      mockGoogleIsAvailable.mockReturnValue(true);
      mockGoogleAutocompleteAddress.mockResolvedValue([mockGoogleSuggestion]);

      const result = await geocodingService.autocomplete("00000-000");

      expect(mockViacepSearchByCEP).toHaveBeenCalledWith("00000000");
      expect(mockGoogleAutocompleteAddress).toHaveBeenCalledWith(
        "00000-000",
        undefined,
        undefined,
      );
      expect(result).toHaveLength(1);
      expect(result[0].source).toBe("google");
    });

    it("should route text input to Google Places", async () => {
      mockViacepContainsCEP.mockReturnValue(false);
      mockGoogleIsAvailable.mockReturnValue(true);
      mockGoogleAutocompleteAddress.mockResolvedValue([mockGoogleSuggestion]);

      const result = await geocodingService.autocomplete("Rua Antonio Leite");

      expect(mockViacepContainsCEP).toHaveBeenCalledWith("Rua Antonio Leite");
      expect(mockGoogleAutocompleteAddress).toHaveBeenCalledWith(
        "Rua Antonio Leite",
        undefined,
        undefined,
      );
      expect(result).toHaveLength(1);
      expect(result[0].source).toBe("google");
      expect(result[0].place_id).toBe("ChIJxyz123");
    });

    it("should return empty array when Google Places is not available", async () => {
      mockViacepContainsCEP.mockReturnValue(false);
      mockGoogleIsAvailable.mockReturnValue(false);

      const result = await geocodingService.autocomplete("Rua Antonio Leite");

      expect(result).toEqual([]);
      expect(mockGoogleAutocompleteAddress).not.toHaveBeenCalled();
    });

    it("should set needsCoordinates to true for Google results without coords", async () => {
      mockViacepContainsCEP.mockReturnValue(false);
      mockGoogleIsAvailable.mockReturnValue(true);
      mockGoogleAutocompleteAddress.mockResolvedValue([mockGoogleSuggestion]);

      const result = await geocodingService.autocomplete("Rua Antonio Leite");

      expect(result[0].needsCoordinates).toBe(true);
    });

    it("should set needsCoordinates to false for Google results with coords", async () => {
      mockViacepContainsCEP.mockReturnValue(false);
      mockGoogleIsAvailable.mockReturnValue(true);
      mockGoogleAutocompleteAddress.mockResolvedValue([
        mockGoogleSuggestionWithCoords,
      ]);

      const result = await geocodingService.autocomplete("Rua Antonio Leite");

      expect(result[0].needsCoordinates).toBe(false);
      expect(result[0].coordinates).toEqual({
        latitude: -23.5505,
        longitude: -46.6333,
      });
    });

    it("should skip CEP detection when enableCEPDetection is false", async () => {
      geocodingService.configure({ enableCEPDetection: false });
      mockGoogleIsAvailable.mockReturnValue(true);
      mockGoogleAutocompleteAddress.mockResolvedValue([]);

      await geocodingService.autocomplete("58068-504");

      expect(mockViacepContainsCEP).not.toHaveBeenCalled();
      expect(mockGoogleAutocompleteAddress).toHaveBeenCalledWith(
        "58068-504",
        undefined,
        undefined,
      );
    });
  });

  // --------------------------------------------------------------------------
  // getCoordinates
  // --------------------------------------------------------------------------

  describe("getCoordinates", () => {
    it("should return existing coordinates without external calls", async () => {
      const suggestion = {
        place_id: "test",
        description: "Test",
        structured_formatting: { main_text: "Test", secondary_text: "" },
        source: "google" as const,
        coordinates: mockCoords,
      };

      const result = await geocodingService.getCoordinates(suggestion);

      expect(result).toEqual(mockCoords);
      expect(mockGoogleGetPlaceDetails).not.toHaveBeenCalled();
      expect(mockPhotonGetCoordinates).not.toHaveBeenCalled();
    });

    it("should fetch coordinates via Google Place Details for google source", async () => {
      const suggestion = {
        place_id: "ChIJxyz123",
        description: "Rua Teste",
        structured_formatting: { main_text: "Rua Teste", secondary_text: "" },
        source: "google" as const,
        needsCoordinates: true,
      };

      mockGoogleGetPlaceDetails.mockResolvedValue(mockEnderecoGeocodificado);

      const result = await geocodingService.getCoordinates(suggestion);

      expect(mockGoogleGetPlaceDetails).toHaveBeenCalledWith("ChIJxyz123");
      expect(result).toEqual(mockEnderecoGeocodificado.coordenadas);
    });

    it("should return null when Google Place Details returns no coordinates", async () => {
      const suggestion = {
        place_id: "ChIJxyz123",
        description: "Rua Teste",
        structured_formatting: { main_text: "Rua Teste", secondary_text: "" },
        source: "google" as const,
        needsCoordinates: true,
      };

      mockGoogleGetPlaceDetails.mockResolvedValue(null);

      const result = await geocodingService.getCoordinates(suggestion);

      expect(result).toBeNull();
    });

    it("should fetch coordinates via Photon for viacep source", async () => {
      const suggestion = {
        place_id: "cep_58068504",
        description: "Rua Exemplo, Bairro Teste, João Pessoa, PB",
        structured_formatting: { main_text: "Rua Exemplo", secondary_text: "" },
        source: "viacep" as const,
        cep: "58068-504",
        needsCoordinates: true,
      };

      mockPhotonGetCoordinates.mockResolvedValue(mockCoords);

      const result = await geocodingService.getCoordinates(suggestion);

      expect(mockPhotonGetCoordinates).toHaveBeenCalledWith(
        suggestion.description,
      );
      expect(result).toEqual(mockCoords);
    });
  });

  // --------------------------------------------------------------------------
  // autocompleteWithCoordinates
  // --------------------------------------------------------------------------

  describe("autocompleteWithCoordinates", () => {
    it("should return null when no suggestions found", async () => {
      mockViacepContainsCEP.mockReturnValue(false);
      mockGoogleIsAvailable.mockReturnValue(true);
      mockGoogleAutocompleteAddress.mockResolvedValue([]);

      const result =
        await geocodingService.autocompleteWithCoordinates("Unknown Place XYZ");

      expect(result).toBeNull();
    });

    it("should return suggestion directly if it already has coordinates", async () => {
      mockViacepContainsCEP.mockReturnValue(false);
      mockGoogleIsAvailable.mockReturnValue(true);
      mockGoogleAutocompleteAddress.mockResolvedValue([
        mockGoogleSuggestionWithCoords,
      ]);

      const result =
        await geocodingService.autocompleteWithCoordinates("Rua Antonio Leite");

      expect(result).not.toBeNull();
      expect(result!.coordinates).toEqual({
        latitude: -23.5505,
        longitude: -46.6333,
      });
      // Should NOT call getPlaceDetails since coords already exist
      expect(mockGoogleGetPlaceDetails).not.toHaveBeenCalled();
    });

    it("should resolve coordinates for suggestion without them", async () => {
      mockViacepContainsCEP.mockReturnValue(false);
      mockGoogleIsAvailable.mockReturnValue(true);
      mockGoogleAutocompleteAddress.mockResolvedValue([mockGoogleSuggestion]);
      mockGoogleGetPlaceDetails.mockResolvedValue(mockEnderecoGeocodificado);

      const result =
        await geocodingService.autocompleteWithCoordinates("Rua Antonio Leite");

      expect(result).not.toBeNull();
      expect(result!.coordinates).toEqual(
        mockEnderecoGeocodificado.coordenadas,
      );
      expect(result!.needsCoordinates).toBe(false);
    });

    it("should return null when coordinates cannot be resolved", async () => {
      mockViacepContainsCEP.mockReturnValue(false);
      mockGoogleIsAvailable.mockReturnValue(true);
      mockGoogleAutocompleteAddress.mockResolvedValue([mockGoogleSuggestion]);
      mockGoogleGetPlaceDetails.mockResolvedValue(null);

      const result =
        await geocodingService.autocompleteWithCoordinates("Rua Antonio Leite");

      expect(result).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // geocode
  // --------------------------------------------------------------------------

  describe("geocode", () => {
    it("should return null when Google Places is not available", async () => {
      mockGoogleIsAvailable.mockReturnValue(false);

      const result = await geocodingService.geocode("Rua Teste, 100, SP");

      expect(result).toBeNull();
      expect(mockGoogleAutocompleteWithCoordinates).not.toHaveBeenCalled();
    });

    it("should return geocoded address from Google", async () => {
      mockGoogleIsAvailable.mockReturnValue(true);
      mockGoogleAutocompleteWithCoordinates.mockResolvedValue({
        ...mockGoogleSuggestion,
        coordinates: { latitude: -23.5505, longitude: -46.6333 },
      });

      const result = await geocodingService.geocode(
        "Rua Antonio Leite, 100, SP",
      );

      expect(result).not.toBeNull();
      expect(result!.coordenadas).toEqual({
        latitude: -23.5505,
        longitude: -46.6333,
      });
      expect(result!.formatted_address).toBe(mockGoogleSuggestion.description);
    });

    it("should return null when Google returns no result", async () => {
      mockGoogleIsAvailable.mockReturnValue(true);
      mockGoogleAutocompleteWithCoordinates.mockResolvedValue(null);

      const result = await geocodingService.geocode("Invalid Address");

      expect(result).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // reverseGeocode
  // --------------------------------------------------------------------------

  describe("reverseGeocode", () => {
    it("should delegate to photonService", async () => {
      mockPhotonReverseGeocode.mockResolvedValue(
        "Rua Teste, Centro, João Pessoa, PB",
      );

      const result = await geocodingService.reverseGeocode(mockCoords);

      expect(mockPhotonReverseGeocode).toHaveBeenCalledWith(mockCoords);
      expect(result).toBe("Rua Teste, Centro, João Pessoa, PB");
    });

    it("should return null when photon returns null", async () => {
      mockPhotonReverseGeocode.mockResolvedValue(null);

      const result = await geocodingService.reverseGeocode(mockCoords);

      expect(result).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // stats & configuration
  // --------------------------------------------------------------------------

  describe("stats and configuration", () => {
    it("should increment viacepCalls when CEP is detected", async () => {
      mockViacepContainsCEP.mockReturnValue(true);
      mockViacepExtractCEP.mockReturnValue("58068504");
      mockViacepExtractNumberFromCEPInput.mockReturnValue(null);
      mockViacepSearchByCEP.mockResolvedValue(mockViaCEPSuggestion);

      await geocodingService.autocomplete("58068-504");

      const stats = geocodingService.getStats();
      expect(stats.viacepCalls).toBe(1);
      expect(stats.googleCalls).toBe(0);
    });

    it("should increment googleCalls when text search is used", async () => {
      mockViacepContainsCEP.mockReturnValue(false);
      mockGoogleIsAvailable.mockReturnValue(true);
      mockGoogleAutocompleteAddress.mockResolvedValue([]);

      await geocodingService.autocomplete("Rua Teste");

      const stats = geocodingService.getStats();
      expect(stats.googleCalls).toBe(1);
      expect(stats.viacepCalls).toBe(0);
    });

    it("should reset stats correctly", async () => {
      mockViacepContainsCEP.mockReturnValue(false);
      mockGoogleIsAvailable.mockReturnValue(true);
      mockGoogleAutocompleteAddress.mockResolvedValue([]);

      await geocodingService.autocomplete("Rua Teste");
      expect(geocodingService.getStats().googleCalls).toBe(1);

      geocodingService.resetStats();

      const stats = geocodingService.getStats();
      expect(stats.googleCalls).toBe(0);
      expect(stats.viacepCalls).toBe(0);
    });

    it("should update configuration", () => {
      geocodingService.configure({ enableCEPDetection: false });

      const cfg = geocodingService.getConfig();
      expect(cfg.enableCEPDetection).toBe(false);
    });

    it("should report Google availability", () => {
      mockGoogleIsAvailable.mockReturnValue(true);
      expect(geocodingService.isGoogleAvailable()).toBe(true);

      mockGoogleIsAvailable.mockReturnValue(false);
      expect(geocodingService.isGoogleAvailable()).toBe(false);
    });
  });
});
