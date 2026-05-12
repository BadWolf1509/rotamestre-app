/**
 * Tests for google.ts branches that require mocking the osrm module.
 *
 * These cover lines 239, 266-268, 301, 328-330:
 *   - failure() returned when getOptimizedDirections returns null
 *   - catch block when getOptimizedDirections throws
 *
 * Kept in a separate file so the osrm jest.mock doesn't interfere with
 * the fetch-based tests in google.test.ts / google.web.test.ts.
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
