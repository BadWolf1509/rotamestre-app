/**
 * @jest-environment jsdom
 */

/**
 * Tests for useDialogState, useDialogBackdropHandler, useWebDialog hooks
 *
 * Mocks: Platform.OS, DOM APIs (HTMLDialogElement, window, document.body)
 */
import { renderHook } from '@testing-library/react-native';
import { Platform } from 'react-native';

import {
  useDialogState,
  useDialogBackdropHandler,
  useWebDialog,
} from '../useDialogState';

// Store original Platform.OS
const originalPlatformOS = Platform.OS;

// Mock dialog element
function createMockDialog() {
  const listeners: Record<string, Function[]> = {};
  return {
    open: false,
    showModal: jest.fn(function (this: any) { this.open = true; }),
    close: jest.fn(function (this: any) { this.open = false; }),
    addEventListener: jest.fn((event: string, handler: Function) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
    }),
    removeEventListener: jest.fn((event: string, handler: Function) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter((h) => h !== handler);
      }
    }),
    // Helper to fire events in tests
    _fireEvent: (event: string, eventObj?: any) => {
      listeners[event]?.forEach((h) => h(eventObj || {}));
    },
    _listeners: listeners,
  };
}

describe('useDialogState', () => {
  let mockBodyStyle: Record<string, string>;
  let mockScrollTo: jest.Mock;
  let mockScrollY: number;

  beforeEach(() => {
    // Set Platform to web
    Object.defineProperty(Platform, 'OS', { value: 'web', writable: true });

    // Mock document.body.style
    mockBodyStyle = { overflow: '', position: '', top: '', width: '' };
    Object.defineProperty(document.body, 'style', {
      value: mockBodyStyle,
      writable: true,
      configurable: true,
    });

    // Mock window.scrollY
    mockScrollY = 100;
    Object.defineProperty(window, 'scrollY', {
      value: mockScrollY,
      writable: true,
      configurable: true,
    });

    // Mock window.scrollTo
    mockScrollTo = jest.fn();
    window.scrollTo = mockScrollTo;
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalPlatformOS, writable: true });
  });

  it('calls showModal when visible is true and dialog is closed', () => {
    const dialog = createMockDialog();
    const dialogRef = { current: dialog as any };

    renderHook(() => useDialogState(true, dialogRef));

    expect(dialog.showModal).toHaveBeenCalledTimes(1);
  });

  it('does not call showModal when dialog is already open', () => {
    const dialog = createMockDialog();
    dialog.open = true;
    const dialogRef = { current: dialog as any };

    renderHook(() => useDialogState(true, dialogRef));

    expect(dialog.showModal).not.toHaveBeenCalled();
  });

  it('locks body scroll when opening', () => {
    const dialog = createMockDialog();
    const dialogRef = { current: dialog as any };

    renderHook(() => useDialogState(true, dialogRef));

    expect(mockBodyStyle.overflow).toBe('hidden');
    expect(mockBodyStyle.position).toBe('fixed');
    expect(mockBodyStyle.width).toBe('100%');
    expect(mockBodyStyle.top).toBe('-100px');
  });

  it('calls close when visible becomes false and dialog is open', () => {
    const dialog = createMockDialog();
    dialog.open = true;
    const dialogRef = { current: dialog as any };

    renderHook(() => useDialogState(false, dialogRef));

    expect(dialog.close).toHaveBeenCalledTimes(1);
  });

  it('does not call close when dialog is already closed', () => {
    const dialog = createMockDialog();
    dialog.open = false;
    const dialogRef = { current: dialog as any };

    renderHook(() => useDialogState(false, dialogRef));

    expect(dialog.close).not.toHaveBeenCalled();
  });

  it('restores body scroll when closing', () => {
    const dialog = createMockDialog();
    dialog.open = true;
    const dialogRef = { current: dialog as any };

    renderHook(() => useDialogState(false, dialogRef));

    expect(mockBodyStyle.overflow).toBe('');
    expect(mockBodyStyle.position).toBe('');
    expect(mockBodyStyle.top).toBe('');
    expect(mockBodyStyle.width).toBe('');
  });

  it('restores scroll position when closing', () => {
    const dialog = createMockDialog();
    const dialogRef = { current: dialog as any };

    // First open to save scroll position
    const { rerender } = renderHook(
      ({ visible }) => useDialogState(visible, dialogRef),
      { initialProps: { visible: true } },
    );

    // Then close
    dialog.open = true; // simulate open state
    rerender({ visible: false });

    expect(mockScrollTo).toHaveBeenCalledWith(0, expect.any(Number));
  });

  it('cleans up body styles on unmount', () => {
    const dialog = createMockDialog();
    const dialogRef = { current: dialog as any };

    const { unmount } = renderHook(() => useDialogState(true, dialogRef));

    // Set styles
    expect(mockBodyStyle.overflow).toBe('hidden');

    unmount();

    expect(mockBodyStyle.overflow).toBe('');
    expect(mockBodyStyle.position).toBe('');
    expect(mockBodyStyle.top).toBe('');
    expect(mockBodyStyle.width).toBe('');
  });

  it('does nothing on non-web platforms', () => {
    Object.defineProperty(Platform, 'OS', { value: 'android', writable: true });

    const dialog = createMockDialog();
    const dialogRef = { current: dialog as any };

    renderHook(() => useDialogState(true, dialogRef));

    expect(dialog.showModal).not.toHaveBeenCalled();
  });

  it('does nothing when dialogRef.current is null', () => {
    const dialogRef = { current: null };

    // Should not throw
    expect(() => {
      renderHook(() => useDialogState(true, dialogRef));
    }).not.toThrow();
  });
});

describe('useDialogBackdropHandler', () => {
  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { value: 'web', writable: true });
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalPlatformOS, writable: true });
  });

  it('adds cancel and click event listeners', () => {
    const dialog = createMockDialog();
    const dialogRef = { current: dialog as any };
    const onClose = jest.fn();

    renderHook(() => useDialogBackdropHandler(dialogRef, onClose));

    expect(dialog.addEventListener).toHaveBeenCalledWith('cancel', expect.any(Function));
    expect(dialog.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
  });

  it('calls onClose when ESC key pressed (cancel event)', () => {
    const dialog = createMockDialog();
    const dialogRef = { current: dialog as any };
    const onClose = jest.fn();

    renderHook(() => useDialogBackdropHandler(dialogRef, onClose));

    const cancelEvent = { preventDefault: jest.fn() };
    dialog._fireEvent('cancel', cancelEvent);

    expect(cancelEvent.preventDefault).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop is clicked', () => {
    const dialog = createMockDialog();
    const dialogRef = { current: dialog as any };
    const onClose = jest.fn();

    renderHook(() => useDialogBackdropHandler(dialogRef, onClose));

    // Click target is the dialog itself (backdrop)
    dialog._fireEvent('click', { target: dialog });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when inner content is clicked', () => {
    const dialog = createMockDialog();
    const dialogRef = { current: dialog as any };
    const onClose = jest.fn();

    renderHook(() => useDialogBackdropHandler(dialogRef, onClose));

    // Click target is an inner element, not the dialog itself
    dialog._fireEvent('click', { target: document.createElement('div') });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not close on backdrop click when closeOnBackdrop is false', () => {
    const dialog = createMockDialog();
    const dialogRef = { current: dialog as any };
    const onClose = jest.fn();

    renderHook(() => useDialogBackdropHandler(dialogRef, onClose, false));

    dialog._fireEvent('click', { target: dialog });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('still handles ESC even when closeOnBackdrop is false', () => {
    const dialog = createMockDialog();
    const dialogRef = { current: dialog as any };
    const onClose = jest.fn();

    renderHook(() => useDialogBackdropHandler(dialogRef, onClose, false));

    dialog._fireEvent('cancel', { preventDefault: jest.fn() });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('removes event listeners on unmount', () => {
    const dialog = createMockDialog();
    const dialogRef = { current: dialog as any };
    const onClose = jest.fn();

    const { unmount } = renderHook(() => useDialogBackdropHandler(dialogRef, onClose));

    unmount();

    expect(dialog.removeEventListener).toHaveBeenCalledWith('cancel', expect.any(Function));
    expect(dialog.removeEventListener).toHaveBeenCalledWith('click', expect.any(Function));
  });

  it('does nothing on non-web platforms', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', writable: true });

    const dialog = createMockDialog();
    const dialogRef = { current: dialog as any };
    const onClose = jest.fn();

    renderHook(() => useDialogBackdropHandler(dialogRef, onClose));

    expect(dialog.addEventListener).not.toHaveBeenCalled();
  });

  it('does nothing when dialogRef.current is null', () => {
    const dialogRef = { current: null };
    const onClose = jest.fn();

    expect(() => {
      renderHook(() => useDialogBackdropHandler(dialogRef, onClose));
    }).not.toThrow();
  });
});

describe('useWebDialog', () => {
  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { value: 'web', writable: true });

    Object.defineProperty(document.body, 'style', {
      value: { overflow: '', position: '', top: '', width: '' },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true });
    window.scrollTo = jest.fn();
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalPlatformOS, writable: true });
  });

  it('combines dialog state and backdrop handling', () => {
    const dialog = createMockDialog();
    const dialogRef = { current: dialog as any };
    const onClose = jest.fn();

    renderHook(() => useWebDialog(true, dialogRef, onClose));

    // Dialog opened
    expect(dialog.showModal).toHaveBeenCalled();
    // Listeners registered
    expect(dialog.addEventListener).toHaveBeenCalledWith('cancel', expect.any(Function));
    expect(dialog.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
  });

  it('respects closeOnBackdrop option', () => {
    const dialog = createMockDialog();
    const dialogRef = { current: dialog as any };
    const onClose = jest.fn();

    renderHook(() => useWebDialog(true, dialogRef, onClose, { closeOnBackdrop: false }));

    dialog._fireEvent('click', { target: dialog });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('defaults closeOnBackdrop to true', () => {
    const dialog = createMockDialog();
    const dialogRef = { current: dialog as any };
    const onClose = jest.fn();

    renderHook(() => useWebDialog(true, dialogRef, onClose));

    dialog._fireEvent('click', { target: dialog });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
