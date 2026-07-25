/**
 * Tests for useRouteDirections pure utility functions
 *
 * Tests only the exported pure/async functions:
 * - generateCacheKey
 * - loadFromCache
 * - saveToCache
 * - CACHE_PREFIX, CACHE_TTL constants
 *
 * Does NOT test the hook itself (causes OOM with renderHook).
 */

jest.mock('@/lib/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

// Must mock osrm to prevent import errors (hook file imports it)
jest.mock('@/lib/osrm', () => ({
  getRoute: jest.fn(),
  decodePolyline: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';

import { logger } from '@/lib/logger';
import { decodePolyline } from '@/lib/osrm';

import {
  CACHE_PREFIX,
  CACHE_TTL,
  generateCacheKey,
  isValidRouteCoordinates,
  decodeValidPolyline,
  loadFromCache,
  saveToCache,
  type Parada,
  type CachedRoute,
} from '../useRouteDirections';

describe('useRouteDirections utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
  });

  // ─── Constants ────────────────────────────────────────────────

  describe('CACHE_PREFIX', () => {
    it('should be "route_cache_"', () => {
      expect(CACHE_PREFIX).toBe('route_cache_');
    });
  });

  describe('CACHE_TTL', () => {
    it('should be 24 hours in milliseconds', () => {
      const twentyFourHoursMs = 24 * 60 * 60 * 1000;
      expect(CACHE_TTL).toBe(twentyFourHoursMs);
      expect(CACHE_TTL).toBe(86_400_000);
    });
  });

  describe('road geometry validation', () => {
    it('accepts a route with at least two valid coordinates', () => {
      expect(
        isValidRouteCoordinates([
          { latitude: -7.1153, longitude: -34.8813 },
          { latitude: -7.1202, longitude: -34.8641 },
        ]),
      ).toBe(true);
    });

    it('rejects a single point so it cannot be rendered as a route', () => {
      expect(
        isValidRouteCoordinates([{ latitude: -7.1153, longitude: -34.8813 }]),
      ).toBe(false);
    });

    it('rejects out-of-range coordinates', () => {
      expect(
        isValidRouteCoordinates([
          { latitude: -7.1153, longitude: -34.8813 },
          { latitude: 95, longitude: -34.8641 },
        ]),
      ).toBe(false);
    });

    it('decodes a persisted polyline through the shared OSRM decoder', () => {
      const coordinates = [
        { latitude: -7.1153, longitude: -34.8813 },
        { latitude: -7.1202, longitude: -34.8641 },
      ];
      (decodePolyline as jest.Mock).mockReturnValueOnce(coordinates);

      expect(decodeValidPolyline('encoded-road-geometry')).toEqual(coordinates);
      expect(decodePolyline).toHaveBeenCalledWith('encoded-road-geometry');
    });

    it('does not accept an empty/fallback polyline', () => {
      expect(decodeValidPolyline('')).toBeNull();
      expect(decodePolyline).not.toHaveBeenCalled();
    });
  });

  // ─── generateCacheKey ─────────────────────────────────────────

  describe('generateCacheKey', () => {
    it('should generate key with CACHE_PREFIX', () => {
      const paradas: Parada[] = [
        { id: '1', latitude: -23.55052, longitude: -46.63331, ordem: 1 },
      ];

      const key = generateCacheKey(paradas);

      expect(key.startsWith(CACHE_PREFIX)).toBe(true);
    });

    it('should sort paradas by ordem before generating key', () => {
      const paradasUnordered: Parada[] = [
        { id: '2', latitude: -22.9068, longitude: -43.1729, ordem: 2 },
        { id: '1', latitude: -23.55052, longitude: -46.63331, ordem: 1 },
      ];

      const paradasOrdered: Parada[] = [
        { id: '1', latitude: -23.55052, longitude: -46.63331, ordem: 1 },
        { id: '2', latitude: -22.9068, longitude: -43.1729, ordem: 2 },
      ];

      const keyUnordered = generateCacheKey(paradasUnordered);
      const keyOrdered = generateCacheKey(paradasOrdered);

      expect(keyUnordered).toBe(keyOrdered);
    });

    it('should produce the same key for same paradas in different array order', () => {
      const paradasA: Parada[] = [
        { id: '3', latitude: -15.7801, longitude: -47.9292, ordem: 3 },
        { id: '1', latitude: -23.55052, longitude: -46.63331, ordem: 1 },
        { id: '2', latitude: -22.9068, longitude: -43.1729, ordem: 2 },
      ];

      const paradasB: Parada[] = [
        { id: '1', latitude: -23.55052, longitude: -46.63331, ordem: 1 },
        { id: '2', latitude: -22.9068, longitude: -43.1729, ordem: 2 },
        { id: '3', latitude: -15.7801, longitude: -47.9292, ordem: 3 },
      ];

      expect(generateCacheKey(paradasA)).toBe(generateCacheKey(paradasB));
    });

    it('should filter out paradas with null latitude', () => {
      const paradas: Parada[] = [
        { id: '1', latitude: -23.55052, longitude: -46.63331, ordem: 1 },
        { id: '2', latitude: null, longitude: -43.1729, ordem: 2 },
      ];

      const key = generateCacheKey(paradas);

      expect(key).toBe(`${CACHE_PREFIX}-23.55052,-46.63331`);
    });

    it('should filter out paradas with null longitude', () => {
      const paradas: Parada[] = [
        { id: '1', latitude: -23.55052, longitude: null, ordem: 1 },
        { id: '2', latitude: -22.9068, longitude: -43.1729, ordem: 2 },
      ];

      const key = generateCacheKey(paradas);

      expect(key).toBe(`${CACHE_PREFIX}-22.90680,-43.17290`);
    });

    it('should filter out paradas with both null coordinates', () => {
      const paradas: Parada[] = [
        { id: '1', latitude: null, longitude: null, ordem: 1 },
        { id: '2', latitude: -22.9068, longitude: -43.1729, ordem: 2 },
      ];

      const key = generateCacheKey(paradas);

      expect(key).toBe(`${CACHE_PREFIX}-22.90680,-43.17290`);
    });

    it('should format coordinates to 5 decimal places', () => {
      const paradas: Parada[] = [
        {
          id: '1',
          latitude: -23.5505199999,
          longitude: -46.6333100001,
          ordem: 1,
        },
      ];

      const key = generateCacheKey(paradas);

      expect(key).toBe(`${CACHE_PREFIX}-23.55052,-46.63331`);
    });

    it('should join multiple paradas with pipe separator', () => {
      const paradas: Parada[] = [
        { id: '1', latitude: -23.55052, longitude: -46.63331, ordem: 1 },
        { id: '2', latitude: -22.9068, longitude: -43.1729, ordem: 2 },
      ];

      const key = generateCacheKey(paradas);

      expect(key).toBe(
        `${CACHE_PREFIX}-23.55052,-46.63331|-22.90680,-43.17290`,
      );
    });

    it('should produce minimal key when all paradas have null coordinates', () => {
      const paradas: Parada[] = [
        { id: '1', latitude: null, longitude: null, ordem: 1 },
        { id: '2', latitude: null, longitude: null, ordem: 2 },
      ];

      const key = generateCacheKey(paradas);

      expect(key).toBe(CACHE_PREFIX);
    });

    it('should produce minimal key for empty paradas array', () => {
      const key = generateCacheKey([]);

      expect(key).toBe(CACHE_PREFIX);
    });
  });

  // ─── loadFromCache ────────────────────────────────────────────

  describe('loadFromCache', () => {
    const makeCachedData = (timestamp: number): CachedRoute => ({
      coordinates: [
        { latitude: -23.55052, longitude: -46.63331 },
        { latitude: -22.9068, longitude: -43.1729 },
      ],
      routeInfo: {
        distanceMeters: 358000,
        durationSeconds: 18000,
      },
      timestamp,
    });

    it('should return null when key does not exist in AsyncStorage', async () => {
      const result = await loadFromCache('route_cache_nonexistent');

      expect(result).toBeNull();
      expect(AsyncStorage.getItem).toHaveBeenCalledWith(
        'route_cache_nonexistent',
      );
    });

    it('should return cached data when valid and within TTL', async () => {
      const now = 1700000000000;
      const freshData = makeCachedData(now - 1000); // 1 second ago

      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(freshData),
      );
      jest.spyOn(Date, 'now').mockReturnValue(now);

      const result = await loadFromCache('route_cache_valid');

      expect(result).not.toBeNull();
      expect(result!.coordinates).toEqual(freshData.coordinates);
      expect(result!.routeInfo).toEqual(freshData.routeInfo);
      expect(result!.timestamp).toBe(freshData.timestamp);
      expect(AsyncStorage.removeItem).not.toHaveBeenCalled();

      jest.restoreAllMocks();
    });

    it('should return null and remove item when cache is expired (TTL exceeded)', async () => {
      const now = 1700000000000;
      const expiredData = makeCachedData(now - CACHE_TTL - 1); // 1ms past TTL

      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(expiredData),
      );
      jest.spyOn(Date, 'now').mockReturnValue(now);

      const result = await loadFromCache('route_cache_expired');

      expect(result).toBeNull();
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
        'route_cache_expired',
      );

      jest.restoreAllMocks();
    });

    it('should return data when exactly at TTL boundary (not expired)', async () => {
      const now = 1700000000000;
      const boundaryData = makeCachedData(now - CACHE_TTL); // Exactly at TTL

      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(boundaryData),
      );
      jest.spyOn(Date, 'now').mockReturnValue(now);

      const result = await loadFromCache('route_cache_boundary');

      // Date.now() - timestamp === CACHE_TTL, which is NOT > CACHE_TTL, so still valid
      expect(result).not.toBeNull();
      expect(result!.timestamp).toBe(boundaryData.timestamp);
      expect(AsyncStorage.removeItem).not.toHaveBeenCalled();

      jest.restoreAllMocks();
    });

    it('should return null on JSON parse error and log warning', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        'not-valid-json{{{',
      );

      const result = await loadFromCache('route_cache_bad_json');

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        '[useRouteDirections] Erro ao carregar cache:',
        expect.any(Error),
      );
    });

    it('should return null when AsyncStorage.getItem throws', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(
        new Error('Storage read failed'),
      );

      const result = await loadFromCache('route_cache_error');

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        '[useRouteDirections] Erro ao carregar cache:',
        expect.any(Error),
      );
    });

    it('should return null for cache stored 25 hours ago', async () => {
      const now = 1700000000000;
      const oldData = makeCachedData(now - 25 * 60 * 60 * 1000); // 25 hours ago

      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(oldData),
      );
      jest.spyOn(Date, 'now').mockReturnValue(now);

      const result = await loadFromCache('route_cache_25h');

      expect(result).toBeNull();
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('route_cache_25h');

      jest.restoreAllMocks();
    });
  });

  // ─── saveToCache ──────────────────────────────────────────────

  describe('saveToCache', () => {
    const coordinates = [
      { latitude: -23.55052, longitude: -46.63331 },
      { latitude: -22.9068, longitude: -43.1729 },
    ];

    const routeInfo = {
      distanceMeters: 358000,
      durationSeconds: 18000,
    };

    it('should save data with current timestamp to AsyncStorage', async () => {
      const now = 1700000000000;
      jest.spyOn(Date, 'now').mockReturnValue(now);

      await saveToCache('route_cache_save_ts', coordinates, routeInfo);

      expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);

      const [key, value] = (AsyncStorage.setItem as jest.Mock).mock.calls[0];
      expect(key).toBe('route_cache_save_ts');

      const parsed: CachedRoute = JSON.parse(value);
      expect(parsed.coordinates).toEqual(coordinates);
      expect(parsed.routeInfo).toEqual(routeInfo);
      expect(parsed.timestamp).toBe(now);

      jest.restoreAllMocks();
    });

    it('should save JSON serializable data', async () => {
      await saveToCache('route_cache_save_json', coordinates, routeInfo);

      expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);

      const [, value] = (AsyncStorage.setItem as jest.Mock).mock.calls[0];
      const parsed = JSON.parse(value);

      expect(parsed).toHaveProperty('coordinates');
      expect(parsed).toHaveProperty('routeInfo');
      expect(parsed).toHaveProperty('timestamp');
      expect(typeof parsed.timestamp).toBe('number');
    });

    it('should handle AsyncStorage error gracefully without throwing', async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
        new Error('Storage write failed'),
      );

      await expect(
        saveToCache('route_cache_save_err', coordinates, routeInfo),
      ).resolves.toBeUndefined();

      expect(logger.warn).toHaveBeenCalledWith(
        '[useRouteDirections] Erro ao salvar cache:',
        expect.any(Error),
      );
    });

    it('should call setItem with the correct key', async () => {
      const key = 'route_cache_custom_key_123';

      await saveToCache(key, coordinates, routeInfo);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        key,
        expect.any(String),
      );
    });
  });

  // ─── Integration: save then load ─────────────────────────────

  describe('saveToCache + loadFromCache integration', () => {
    it('should round-trip data correctly when getItem returns what setItem saved', async () => {
      const now = 1700000000000;
      jest.spyOn(Date, 'now').mockReturnValue(now);

      const coordinates = [
        { latitude: -23.55052, longitude: -46.63331 },
        { latitude: -22.9068, longitude: -43.1729 },
      ];
      const routeInfo = { distanceMeters: 358000, durationSeconds: 18000 };

      await saveToCache('route_cache_roundtrip', coordinates, routeInfo);

      // Simulate getItem returning what was passed to setItem
      const savedValue = (AsyncStorage.setItem as jest.Mock).mock.calls[0][1];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(savedValue);

      const loaded = await loadFromCache('route_cache_roundtrip');

      expect(loaded).not.toBeNull();
      expect(loaded!.coordinates).toEqual(coordinates);
      expect(loaded!.routeInfo).toEqual(routeInfo);
      expect(loaded!.timestamp).toBe(now);

      jest.restoreAllMocks();
    });
  });
});
