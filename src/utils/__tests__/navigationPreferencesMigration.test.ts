/**
 * Tests for navigationPreferencesMigration
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  multiRemove: jest.fn(),
}));

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock locationTrackingService
const mockUpdateNavigationPreferences = jest.fn();
jest.mock('@/services/locationTracking', () => ({
  __esModule: true,
  default: {
    updateNavigationPreferences: (...args: unknown[]) =>
      mockUpdateNavigationPreferences(...args),
  },
}));

import { logger } from '@/lib/logger';

import {
  migrateNavigationPreferences,
  resetMigrationState,
} from '../navigationPreferencesMigration';

describe('navigationPreferencesMigration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.multiRemove as jest.Mock).mockResolvedValue(undefined);
    mockUpdateNavigationPreferences.mockResolvedValue(undefined);
  });

  describe('migrateNavigationPreferences', () => {
    it('should skip migration if already completed', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('true');

      const result = await migrateNavigationPreferences();

      expect(result).toBe(false);
      expect(logger.info).toHaveBeenCalledWith(
        '[NavigationMigration] Migração já executada anteriormente',
      );
      expect(mockUpdateNavigationPreferences).not.toHaveBeenCalled();
    });

    it('should migrate nav app preference', async () => {
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(null) // migration flag
        .mockResolvedValueOnce('waze'); // nav app preference

      const result = await migrateNavigationPreferences();

      expect(result).toBe(true);
      expect(mockUpdateNavigationPreferences).toHaveBeenCalledWith({
        preferredNavApp: 'waze',
      });
    });

    it('should migrate google_maps preference', async () => {
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('google_maps');

      const result = await migrateNavigationPreferences();

      expect(result).toBe(true);
      expect(mockUpdateNavigationPreferences).toHaveBeenCalledWith({
        preferredNavApp: 'google_maps',
      });
    });

    it('should migrate apple_maps preference', async () => {
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('apple_maps');

      const result = await migrateNavigationPreferences();

      expect(result).toBe(true);
      expect(mockUpdateNavigationPreferences).toHaveBeenCalledWith({
        preferredNavApp: 'apple_maps',
      });
    });

    it('should migrate default preference', async () => {
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('default');

      const result = await migrateNavigationPreferences();

      expect(result).toBe(true);
      expect(mockUpdateNavigationPreferences).toHaveBeenCalledWith({
        preferredNavApp: 'default',
      });
    });

    it('should ignore the legacy sound key (option removed)', async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementation(
        async (key: string) =>
          key === '@rotamestre:sound_enabled'
            ? 'true'
            : key === '@rotamestre:nav_app_preference'
              ? 'waze'
              : null,
      );

      const result = await migrateNavigationPreferences();

      expect(result).toBe(true);
      expect(mockUpdateNavigationPreferences).toHaveBeenCalledWith({
        preferredNavApp: 'waze',
      });
    });

    it('should not update preferences when only the legacy sound key exists', async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementation(
        async (key: string) =>
          key === '@rotamestre:sound_enabled' ? 'false' : null,
      );

      await migrateNavigationPreferences();

      expect(mockUpdateNavigationPreferences).not.toHaveBeenCalled();
    });

    it('should remove legacy keys after migration', async () => {
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('waze');

      await migrateNavigationPreferences();

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
        '@rotamestre:nav_app_preference',
      );
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
        '@rotamestre:sound_enabled',
      );
    });

    it('should mark migration as completed', async () => {
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('waze');

      await migrateNavigationPreferences();

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@rotamestre:nav_prefs_migration_v1',
        'true',
      );
    });

    it('should not update preferences if nothing to migrate', async () => {
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(null) // migration flag
        .mockResolvedValueOnce(null); // nav app preference; // sound enabled

      const result = await migrateNavigationPreferences();

      expect(result).toBe(true);
      expect(mockUpdateNavigationPreferences).not.toHaveBeenCalled();
      // Should still mark migration as completed
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@rotamestre:nav_prefs_migration_v1',
        'true',
      );
    });

    it('should skip unknown nav app values', async () => {
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('unknown_app');

      const result = await migrateNavigationPreferences();

      expect(result).toBe(true);
      expect(mockUpdateNavigationPreferences).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(
        new Error('Storage error'),
      );

      const result = await migrateNavigationPreferences();

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        '[NavigationMigration] Erro durante migração:',
        expect.any(Error),
      );
    });
  });

  describe('resetMigrationState', () => {
    it('should remove migration completed flag', async () => {
      await resetMigrationState();

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
        '@rotamestre:nav_prefs_migration_v1',
      );
      expect(logger.info).toHaveBeenCalledWith(
        '[NavigationMigration] Estado de migração resetado',
      );
    });
  });
});
