/**
 * Tests for Photon Geocoding Service
 * Critical service for address autocomplete and geocoding (replaced Google)
 */

import { photonService } from '../photon';

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

// Mock cache to avoid interference between tests
jest.mock('@/lib/cache', () => ({
  CACHE_TTL: {
    AUTOCOMPLETE: 5 * 60 * 1000,
    GEOCODING: 30 * 60 * 1000,
  },
  getCache: jest.fn().mockResolvedValue(null), // Always return null (no cache hit)
  setCache: jest.fn().mockResolvedValue(undefined),
}));

describe('Photon Geocoding Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('autocompleteAddress', () => {
    it('should return empty array for input shorter than 3 characters', async () => {
      const result = await photonService.autocompleteAddress('Ru');
      expect(result).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return suggestions for valid input', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [-34.85, -7.12], // [lon, lat]
              },
              properties: {
                osm_id: 12345,
                osm_type: 'N',
                name: 'Supermercado Teste',
                street: 'Rua das Flores',
                housenumber: '100',
                district: 'Centro',
                city: 'João Pessoa',
                state: 'Paraíba',
                country: 'Brazil',
                countrycode: 'BR',
              },
            },
          ],
        }),
      });

      const result = await photonService.autocompleteAddress('Rua das Flores');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        place_id: 'osm_N12345',
        description: expect.stringContaining('Rua das Flores'),
        structured_formatting: {
          main_text: 'Supermercado Teste',
          secondary_text: expect.stringContaining('João Pessoa'),
        },
        coordinates: {
          latitude: -7.12,
          longitude: -34.85,
        },
      });
    });

    it('should filter out non-Brazilian results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [-43.17, -22.91] },
              properties: {
                osm_id: 1,
                osm_type: 'N',
                street: 'Rua Brasil',
                city: 'Rio de Janeiro',
                countrycode: 'BR',
              },
            },
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [-3.70, 40.42] },
              properties: {
                osm_id: 2,
                osm_type: 'N',
                street: 'Calle Brasil',
                city: 'Madrid',
                countrycode: 'ES',
              },
            },
          ],
        }),
      });

      const result = await photonService.autocompleteAddress('Brasil');

      expect(result).toHaveLength(1);
      expect(result[0].coordinates.latitude).toBe(-22.91);
    });

    it('should include location bias parameters when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ type: 'FeatureCollection', features: [] }),
      });

      await photonService.autocompleteAddress('Rua Teste', {
        latitude: -7.12,
        longitude: -34.85,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('lat=-7.12'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('lon=-34.85'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('zoom=10'),
        expect.any(Object)
      );
    });

    it('should remove house number from query for better results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ type: 'FeatureCollection', features: [] }),
      });

      await photonService.autocompleteAddress('Rua das Flores, 123');

      // Should call API without the number
      const calledUrl = mockFetch.mock.calls[0][0] as string;
      const decodedUrl = decodeURIComponent(calledUrl);
      expect(decodedUrl).not.toContain('123');
    });

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await photonService.autocompleteAddress('Rua Teste');

      expect(result).toEqual([]);
    });

    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await photonService.autocompleteAddress('Rua Teste');

      expect(result).toEqual([]);
    });

    it('should handle timeout (AbortError)', async () => {
      const abortError = new Error('Request aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(abortError);

      const result = await photonService.autocompleteAddress('Rua Teste');

      expect(result).toEqual([]);
    });
  });

  describe('geocodeAddress', () => {
    it('should return null for empty input', async () => {
      const result = await photonService.geocodeAddress('');
      expect(result).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return null for input shorter than 3 characters', async () => {
      const result = await photonService.geocodeAddress('Ru');
      expect(result).toBeNull();
    });

    it('should return geocoded address for valid input', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [-34.85, -7.12],
              },
              properties: {
                osm_id: 12345,
                osm_type: 'W',
                street: 'Rua das Palmeiras',
                housenumber: '50',
                district: 'Manaíra',
                city: 'João Pessoa',
                state: 'Paraíba',
                postcode: '58038-000',
                countrycode: 'BR',
              },
            },
          ],
        }),
      });

      const result = await photonService.geocodeAddress('Rua das Palmeiras, 50, João Pessoa');

      expect(result).toEqual({
        logradouro: 'Rua das Palmeiras',
        numero: '50',
        bairro: 'Manaíra',
        cidade: 'João Pessoa',
        estado: 'Paraíba',
        cep: '58038-000',
        coordenadas: {
          latitude: -7.12,
          longitude: -34.85,
        },
        formatted_address: expect.stringContaining('Rua das Palmeiras'),
      });
    });

    it('should return null when no Brazilian results found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [0, 0] },
              properties: {
                osm_id: 1,
                osm_type: 'N',
                countrycode: 'US',
              },
            },
          ],
        }),
      });

      const result = await photonService.geocodeAddress('123 Main Street');

      expect(result).toBeNull();
    });

    it('should return null when no results found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          type: 'FeatureCollection',
          features: [],
        }),
      });

      const result = await photonService.geocodeAddress('Endereço Inexistente XYZ');

      expect(result).toBeNull();
    });
  });

  describe('reverseGeocode', () => {
    it('should return address string for valid coordinates', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [-34.85, -7.12] },
              properties: {
                osm_id: 12345,
                osm_type: 'N',
                street: 'Avenida Epitácio Pessoa',
                housenumber: '1000',
                district: 'Tambaú',
                city: 'João Pessoa',
                state: 'Paraíba',
                countrycode: 'BR',
              },
            },
          ],
        }),
      });

      const result = await photonService.reverseGeocode({
        latitude: -7.12,
        longitude: -34.85,
      });

      expect(result).toContain('Avenida Epitácio Pessoa');
      expect(result).toContain('João Pessoa');
    });

    it('should return null when no results found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          type: 'FeatureCollection',
          features: [],
        }),
      });

      const result = await photonService.reverseGeocode({
        latitude: 0,
        longitude: 0,
      });

      expect(result).toBeNull();
    });

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
      });

      const result = await photonService.reverseGeocode({
        latitude: -7.12,
        longitude: -34.85,
      });

      expect(result).toBeNull();
    });
  });

  describe('getCoordinates', () => {
    it('should return coordinates for valid address', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [-34.85, -7.12] },
              properties: {
                osm_id: 1,
                osm_type: 'N',
                countrycode: 'BR',
              },
            },
          ],
        }),
      });

      const result = await photonService.getCoordinates('Centro, João Pessoa');

      expect(result).toEqual({
        latitude: -7.12,
        longitude: -34.85,
      });
    });

    it('should return null when geocoding fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          type: 'FeatureCollection',
          features: [],
        }),
      });

      const result = await photonService.getCoordinates('Endereço Inexistente');

      expect(result).toBeNull();
    });
  });

  describe('getPlaceDetails', () => {
    it('should return null (not supported by Photon)', async () => {
      const result = await photonService.getPlaceDetails('osm_N12345');

      expect(result).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('reverseGeocodeDetailed', () => {
    it('should return detailed address for valid coordinates', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [-34.85, -7.12] },
              properties: {
                osm_id: 12345,
                osm_type: 'W',
                street: 'Rua Teste',
                housenumber: '123',
                district: 'Centro',
                city: 'João Pessoa',
                state: 'Paraíba',
                postcode: '58000-000',
                countrycode: 'BR',
              },
            },
          ],
        }),
      });

      const result = await photonService.reverseGeocodeDetailed({
        latitude: -7.12,
        longitude: -34.85,
      });

      expect(result).toEqual({
        logradouro: 'Rua Teste',
        numero: '123',
        bairro: 'Centro',
        cidade: 'João Pessoa',
        estado: 'Paraíba',
        cep: '58000-000',
        coordenadas: {
          latitude: -7.12,
          longitude: -34.85,
        },
        formatted_address: expect.any(String),
      });
    });

    it('should return null when API returns error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await photonService.reverseGeocodeDetailed({
        latitude: -7.12,
        longitude: -34.85,
      });

      expect(result).toBeNull();
    });

    it('should return null when no features found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          type: 'FeatureCollection',
          features: [],
        }),
      });

      const result = await photonService.reverseGeocodeDetailed({
        latitude: 0,
        longitude: 0,
      });

      expect(result).toBeNull();
    });
  });

  describe('Address formatting', () => {
    it('should format address with establishment name', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [-34.85, -7.12] },
              properties: {
                osm_id: 1,
                osm_type: 'N',
                osm_key: 'shop',
                name: 'Padaria Central',
                street: 'Rua Principal',
                housenumber: '100',
                district: 'Centro',
                city: 'João Pessoa',
                state: 'Paraíba',
                countrycode: 'BR',
              },
            },
          ],
        }),
      });

      const result = await photonService.autocompleteAddress('Padaria Central');

      expect(result[0].structured_formatting.main_text).toBe('Padaria Central');
      expect(result[0].description).toContain('Padaria Central');
    });

    it('should format street without establishment name', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [-34.85, -7.12] },
              properties: {
                osm_id: 1,
                osm_type: 'W',
                osm_key: 'highway',
                name: 'Avenida Brasil',
                city: 'João Pessoa',
                state: 'Paraíba',
                countrycode: 'BR',
              },
            },
          ],
        }),
      });

      const result = await photonService.autocompleteAddress('Avenida Brasil');

      expect(result[0].structured_formatting.main_text).toBe('Avenida Brasil');
    });

    it('should handle missing optional fields gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [-34.85, -7.12] },
              properties: {
                osm_id: 1,
                osm_type: 'N',
                city: 'João Pessoa',
                countrycode: 'BR',
              },
            },
          ],
        }),
      });

      const result = await photonService.autocompleteAddress('João Pessoa');

      expect(result[0]).toBeDefined();
      expect(result[0].coordinates).toEqual({
        latitude: -7.12,
        longitude: -34.85,
      });
    });
  });
});
