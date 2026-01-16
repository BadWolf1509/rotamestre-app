/**
 * DialogButtons - Button row for Dialog component
 * Handles cancel and confirm buttons with loading state
 */
import { memo } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';

import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

import type { DialogVariant } from './Dialog.types';

interface DialogButtonsProps {
  variant: DialogVariant;
  confirmText: string;
  cancelText: string;
  confirmColor: string;
  loading: boolean;
  disabled: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}

/**
 * Dialog buttons component for mobile (React Native)
 * Memoized to prevent unnecessary re-renders
 */
export const DialogButtons = memo(function DialogButtons({
  variant,
  confirmText,
  cancelText,
  confirmColor,
  loading,
  disabled,
  onConfirm,
  onCancel,
}: DialogButtonsProps) {
  const { theme } = useUnistyles();
  const isConfirmDisabled = loading || disabled;

  return (
    <View style={styles.container}>
      {/* Cancel button (only for confirm/destructive variants) */}
      {variant !== 'alert' && (
        <TouchableOpacity
          style={[styles.button, styles.cancelButton, loading && styles.buttonDisabled]}
          onPress={onCancel}
          disabled={loading}
          accessibilityLabel={cancelText}
          accessibilityRole="button"
          testID="cancel-reset"
        >
          <Text style={styles.cancelButtonText}>{cancelText}</Text>
        </TouchableOpacity>
      )}

      {/* Confirm button */}
      <TouchableOpacity
        style={[
          styles.button,
          styles.confirmButton,
          { backgroundColor: confirmColor },
          isConfirmDisabled && styles.buttonDisabled,
          variant === 'alert' && styles.buttonFull,
        ]}
        onPress={onConfirm}
        disabled={isConfirmDisabled}
        accessibilityLabel={confirmText}
        accessibilityRole="button"
        testID="confirm-reset"
      >
        {loading && <ActivityIndicator size="small" color={theme.colors.white} style={styles.loader} />}
        <Text style={styles.confirmButtonText}>{confirmText}</Text>
      </TouchableOpacity>
    </View>
  );
});

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    flexDirection: 'row',
    gap: theme.components.dialog.buttonGap,
  },
  button: {
    flex: 1,
    paddingVertical: theme.components.dialog.buttonPaddingV,
    paddingHorizontal: theme.components.dialog.buttonPaddingH,
    borderRadius: theme.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: theme.components.minTouchTarget,
  },
  buttonFull: {
    flex: 1,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  cancelButton: {
    backgroundColor: theme.colors.gray100,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
  cancelButtonText: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
  },
  confirmButton: {
    borderWidth: 0,
  },
  confirmButtonText: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.white,
  },
  loader: {
    marginRight: theme.spacing.sm,
  },
}));

export default DialogButtons;
