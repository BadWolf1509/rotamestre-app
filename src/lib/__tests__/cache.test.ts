/**
 * Tests for cache.ts
 * Sistema de Cache com TTL (Time To Live)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  getCache,
  setCache,
  clearCache,
  clearAllCache,
  cleanExpiredCache,
  getCacheWithFetch,
  invalidateRelatedCaches,
  CACHE_TTL,
  CACHE_KEYS,
} from '../cache';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  getAllKeys: jest.fn(),
  multiRemove: jest.fn(),
}));

describe('cache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([]);
    (AsyncStorage.multiRemove as jest.Mock).mockResolvedValue(undefined);
  });

  describe('CACHE_TTL constants', () => {
    it('should have correct TTL values', () => {
      expect(CACHE_TTL.USER_DATA).toBe(5 * 60 * 1000);
      expect(CACHE_TTL.DASHBOARD).toBe(2 * 60 * 1000);
      expect(CACHE_TTL.ROUTES_LIST).toBe(3 * 60 * 1000);
      expect(CACHE_TTL.MOTORISTAS).toBe(10 * 60 * 1000);
      expect(CACHE_TTL.STATIC_DATA).toBe(30 * 60 * 1000);
      expect(CACHE_TTL.SHORT).toBe(1 * 60 * 1000);
    });
  });

  describe('CACHE_KEYS', () => {
    it('should generate correct keys', () => {
      expect(CACHE_KEYS.USER_DATA('user-1')).toBe('user_user-1');
      expect(CACHE_KEYS.DASHBOARD('unidade-1')).toBe('dashboard_unidade-1');
      expect(CACHE_KEYS.ROTAS_LIST('unidade-1')).toBe('rotas_unidade-1');
      expect(CACHE_KEYS.MOTORISTAS('unidade-1')).toBe('motoristas_unidade-1');
      expect(CACHE_KEYS.INCIDENTES('unidade-1')).toBe('incidentes_unidade-1');
    });
  });

  describe('setCache', () => {
    it('should save data to AsyncStorage with prefix', async () => {
      await setCache('test-key', { value: 123 }, 60000);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@cache_test-key',
        expect.any(String)
      );
    });

    it('should save with correct structure', async () => {
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);

      await setCache('my-key', { data: 'test' }, 30000);

      const savedData = JSON.parse(
        (AsyncStorage.setItem as jest.Mock).mock.calls[0][1]
      );

      expect(savedData.data).toEqual({ data: 'test' });
      expect(savedData.timestamp).toBe(now);
      expect(savedData.ttl).toBe(30000);

      jest.restoreAllMocks();
    });

    it('should use default TTL when not specified', async () => {
      await setCache('default-ttl', { value: 1 });

      const savedData = JSON.parse(
        (AsyncStorage.setItem as jest.Mock).mock.calls[0][1]
      );

      expect(savedData.ttl).toBe(CACHE_TTL.USER_DATA);
    });

    it('should handle storage error gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error('Storage full'));

      await setCache('error-key', { value: 1 });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('getCache', () => {
    it('should return null when cache does not exist', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const result = await getCache('non-existent');

      expect(result).toBeNull();
    });

    it('should return data when cache is valid', async () => {
      const now = Date.now();
      const cacheEntry = {
        data: { value: 'cached' },
        timestamp: now - 1000, // 1 second ago
        ttl: 60000, // 1 minute TTL
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(cacheEntry));

      const result = await getCache('valid-cache');

      expect(result).toEqual({ value: 'cached' });
    });

    it('should return null and remove when cache is expired', async () => {
      const now = Date.now();
      const cacheEntry = {
        data: { value: 'old' },
        timestamp: now - 120000, // 2 minutes ago
        ttl: 60000, // 1 minute TTL (expired)
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(cacheEntry));

      const result = await getCache('expired-cache');

      expect(result).toBeNull();
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@cache_expired-cache');
    });

    it('should handle parse error gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('invalid json');

      const result = await getCache('invalid');

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('clearCache', () => {
    it('should remove specific cache key', async () => {
      await clearCache('to-remove');

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@cache_to-remove');
    });

    it('should handle error gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      (AsyncStorage.removeItem as jest.Mock).mockRejectedValue(new Error('Error'));

      await clearCache('error-key');

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('clearAllCache', () => {
    it('should remove all cache keys', async () => {
      (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([
        '@cache_key1',
        '@cache_key2',
        '@other_key', // Not a cache key
      ]);

      await clearAllCache();

      expect(AsyncStorage.multiRemove).toHaveBeenCalledWith([
        '@cache_key1',
        '@cache_key2',
      ]);
    });

    it('should not call multiRemove when no cache keys', async () => {
      (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue(['@other_key']);

      await clearAllCache();

      expect(AsyncStorage.multiRemove).not.toHaveBeenCalled();
    });
  });

  describe('cleanExpiredCache', () => {
    it('should remove only expired entries', async () => {
      const now = Date.now();

      (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([
        '@cache_valid',
        '@cache_expired',
      ]);

      // Valid entry
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(JSON.stringify({
          data: 'valid',
          timestamp: now - 1000,
          ttl: 60000,
        }))
        // Expired entry
        .mockResolvedValueOnce(JSON.stringify({
          data: 'expired',
          timestamp: now - 120000,
          ttl: 60000,
        }));

      await cleanExpiredCache();

      expect(AsyncStorage.multiRemove).toHaveBeenCalledWith(['@cache_expired']);
    });
  });

  describe('getCacheWithFetch', () => {
    it('should return cached data when available', async () => {
      const now = Date.now();
      const cacheEntry = {
        data: { cached: true },
        timestamp: now - 1000,
        ttl: 60000,
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(cacheEntry));

      const fetcher = jest.fn().mockResolvedValue({ fresh: true });

      const result = await getCacheWithFetch('cached-key', fetcher);

      expect(result.data).toEqual({ cached: true });
      expect(result.fromCache).toBe(true);
      expect(fetcher).not.toHaveBeenCalled();
    });

    it('should fetch data when cache miss', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const fetcher = jest.fn().mockResolvedValue({ fresh: true });

      const result = await getCacheWithFetch('miss-key', fetcher);

      expect(result.data).toEqual({ fresh: true });
      expect(result.fromCache).toBe(false);
      expect(fetcher).toHaveBeenCalled();
    });

    it('should force refresh when option is set', async () => {
      const now = Date.now();
      const cacheEntry = {
        data: { cached: true },
        timestamp: now - 1000,
        ttl: 60000,
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(cacheEntry));

      const fetcher = jest.fn().mockResolvedValue({ fresh: true });

      const result = await getCacheWithFetch('force-key', fetcher, { forceRefresh: true });

      expect(result.data).toEqual({ fresh: true });
      expect(result.fromCache).toBe(false);
      expect(fetcher).toHaveBeenCalled();
    });
  });

  describe('invalidateRelatedCaches', () => {
    it('should clear related caches for rotas', async () => {
      await invalidateRelatedCaches('rotas');

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@cache_dashboard');
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@cache_rotas_list');
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@cache_kpis');
    });

    it('should clear related caches for paradas', async () => {
      await invalidateRelatedCaches('paradas');

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@cache_dashboard');
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@cache_rotas_list');
    });

    it('should clear related caches for usuarios', async () => {
      await invalidateRelatedCaches('usuarios');

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@cache_user_data');
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@cache_motoristas');
    });

    it('should clear related caches for incidentes', async () => {
      await invalidateRelatedCaches('incidentes');

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@cache_dashboard');
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@cache_incidentes_list');
    });
  });
});
