import { act, render, renderHook } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import React from 'react';

import { authService } from '@/lib/auth';

import { useLogoutConfirmation } from '../useLogoutConfirmation';

// Mock dependencies
jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  authService: {
    signOut: jest.fn(),
  },
}));

// Variable to capture Dialog props
let capturedProps: any = null;
// Último estado de cada Dialog, pelo título (o hook tem dois: confirmar e erro)
let mockDialogsPorTitulo: Record<string, any> = {};

// Mock Dialog
jest.mock('@/components/Dialog', () => {
  return {
    Dialog: jest.fn((props) => {
      if (props.title === 'Erro ao sair') {
        mockDialogsPorTitulo[props.title] = props;
      } else {
        capturedProps = props;
      }
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
    mockDialogsPorTitulo = {};
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

  it('should pass correct props to Dialog initially', () => {
    render(<TestComponent />);

    expect(capturedProps).toBeTruthy();
    expect(capturedProps.title).toBe('Sair da conta');
    expect(capturedProps.message).toBe('Deseja realmente encerrar sua sessão?');
    expect(capturedProps.confirmText).toBe('Sair');
    expect(capturedProps.cancelText).toBe('Cancelar');
    expect(capturedProps.type).toBe('danger');
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

  // R-NUC-1: navegar ao login é do layout raiz (useNavegacaoDeSaida), que
  // reage à sessão que sai. Aqui, só o signOut.
  it('onConfirm chama o signOut e não navega por conta própria', async () => {
    (authService.signOut as jest.Mock).mockResolvedValueOnce(undefined);

    render(<TestComponent />);

    const { onConfirm } = capturedProps;
    expect(onConfirm).toBeTruthy();

    await act(async () => {
      await onConfirm();
    });

    expect(authService.signOut).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
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
    } catch {
      // Expected to fail
    }

    // Loading should be reset to false (check by rendering again)
    render(<TestComponent />);
    expect(capturedProps.loading).toBe(false);
  });

  // Navegar ao login é só do SIGNED_OUT (layout raiz); daqui nunca.
  it('signOut que falha: não navega por conta própria', async () => {
    const error = new Error('Sign out failed');
    (authService.signOut as jest.Mock).mockRejectedValueOnce(error);

    render(<TestComponent />);
    const { onConfirm } = capturedProps;

    await act(async () => {
      await onConfirm();
    });

    expect(mockReplace).not.toHaveBeenCalled();
  });

  // Token vencido + sem rede: o signOut do supabase-js devolve o erro antes de
  // limpar a sessão, então não chega SIGNED_OUT e nada navega. Sem aviso, o
  // toque em Sair não responderia. Mesmo aviso do menu lateral (useDrawerLogout).
  it('signOut que falha: mostra o aviso de erro ao sair', async () => {
    (authService.signOut as jest.Mock).mockRejectedValueOnce(
      new Error('Sign out failed'),
    );

    render(<TestComponent />);
    expect(mockDialogsPorTitulo['Erro ao sair']?.visible).toBe(false);

    await act(async () => {
      await capturedProps.onConfirm();
    });

    const aviso = mockDialogsPorTitulo['Erro ao sair'];
    expect(aviso.visible).toBe(true);
    expect(aviso.message).toBe(
      'Não foi possível encerrar sua sessão. Tente novamente.',
    );

    act(() => {
      aviso.onConfirm();
    });
    expect(mockDialogsPorTitulo['Erro ao sair'].visible).toBe(false);
  });

  it('signOut que dá certo: nenhum aviso de erro', async () => {
    (authService.signOut as jest.Mock).mockResolvedValueOnce(undefined);

    render(<TestComponent />);
    await act(async () => {
      await capturedProps.onConfirm();
    });

    expect(mockDialogsPorTitulo['Erro ao sair'].visible).toBe(false);
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

    rerender(undefined);

    expect(result.current.showLogoutModal).toBeInstanceOf(Function);
  });
});
