/**
 * Tests for usePiPPosition hook
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderHook, act, waitFor } from '@testing-library/react-native';

import { usePiPPosition } from '../usePiPPosition';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('usePiPPosition', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockAsyncStorage.setItem.mockResolvedValue();
    mockAsyncStorage.removeItem.mockResolvedValue();
  });

  describe('initial state', () => {
    it('should start with isLoading true', () => {
      const { result } = renderHook(() => usePiPPosition());

      expect(result.current.isLoading).toBe(true);
    });

    it('should start with savedPosition undefined', () => {
      const { result } = renderHook(() => usePiPPosition());

      expect(result.current.savedPosition).toBeUndefined();
    });

    it('should set isLoading to false after loading', async () => {
      const { result } = renderHook(() => usePiPPosition());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe('loading saved position', () => {
    it('should load position from AsyncStorage', async () => {
      const savedPosition = { x: 100, y: 200 };
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(savedPosition));

      const { result } = renderHook(() => usePiPPosition());

      await waitFor(() => {
        expect(result.current.savedPosition).toEqual(savedPosition);
      });

      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith('@rotamestre:pip_position');
    });

    it('should keep savedPosition undefined when storage is empty', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const { result } = renderHook(() => usePiPPosition());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.savedPosition).toBeUndefined();
    });

    it('should handle AsyncStorage error gracefully', async () => {
      const { logger } = require('@/lib/logger');
      const loggerWarnSpy = jest.spyOn(logger, 'warn').mockImplementation();
      mockAsyncStorage.getItem.mockRejectedValue(new Error('Storage error'));

      const { result } = renderHook(() => usePiPPosition());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.savedPosition).toBeUndefined();
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        'usePiPPosition: Erro ao carregar posição:',
        expect.any(Error)
      );

      loggerWarnSpy.mockRestore();
    });

    it('should reject invalid position data (missing x)', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify({ y: 100 }));

      const { result } = renderHook(() => usePiPPosition());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.savedPosition).toBeUndefined();
    });

    it('should reject invalid position data (non-numeric x)', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify({ x: 'abc', y: 100 }));

      const { result } = renderHook(() => usePiPPosition());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.savedPosition).toBeUndefined();
    });

    it('should reject invalid JSON', async () => {
      const { logger } = require('@/lib/logger');
      const loggerWarnSpy = jest.spyOn(logger, 'warn').mockImplementation();
      mockAsyncStorage.getItem.mockResolvedValue('not valid json');

      const { result } = renderHook(() => usePiPPosition());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.savedPosition).toBeUndefined();
      expect(loggerWarnSpy).toHaveBeenCalled();

      loggerWarnSpy.mockRestore();
    });
  });

  describe('savePosition', () => {
    it('should save position to AsyncStorage', async () => {
      const { result } = renderHook(() => usePiPPosition());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const newPosition = { x: 50, y: 150 };

      await act(async () => {
        await result.current.savePosition(newPosition);
      });

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        '@rotamestre:pip_position',
        JSON.stringify(newPosition)
      );
      expect(result.current.savedPosition).toEqual(newPosition);
    });

    it('should handle save error gracefully', async () => {
      const { logger } = require('@/lib/logger');
      const loggerWarnSpy = jest.spyOn(logger, 'warn').mockImplementation();
      mockAsyncStorage.setItem.mockRejectedValue(new Error('Save error'));

      const { result } = renderHook(() => usePiPPosition());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.savePosition({ x: 50, y: 150 });
      });

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        'usePiPPosition: Erro ao salvar posição:',
        expect.any(Error)
      );

      loggerWarnSpy.mockRestore();
    });

    it('should update savedPosition state after successful save', async () => {
      const { result } = renderHook(() => usePiPPosition());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const position1 = { x: 10, y: 20 };
      const position2 = { x: 30, y: 40 };

      await act(async () => {
        await result.current.savePosition(position1);
      });

      expect(result.current.savedPosition).toEqual(position1);

      await act(async () => {
        await result.current.savePosition(position2);
      });

      expect(result.current.savedPosition).toEqual(position2);
    });
  });

  describe('clearPosition', () => {
    it('should remove position from AsyncStorage', async () => {
      const savedPosition = { x: 100, y: 200 };
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(savedPosition));

      const { result } = renderHook(() => usePiPPosition());

      await waitFor(() => {
        expect(result.current.savedPosition).toEqual(savedPosition);
      });

      await act(async () => {
        await result.current.clearPosition();
      });

      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('@rotamestre:pip_position');
      expect(result.current.savedPosition).toBeUndefined();
    });

    it('should handle clear error gracefully', async () => {
      const { logger } = require('@/lib/logger');
      const loggerWarnSpy = jest.spyOn(logger, 'warn').mockImplementation();
      mockAsyncStorage.removeItem.mockRejectedValue(new Error('Remove error'));

      const { result } = renderHook(() => usePiPPosition());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.clearPosition();
      });

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        'usePiPPosition: Erro ao limpar posição:',
        expect.any(Error)
      );

      loggerWarnSpy.mockRestore();
    });
  });

  describe('function stability', () => {
    it('should return stable savePosition function reference', async () => {
      const { result, rerender } = renderHook(() => usePiPPosition());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const firstSavePosition = result.current.savePosition;

      rerender({});

      expect(result.current.savePosition).toBe(firstSavePosition);
    });

    it('should return stable clearPosition function reference', async () => {
      const { result, rerender } = renderHook(() => usePiPPosition());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const firstClearPosition = result.current.clearPosition;

      rerender({});

      expect(result.current.clearPosition).toBe(firstClearPosition);
    });
  });

  describe('edge cases', () => {
    it('should handle zero coordinates', async () => {
      const savedPosition = { x: 0, y: 0 };
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(savedPosition));

      const { result } = renderHook(() => usePiPPosition());

      await waitFor(() => {
        expect(result.current.savedPosition).toEqual(savedPosition);
      });
    });

    it('should handle negative coordinates', async () => {
      // While unusual, negative coords might occur in some edge cases
      const savedPosition = { x: -10, y: -20 };
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(savedPosition));

      const { result } = renderHook(() => usePiPPosition());

      await waitFor(() => {
        expect(result.current.savedPosition).toEqual(savedPosition);
      });
    });

    it('should handle very large coordinates', async () => {
      const savedPosition = { x: 10000, y: 20000 };
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(savedPosition));

      const { result } = renderHook(() => usePiPPosition());

      await waitFor(() => {
        expect(result.current.savedPosition).toEqual(savedPosition);
      });
    });

    it('should handle float coordinates', async () => {
      const savedPosition = { x: 100.5, y: 200.75 };
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(savedPosition));

      const { result } = renderHook(() => usePiPPosition());

      await waitFor(() => {
        expect(result.current.savedPosition).toEqual(savedPosition);
      });
    });
  });
});
