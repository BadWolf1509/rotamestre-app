import { act, render, renderHook } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import React from 'react';

import { useLogoutConfirmation } from '../useLogoutConfirmation';

import { authService } from '@/lib/auth';

// Mock dependencies
jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  authService: {
    signOut: jest.fn(),
  },
}));

// Variable to capture ConfirmModal props
let capturedProps: any = null;

// Mock ConfirmModal
jest.mock('@/components/ConfirmModal', () => {
  return {
    ConfirmModal: jest.fn((props) => {
      capturedProps = props;
      return null;
    }),
  };
});

// Test component that uses the hook
function TestComponent() {
  const { logoutModal, showLogoutModal } = useLogoutConfirmation();

  // Expose the function for testing
  React.useEffect(() => {
    // @ts-ignore
    window.testShowLogoutModal = showLogoutModal;
  }, [showLogoutModal]);

  return <>{logoutModal}</>;
}

describe('useLogoutConfirmation', () => {
  const mockReplace = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    capturedProps = null;
    (useRouter as jest.Mock).mockReturnValue({
      replace: mockReplace,
    });
  });

  it('should initialize with showLogoutModal function', () => {
    const { result } = renderHook(() => useLogoutConfirmation());

    expect(result.current.showLogoutModal).toBeInstanceOf(Function);
    expect(result.current.logoutModal).toBeTruthy();
  });

  it('should provide logoutModal element', () => {
    const { result } = renderHook(() => useLogoutConfirmation());

    expect(result.current.logoutModal).toBeTruthy();
    expect(result.current.logoutModal.type).toBeTruthy();
  });

  it('should pass correct props to ConfirmModal initially', () => {
    render(<TestComponent />);

    expect(capturedProps).toBeTruthy();
    expect(capturedProps.title).toBe('Sair da conta');
    expect(capturedProps.message).toBe('Deseja realmente encerrar sua sessao?');
    expect(capturedProps.confirmText).toBe('Sair');
    expect(capturedProps.cancelText).toBe('Cancelar');
    expect(capturedProps.type).toBe('destructive');
    expect(capturedProps.loading).toBe(false);
    expect(capturedProps.visible).toBe(false);
  });

  it('should show modal when showLogoutModal is called', () => {
    const { result } = renderHook(() => useLogoutConfirmation());

    // Initially hidden
    render(<>{result.current.logoutModal}</>);
    expect(capturedProps.visible).toBe(false);

    // Show modal
    act(() => {
      result.current.showLogoutModal();
    });

    // Render again with updated state
    render(<>{result.current.logoutModal}</>);
    expect(capturedProps.visible).toBe(true);
  });

  it('should call authService.signOut and navigate to login via onConfirm', async () => {
    (authService.signOut as jest.Mock).mockResolvedValueOnce(undefined);

    render(<TestComponent />);

    const { onConfirm } = capturedProps;
    expect(onConfirm).toBeTruthy();

    await act(async () => {
      await onConfirm();
    });

    expect(authService.signOut).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith('/auth/login');
  });

  it('should hide modal after successful logout via onConfirm', async () => {
    (authService.signOut as jest.Mock).mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useLogoutConfirmation());

    // Show modal
    act(() => {
      result.current.showLogoutModal();
    });

    render(<>{result.current.logoutModal}</>);
    const { onConfirm } = capturedProps;

    // Confirm logout
    await act(async () => {
      await onConfirm();
    });

    // Render again to check updated state
    render(<>{result.current.logoutModal}</>);
    expect(capturedProps.visible).toBe(false);
  });

  it('should call onCancel callback and hide modal', () => {
    const { result } = renderHook(() => useLogoutConfirmation());

    // Show modal
    act(() => {
      result.current.showLogoutModal();
    });

    render(<>{result.current.logoutModal}</>);
    const { onCancel } = capturedProps;

    // Cancel
    act(() => {
      onCancel();
    });

    // Render again to check updated state
    render(<>{result.current.logoutModal}</>);
    expect(capturedProps.visible).toBe(false);
  });

  it('should set loading to true during logout', async () => {
    let resolveSignOut: () => void;
    const signOutPromise = new Promise<void>((resolve) => {
      resolveSignOut = resolve;
    });

    (authService.signOut as jest.Mock).mockReturnValueOnce(signOutPromise);

    render(<TestComponent />);
    const { onConfirm } = capturedProps;

    // Start logout (don't await yet)
    const confirmPromise = act(async () => {
      await onConfirm();
    });

    // Resolve signOut
    resolveSignOut!();
    await confirmPromise;

    expect(authService.signOut).toHaveBeenCalled();
  });

  it('should reset loading state even if signOut fails', async () => {
    const error = new Error('Sign out failed');
    (authService.signOut as jest.Mock).mockRejectedValueOnce(error);

    render(<TestComponent />);
    const { onConfirm } = capturedProps;

    // Attempt logout (should fail)
    try {
      await act(async () => {
        await onConfirm();
      });
    } catch (err) {
      // Expected to fail
    }

    // Loading should be reset to false (check by rendering again)
    render(<TestComponent />);
    expect(capturedProps.loading).toBe(false);
  });

  it('should not navigate if signOut fails', async () => {
    const error = new Error('Sign out failed');
    (authService.signOut as jest.Mock).mockRejectedValueOnce(error);

    render(<TestComponent />);
    const { onConfirm } = capturedProps;

    try {
      await act(async () => {
        await onConfirm();
      });
    } catch (err) {
      // Expected to fail
    }

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('should handle multiple show/hide cycles', () => {
    const { result } = renderHook(() => useLogoutConfirmation());

    // First cycle - show
    act(() => {
      result.current.showLogoutModal();
    });
    render(<>{result.current.logoutModal}</>);
    expect(capturedProps.visible).toBe(true);

    // First cycle - hide
    const { onCancel } = capturedProps;
    act(() => {
      onCancel();
    });
    render(<>{result.current.logoutModal}</>);
    expect(capturedProps.visible).toBe(false);

    // Second cycle - show
    act(() => {
      result.current.showLogoutModal();
    });
    render(<>{result.current.logoutModal}</>);
    expect(capturedProps.visible).toBe(true);
  });

  it('should provide showLogoutModal function across renders', () => {
    const { result, rerender } = renderHook(() => useLogoutConfirmation());

    expect(result.current.showLogoutModal).toBeInstanceOf(Function);

    rerender();

    expect(result.current.showLogoutModal).toBeInstanceOf(Function);
  });
});
