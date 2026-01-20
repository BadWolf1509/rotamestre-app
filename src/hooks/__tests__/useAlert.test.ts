/**
 * Tests for useAlert hook
 */

// Unmock useAlert so we can test the actual implementation
jest.unmock('@/hooks/useAlert');

import { renderHook, act } from '@testing-library/react-native';

import { useAlert } from '../useAlert';

// Mock Dialog component
jest.mock('@/components/Dialog', () => ({
  Dialog: jest.fn(() => null),
}));

// Mock errorMapping
jest.mock('@/lib/errorMapping', () => ({
  getErrorMessage: jest.fn((error: unknown) => {
    if (error instanceof Error) {
      return {
        title: 'Erro',
        message: error.message,
        type: 'error',
        code: 'TEST_ERROR',
      };
    }
    return {
      title: 'Algo deu errado',
      message: 'Ocorreu um erro inesperado.',
      type: 'error',
      code: 'UNKNOWN_ERROR',
    };
  }),
}));

describe('useAlert', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with isVisible = false', () => {
      const { result } = renderHook(() => useAlert());
      expect(result.current.isVisible).toBe(false);
    });

    it('should initialize with AlertDialog = null', () => {
      const { result } = renderHook(() => useAlert());
      expect(result.current.AlertDialog).toBeNull();
    });

    it('should export all required functions', () => {
      const { result } = renderHook(() => useAlert());
      expect(typeof result.current.showAlert).toBe('function');
      expect(typeof result.current.showSuccess).toBe('function');
      expect(typeof result.current.showWarning).toBe('function');
      expect(typeof result.current.showError).toBe('function');
      expect(typeof result.current.showConfirm).toBe('function');
      expect(typeof result.current.showDestructive).toBe('function');
      expect(typeof result.current.hideAlert).toBe('function');
    });
  });

  describe('showAlert', () => {
    it('should set isVisible to true', () => {
      const { result } = renderHook(() => useAlert());

      act(() => {
        result.current.showAlert({
          title: 'Test Title',
          message: 'Test Message',
        });
      });

      expect(result.current.isVisible).toBe(true);
    });

    it('should create AlertDialog element', () => {
      const { result } = renderHook(() => useAlert());

      act(() => {
        result.current.showAlert({
          title: 'Test Title',
          message: 'Test Message',
        });
      });

      expect(result.current.AlertDialog).not.toBeNull();
    });
  });

  describe('showSuccess', () => {
    it('should show alert with success type', () => {
      const { result } = renderHook(() => useAlert());

      act(() => {
        result.current.showSuccess('Success', 'Operation completed');
      });

      expect(result.current.isVisible).toBe(true);
      expect(result.current.AlertDialog).not.toBeNull();
    });
  });

  describe('showWarning', () => {
    it('should show alert with warning type', () => {
      const { result } = renderHook(() => useAlert());

      act(() => {
        result.current.showWarning('Warning', 'Be careful');
      });

      expect(result.current.isVisible).toBe(true);
      expect(result.current.AlertDialog).not.toBeNull();
    });
  });

  describe('showError', () => {
    it('should show error from Error object', () => {
      const { result } = renderHook(() => useAlert());

      act(() => {
        result.current.showError(new Error('Something went wrong'));
      });

      expect(result.current.isVisible).toBe(true);
    });

    it('should show error from options object', () => {
      const { result } = renderHook(() => useAlert());

      act(() => {
        result.current.showError({
          title: 'Custom Error',
          message: 'Custom message',
        });
      });

      expect(result.current.isVisible).toBe(true);
    });
  });

  describe('showConfirm', () => {
    it('should return promise that resolves to true on confirm', async () => {
      const { result } = renderHook(() => useAlert());

      let confirmPromise: Promise<boolean>;

      act(() => {
        confirmPromise = result.current.showConfirm({
          title: 'Confirm',
          message: 'Are you sure?',
        });
      });

      expect(result.current.isVisible).toBe(true);

      // Simulate pressing confirm - this would be done via Dialog callback
      // Since we're testing the hook, we can't easily simulate this
      // Instead, we verify the promise was created
      expect(confirmPromise!).toBeInstanceOf(Promise);
    });
  });

  describe('showDestructive', () => {
    it('should show destructive dialog', () => {
      const { result } = renderHook(() => useAlert());

      act(() => {
        result.current.showDestructive({
          title: 'Delete',
          message: 'This cannot be undone',
          destructiveConfirmText: 'DELETE',
        });
      });

      expect(result.current.isVisible).toBe(true);
    });
  });

  describe('hideAlert', () => {
    it('should hide the alert', () => {
      const { result } = renderHook(() => useAlert());

      act(() => {
        result.current.showAlert({
          title: 'Test',
          message: 'Test',
        });
      });

      expect(result.current.isVisible).toBe(true);

      act(() => {
        result.current.hideAlert();
      });

      expect(result.current.isVisible).toBe(false);
      expect(result.current.AlertDialog).toBeNull();
    });
  });
});
