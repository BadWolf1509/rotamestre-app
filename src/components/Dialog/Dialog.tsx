/**
 * Dialog - Unified component for alert and confirmation dialogs
 *
 * Replaces AlertDialog, ConfirmDialog and ConfirmModal with a single API:
 * - variant="alert": Only OK button (old AlertDialog)
 * - variant="confirm": Cancel + Confirm buttons (old ConfirmDialog)
 * - variant="destructive": Confirmation with required typing (old ConfirmModal)
 *
 * Web: HTML5 <dialog> with native focus trap and ESC to close
 * Mobile: React Native Modal
 *
 * @example Alert simple
 * ```tsx
 * <Dialog
 *   visible={showDialog}
 *   variant="alert"
 *   type="success"
 *   title="Success!"
 *   message="Operation completed successfully."
 *   onConfirm={() => setShowDialog(false)}
 * />
 * ```
 *
 * @example Confirmation
 * ```tsx
 * <Dialog
 *   visible={showDialog}
 *   variant="confirm"
 *   type="warning"
 *   title="Confirm deletion"
 *   message="Do you really want to delete this item?"
 *   onConfirm={handleDelete}
 *   onCancel={() => setShowDialog(false)}
 * />
 * ```
 *
 * @example Destructive confirmation
 * ```tsx
 * <Dialog
 *   visible={showDialog}
 *   variant="destructive"
 *   type="danger"
 *   title="Delete account"
 *   message="This action cannot be undone."
 *   destructiveConfirmText="DELETE"
 *   onConfirm={handleDeleteAccount}
 *   onCancel={() => setShowDialog(false)}
 * />
 * ```
 */
import React, { useEffect, useRef, useState } from 'react';
import { Modal, Text, Pressable, Platform } from 'react-native';

import { useDialogState, useDialogBackdropHandler } from '@/hooks/useDialogState';
import { useResponsive } from '@/hooks/useResponsive';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

import { DialogButtons } from './DialogButtons';
import { DialogDestructiveInput } from './DialogDestructiveInput';
import { DialogIcon } from './DialogIcon';
import { DialogWeb } from './DialogWeb';

import type { DialogProps, DialogType } from './Dialog.types';

// Lazy import for dialog styles to avoid module-level side effects in tests
let dialogStylesInjected = false;
function ensureDialogStyles() {
  if (!dialogStylesInjected && Platform.OS === 'web' && typeof document !== 'undefined') {
    const { injectDialogStyles } = require('@/utils/dialog-styles');
    injectDialogStyles();
    dialogStylesInjected = true;
  }
}

/** Get color based on dialog type */
function getTypeColor(type: DialogType, theme: ReturnType<typeof useUnistyles>['theme']): string {
  switch (type) {
    case 'success':
      return theme.colors.success;
    case 'warning':
      return theme.colors.warning;
    case 'error':
    case 'danger':
      return theme.colors.error;
    case 'info':
    case 'default':
    default:
      return theme.colors.primary;
  }
}

export function Dialog({
  visible,
  title,
  message,
  variant = 'alert',
  type = 'default',
  confirmText,
  cancelText = 'Cancelar',
  onConfirm,
  onCancel,
  loading = false,
  destructiveConfirmText,
}: DialogProps) {
  ensureDialogStyles();

  const { theme } = useUnistyles();
  const { isDesktop } = useResponsive();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [confirmInput, setConfirmInput] = useState('');

  // Default confirmText based on variant
  const defaultConfirmText = variant === 'alert' ? 'OK' : 'Confirmar';
  const finalConfirmText = confirmText ?? defaultConfirmText;

  // Use hooks for web dialog management
  const handleClose = onCancel ?? onConfirm;
  useDialogState(visible, dialogRef);
  useDialogBackdropHandler(dialogRef, handleClose, variant !== 'destructive');

  // Reset input when dialog closes
  useEffect(() => {
    if (!visible) {
      setConfirmInput('');
    }
  }, [visible]);

  // Get colors
  const iconColor = getTypeColor(type, theme);
  const iconBgColor = `${iconColor}15`;

  // Destructive confirmation validation
  const isDestructiveConfirmValid = destructiveConfirmText
    ? confirmInput.toUpperCase() === destructiveConfirmText.toUpperCase()
    : true;

  const isConfirmDisabled = loading || (variant === 'destructive' && !isDestructiveConfirmValid);

  // ============================================
  // WEB: Use DialogWeb component
  // ============================================
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    return (
      <DialogWeb
        visible={visible}
        title={title}
        message={message}
        variant={variant}
        type={type}
        confirmText={finalConfirmText}
        cancelText={cancelText}
        onConfirm={onConfirm}
        onCancel={onCancel}
        loading={loading}
        destructiveConfirmText={destructiveConfirmText}
        confirmInput={confirmInput}
        setConfirmInput={setConfirmInput}
        isDestructiveConfirmValid={isDestructiveConfirmValid}
        isConfirmDisabled={isConfirmDisabled}
        iconColor={iconColor}
        iconBgColor={iconBgColor}
        dialogRef={dialogRef}
        isDesktop={isDesktop}
      />
    );
  }

  // ============================================
  // MOBILE: React Native Modal
  // ============================================
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent
      presentationStyle="overFullScreen"
    >
      <Pressable style={styles.overlay} onPress={variant === 'destructive' ? undefined : handleClose}>
        <Pressable style={styles.container} onPress={(e) => e?.stopPropagation?.()} testID="confirm-dialog">
          {/* Icon */}
          <DialogIcon
            variant={variant}
            type={type}
            iconColor={iconColor}
            iconBgColor={iconBgColor}
            style={styles.iconContainer}
          />

          {/* Title */}
          <Text style={styles.title}>{title}</Text>

          {/* Message */}
          <Text style={styles.message}>{message}</Text>

          {/* Destructive confirmation input */}
          {variant === 'destructive' && destructiveConfirmText && (
            <DialogDestructiveInput
              confirmText={destructiveConfirmText}
              value={confirmInput}
              onChangeText={setConfirmInput}
              isValid={isDestructiveConfirmValid}
              disabled={loading}
            />
          )}

          {/* Buttons */}
          <DialogButtons
            variant={variant}
            confirmText={finalConfirmText}
            cancelText={cancelText}
            confirmColor={iconColor}
            loading={loading}
            disabled={!isDestructiveConfirmValid && variant === 'destructive'}
            onConfirm={onConfirm}
            onCancel={onCancel}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  overlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  container: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    width: '100%',
    maxWidth: 360,
    ...Platform.select({
      default: theme.shadows.lg,
    }),
  },
  iconContainer: {
    marginBottom: theme.spacing.md,
  },
  title: {
    fontFamily: theme.typography.fontSansBold,
    fontSize: theme.typography.fontSize.xl,
    lineHeight: theme.typography.fontSize.xl * 1.4,
    color: theme.colors.gray900,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  message: {
    fontFamily: theme.typography.fontSans,
    fontSize: theme.typography.fontSize.sm,
    lineHeight: theme.typography.fontSize.sm * 1.5,
    color: theme.colors.gray500,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
}));

export default Dialog;
