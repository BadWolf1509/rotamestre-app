/**
 * Tests for useSwipeHint.ts
 * Hook para gerenciar exibição inteligente do swipe hint
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderHook, act, waitFor } from '@testing-library/react-native';

import { useSwipeHint, resetSwipeHint } from '../useSwipeHint';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

describe('useSwipeHint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  });

  describe('Initial state', () => {
    it('should start with loading true', () => {
      const { result } = renderHook(() => useSwipeHint());

      expect(result.current.isLoading).toBe(true);
    });

    it('should load stored swipe count', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('3');

      const { result } = renderHook(() => useSwipeHint());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.swipeCount).toBe(3);
      });
    });

    it('should default to 0 when no stored value', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const { result } = renderHook(() => useSwipeHint());

      await waitFor(() => {
        expect(result.current.swipeCount).toBe(0);
      });
    });
  });

  describe('Hint visibility logic', () => {
    it('should show full hint when swipeCount < 5', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('2');

      const { result } = renderHook(() => useSwipeHint());

      await waitFor(() => {
        expect(result.current.showFullHint).toBe(true);
        expect(result.current.showIconOnly).toBe(false);
        expect(result.current.hideCompletely).toBe(false);
      });
    });

    it('should show icon only when swipeCount >= 5 and < 10', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('7');

      const { result } = renderHook(() => useSwipeHint());

      await waitFor(() => {
        expect(result.current.showFullHint).toBe(false);
        expect(result.current.showIconOnly).toBe(true);
        expect(result.current.hideCompletely).toBe(false);
      });
    });

    it('should hide completely when swipeCount >= 10', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('12');

      const { result } = renderHook(() => useSwipeHint());

      await waitFor(() => {
        expect(result.current.showFullHint).toBe(false);
        expect(result.current.showIconOnly).toBe(false);
        expect(result.current.hideCompletely).toBe(true);
      });
    });

    it('should show full hint at boundary (swipeCount = 4)', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('4');

      const { result } = renderHook(() => useSwipeHint());

      await waitFor(() => {
        expect(result.current.showFullHint).toBe(true);
        expect(result.current.showIconOnly).toBe(false);
      });
    });

    it('should show icon only at boundary (swipeCount = 5)', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('5');

      const { result } = renderHook(() => useSwipeHint());

      await waitFor(() => {
        expect(result.current.showFullHint).toBe(false);
        expect(result.current.showIconOnly).toBe(true);
      });
    });
  });

  describe('incrementSwipeCount', () => {
    it('should increment swipe count and save to storage', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('2');

      const { result } = renderHook(() => useSwipeHint());

      await waitFor(() => {
        expect(result.current.swipeCount).toBe(2);
      });

      await act(async () => {
        await result.current.incrementSwipeCount();
      });

      expect(result.current.swipeCount).toBe(3);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@rotamestre:swipe_count',
        '3'
      );
    });

    it('should increment from 0', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const { result } = renderHook(() => useSwipeHint());

      await waitFor(() => {
        expect(result.current.swipeCount).toBe(0);
      });

      await act(async () => {
        await result.current.incrementSwipeCount();
      });

      expect(result.current.swipeCount).toBe(1);
    });

    it('should handle storage error gracefully', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('5');
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const { result } = renderHook(() => useSwipeHint());

      await waitFor(() => {
        expect(result.current.swipeCount).toBe(5);
      });

      await act(async () => {
        await result.current.incrementSwipeCount();
      });

      // Count should still update locally even if storage fails
      expect(result.current.swipeCount).toBe(6);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('Error handling', () => {
    it('should handle getItem error gracefully', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Read error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const { result } = renderHook(() => useSwipeHint());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        // Should default to 0 on error
        expect(result.current.swipeCount).toBe(0);
      });

      consoleSpy.mockRestore();
    });
  });
});

describe('resetSwipeHint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
  });

  it('should remove swipe count from storage', async () => {
    await resetSwipeHint();

    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@rotamestre:swipe_count');
  });

  it('should handle error gracefully', async () => {
    (AsyncStorage.removeItem as jest.Mock).mockRejectedValue(new Error('Remove error'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    await resetSwipeHint();

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
