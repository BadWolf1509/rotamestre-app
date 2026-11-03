/**
 * Tests for google.ts branches that require mocking the osrm module.
 *
 * These cover lines 239, 266-268, 301, 328-330:
 *   - failure() returned when getOptimizedDirections returns null
 *   - catch block when getOptimizedDirections throws
 *
 * Kept in a separate file so the osrm jest.mock doesn't interfere with
 * the fetch-based tests in google.test.ts / google.fallback-haversine.test.ts.
 */

// Mock the entire osrm module so we can control getOptimizedDirections
jest.mock('../osrm', () => ({
  getOptimizedDirections: jest.fn(),
  clearCache: jest.fn(),
}));

import { googleMapsService } from '../google';
import { getOptimizedDirections } from '../osrm';

const mockGetOptimizedDirections = getOptimizedDirections as jest.Mock;

describe('googleMapsService - osrm null/throw paths', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getDirectionsWithError', () => {
    it('deve retornar failure quando osrm retorna null (line 239)', async () => {
      mockGetOptimizedDirections.mockResolvedValueOnce(null);

      const result = await googleMapsService.getDirectionsWithError(
        { latitude: 0, longitude: 0 },
        { latitude: 1, longitude: 1 },
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('deve retornar failure quando osrm lança exceção (lines 266-268)', async () => {
      mockGetOptimizedDirections.mockRejectedValueOnce(
        new Error('OSRM service unavailable'),
      );

      const result = await googleMapsService.getDirectionsWithError(
        { latitude: 0, longitude: 0 },
        { latitude: 1, longitude: 1 },
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('par sem rota (G9)', () => {
    it('repassa o aviso de que nenhuma ordem resolve', async () => {
      mockGetOptimizedDirections.mockResolvedValueOnce({
        polyline: '',
        distancia_total_metros: 1000,
        duracao_total_segundos: 100,
        ordem_otimizada: [0],
        legs: [],
        sem_rota_entre_paradas: true,
      });

      const result = await googleMapsService.getDirectionsWithError(
        { latitude: 0, longitude: 0 },
        { latitude: 0, longitude: 0 },
        [{ latitude: 1, longitude: 1 }],
      );

      expect(result.data?.sem_rota_entre_paradas).toBe(true);
    });
  });

  describe('conversão do resultado do OSRM', () => {
    const a = { latitude: 0, longitude: 0 };
    const b = { latitude: 1, longitude: 1 };
    const c = { latitude: 0.5, longitude: 0.5 };
    const base = {
      polyline: 'abc',
      distancia_total_metros: 1000,
      duracao_total_segundos: 100,
      ordem_otimizada: [0],
      legs: [],
    };

    it('getDirectionsSequentialWithError repassa is_estimated e sem_rota_entre_paradas', async () => {
      mockGetOptimizedDirections.mockResolvedValueOnce({
        ...base,
        is_estimated: true,
        sem_rota_entre_paradas: true,
      });

      const r = await googleMapsService.getDirectionsSequentialWithError(a, b, [
        c,
      ]);

      expect(r.data).toMatchObject({
        is_estimated: true,
        sem_rota_entre_paradas: true,
        ordem_otimizada: [],
      });
    });

    it.each([
      'getDirectionsWithError',
      'getDirectionsSequentialWithError',
    ] as const)(
      '%s: sem o aviso do OSRM, o resultado não ganha sem_rota_entre_paradas',
      async (metodo) => {
        mockGetOptimizedDirections.mockResolvedValueOnce({ ...base });

        const r = await googleMapsService[metodo](a, b, [c]);

        expect(r.data?.is_estimated).toBe(false);
        expect(r.data).not.toHaveProperty('sem_rota_entre_paradas');
      },
    );
  });

  describe('getDirections (wrapper)', () => {
    it('deve retornar null quando osrm retorna null', async () => {
      mockGetOptimizedDirections.mockResolvedValueOnce(null);

      const result = await googleMapsService.getDirections(
        { latitude: 0, longitude: 0 },
        { latitude: 1, longitude: 1 },
      );

      expect(result).toBeNull();
    });

    it('deve retornar null quando osrm lança exceção', async () => {
      mockGetOptimizedDirections.mockRejectedValueOnce(
        new Error('Network error'),
      );

      const result = await googleMapsService.getDirections(
        { latitude: 0, longitude: 0 },
        { latitude: 1, longitude: 1 },
      );

      expect(result).toBeNull();
    });
  });

  describe('getDirectionsSequentialWithError', () => {
    it('deve retornar failure quando osrm retorna null (line 301)', async () => {
      mockGetOptimizedDirections.mockResolvedValueOnce(null);

      const result = await googleMapsService.getDirectionsSequentialWithError(
        { latitude: 0, longitude: 0 },
        { latitude: 1, longitude: 1 },
        [{ latitude: 0.5, longitude: 0.5 }],
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('deve retornar failure quando osrm lança exceção (lines 328-330)', async () => {
      mockGetOptimizedDirections.mockRejectedValueOnce(
        new Error('Sequential route failed'),
      );

      const result = await googleMapsService.getDirectionsSequentialWithError(
        { latitude: 0, longitude: 0 },
        { latitude: 1, longitude: 1 },
        [],
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('getDirectionsSequential (wrapper)', () => {
    it('deve retornar null quando osrm retorna null', async () => {
      mockGetOptimizedDirections.mockResolvedValueOnce(null);

      const result = await googleMapsService.getDirectionsSequential(
        { latitude: 0, longitude: 0 },
        { latitude: 1, longitude: 1 },
        [],
      );

      expect(result).toBeNull();
    });

    it('deve retornar null quando osrm lança exceção', async () => {
      mockGetOptimizedDirections.mockRejectedValueOnce(new Error('OSRM error'));

      const result = await googleMapsService.getDirectionsSequential(
        { latitude: 0, longitude: 0 },
        { latitude: 1, longitude: 1 },
        [],
      );

      expect(result).toBeNull();
    });
  });
});
