/**
 * useAlert - Hook for imperative dialog management
 *
 * Provides a clean API for showing alerts, confirmations, and error dialogs.
 * Integrates with errorMapping.ts for user-friendly error messages.
 *
 * @example Basic alert
 * ```tsx
 * const { showAlert, AlertDialog } = useAlert();
 *
 * // Show success
 * showAlert({ title: 'Sucesso!', message: 'Operação concluída.' });
 *
 * // In render
 * return <>{AlertDialog}<AlertDialog/>
 * ```
 *
 * @example Error from catch block
 * ```tsx
 * const { showError, AlertDialog } = useAlert();
 *
 * try {
 *   await supabase.from('users').insert(data);
 * } catch (error) {
 *   showError(error); // Auto-translates to user-friendly message
 * }
 * ```
 *
 * @example Confirmation
 * ```tsx
 * const { showConfirm, AlertDialog } = useAlert();
 *
 * const handleDelete = async () => {
 *   const confirmed = await showConfirm({
 *     title: 'Excluir item?',
 *     message: 'Esta ação não pode ser desfeita.',
 *     type: 'warning',
 *   });
 *
 *   if (confirmed) {
 *     await deleteItem();
 *   }
 * };
 * ```
 */

import React, { useCallback, useRef, useState } from 'react';

import { Dialog } from '@/components/Dialog';
import type { DialogType, DialogVariant } from '@/components/Dialog/Dialog.types';
import { getErrorMessage, type UserFriendlyError } from '@/lib/errorMapping';

// ============================================================================
// TYPES
// ============================================================================

interface AlertState {
  visible: boolean;
  title: string;
  message: string;
  type: DialogType;
  variant: DialogVariant;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
  destructiveConfirmText?: string;
}

interface ShowAlertOptions {
  title: string;
  message: string;
  type?: DialogType;
  confirmText?: string;
  onConfirm?: () => void;
}

interface ShowConfirmOptions {
  title: string;
  message: string;
  type?: DialogType;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

interface ShowDestructiveOptions extends ShowConfirmOptions {
  destructiveConfirmText: string;
}

interface ShowErrorOptions {
  title?: string;
  message?: string;
  onDismiss?: () => void;
}

export interface UseAlertReturn {
  /** Show a simple alert dialog (OK only) */
  showAlert: (options: ShowAlertOptions) => void;
  /** Show a success alert */
  showSuccess: (title: string, message: string, onDismiss?: () => void) => void;
  /** Show a warning alert */
  showWarning: (title: string, message: string, onDismiss?: () => void) => void;
  /** Show an error alert - can accept Error object or options */
  showError: (errorOrOptions: unknown | ShowErrorOptions, fallbackOptions?: ShowErrorOptions) => void;
  /** Show a confirmation dialog - returns Promise<boolean> */
  showConfirm: (options: ShowConfirmOptions) => Promise<boolean>;
  /** Show a destructive confirmation dialog */
  showDestructive: (options: ShowDestructiveOptions) => Promise<boolean>;
  /** Hide the current dialog */
  hideAlert: () => void;
  /** Whether any dialog is currently visible */
  isVisible: boolean;
  /** Dialog component to render in your component tree */
  AlertDialog: React.ReactElement | null;
}

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState: AlertState = {
  visible: false,
  title: '',
  message: '',
  type: 'default',
  variant: 'alert',
  confirmText: undefined,
  cancelText: undefined,
  loading: false,
  destructiveConfirmText: undefined,
};

// ============================================================================
// HOOK
// ============================================================================

export function useAlert(): UseAlertReturn {
  const [state, setState] = useState<AlertState>(initialState);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);
  const onConfirmRef = useRef<(() => void) | undefined>(undefined);
  const onCancelRef = useRef<(() => void) | undefined>(undefined);

  // Hide alert and reset state
  const hideAlert = useCallback(() => {
    setState(initialState);
    resolveRef.current = null;
    onConfirmRef.current = undefined;
    onCancelRef.current = undefined;
  }, []);

  // Show simple alert (OK only)
  const showAlert = useCallback(
    ({ title, message, type = 'default', confirmText, onConfirm }: ShowAlertOptions) => {
      onConfirmRef.current = onConfirm;
      onCancelRef.current = undefined;
      setState({
        ...initialState,
        visible: true,
        title,
        message,
        type,
        variant: 'alert',
        confirmText,
      });
    },
    []
  );

  // Show success alert
  const showSuccess = useCallback(
    (title: string, message: string, onDismiss?: () => void) => {
      showAlert({ title, message, type: 'success', onConfirm: onDismiss });
    },
    [showAlert]
  );

  // Show warning alert
  const showWarning = useCallback(
    (title: string, message: string, onDismiss?: () => void) => {
      showAlert({ title, message, type: 'warning', onConfirm: onDismiss });
    },
    [showAlert]
  );

  // Show error alert - handles Error objects or plain options
  const showError = useCallback(
    (errorOrOptions: unknown | ShowErrorOptions, fallbackOptions?: ShowErrorOptions) => {
      let title: string;
      let message: string;
      let onDismiss: (() => void) | undefined;

      // Check if it's an error object or options
      if (
        errorOrOptions &&
        typeof errorOrOptions === 'object' &&
        'title' in errorOrOptions &&
        'message' in errorOrOptions &&
        !('stack' in errorOrOptions)
      ) {
        // It's ShowErrorOptions
        const opts = errorOrOptions as ShowErrorOptions;
        title = opts.title || 'Erro';
        message = opts.message || 'Ocorreu um erro inesperado.';
        onDismiss = opts.onDismiss;
      } else {
        // It's an error - use errorMapping to get user-friendly message
        const friendlyError: UserFriendlyError = getErrorMessage(errorOrOptions);
        title = fallbackOptions?.title || friendlyError.title;
        message = fallbackOptions?.message || friendlyError.message;
        onDismiss = fallbackOptions?.onDismiss;
      }

      showAlert({ title, message, type: 'error', onConfirm: onDismiss });
    },
    [showAlert]
  );

  // Show confirmation dialog - returns promise
  const showConfirm = useCallback(
    ({
      title,
      message,
      type = 'default',
      confirmText,
      cancelText,
      onConfirm,
      onCancel,
    }: ShowConfirmOptions): Promise<boolean> => {
      return new Promise((resolve) => {
        resolveRef.current = resolve;
        onConfirmRef.current = onConfirm;
        onCancelRef.current = onCancel;
        setState({
          ...initialState,
          visible: true,
          title,
          message,
          type,
          variant: 'confirm',
          confirmText,
          cancelText,
        });
      });
    },
    []
  );

  // Show destructive confirmation dialog
  const showDestructive = useCallback(
    ({
      title,
      message,
      type = 'danger',
      confirmText,
      cancelText,
      destructiveConfirmText,
      onConfirm,
      onCancel,
    }: ShowDestructiveOptions): Promise<boolean> => {
      return new Promise((resolve) => {
        resolveRef.current = resolve;
        onConfirmRef.current = onConfirm;
        onCancelRef.current = onCancel;
        setState({
          ...initialState,
          visible: true,
          title,
          message,
          type,
          variant: 'destructive',
          confirmText,
          cancelText,
          destructiveConfirmText,
        });
      });
    },
    []
  );

  // Handle confirm button
  const handleConfirm = useCallback(() => {
    onConfirmRef.current?.();
    resolveRef.current?.(true);
    hideAlert();
  }, [hideAlert]);

  // Handle cancel button
  const handleCancel = useCallback(() => {
    onCancelRef.current?.();
    resolveRef.current?.(false);
    hideAlert();
  }, [hideAlert]);

  // Create AlertDialog element
  const AlertDialog = state.visible
    ? React.createElement(Dialog, {
        visible: state.visible,
        title: state.title,
        message: state.message,
        type: state.type,
        variant: state.variant,
        confirmText: state.confirmText,
        cancelText: state.cancelText,
        loading: state.loading,
        destructiveConfirmText: state.destructiveConfirmText,
        onConfirm: handleConfirm,
        onCancel: state.variant !== 'alert' ? handleCancel : undefined,
      })
    : null;

  return {
    showAlert,
    showSuccess,
    showWarning,
    showError,
    showConfirm,
    showDestructive,
    hideAlert,
    isVisible: state.visible,
    AlertDialog,
  };
}

export default useAlert;
