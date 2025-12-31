import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Platform,
  Pressable,
} from 'react-native';

import { useResponsive } from '@/hooks/useResponsive';
import { boxShadow } from '@/utils/color';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';
import { defaultTheme } from '@/utils/styles.base';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: 'default' | 'destructive' | 'success';
}

// Inject global styles for dialog backdrop (once)
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const styleId = 'confirm-dialog-backdrop-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      dialog.confirm-dialog::backdrop {
        background-color: ${defaultTheme.colors.overlay};
      }
      dialog.confirm-dialog[open] {
        animation: confirm-dialog-fade-in 0.15s ease-out;
      }
      @keyframes confirm-dialog-fade-in {
        from {
          opacity: 0;
          transform: scale(0.95);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }
    `;
    document.head.appendChild(style);
  }
}

/**
 * ConfirmDialog - Dialog de confirmação com botões Cancelar e Confirmar
 * Web: Usa HTML5 <dialog> para focus trap nativo e ESC para fechar
 */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  onConfirm,
  onCancel,
  type = 'default',
}: ConfirmDialogProps) {
  const { theme } = useUnistyles();
  const { isDesktop } = useResponsive();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const scrollPositionRef = useRef(0);

  const getIconName = () => {
    switch (type) {
      case 'destructive':
        return 'warning-outline';
      case 'success':
        return 'checkmark-circle-outline';
      default:
        return 'help-circle-outline';
    }
  };

  const getIconColor = () => {
    switch (type) {
      case 'destructive':
        return theme.colors.error;
      case 'success':
        return theme.colors.success;
      default:
        return theme.colors.primary;
    }
  };

  const getConfirmButtonColor = () => {
    switch (type) {
      case 'destructive':
        return theme.colors.error;
      case 'success':
        return theme.colors.success;
      default:
        return theme.colors.primary;
    }
  };

  const getConfirmButtonStyle = () => {
    switch (type) {
      case 'destructive':
        return styles.confirmButtonDestructive;
      case 'success':
        return styles.confirmButtonSuccess;
      default:
        return styles.confirmButtonDefault;
    }
  };

  // Web: Control dialog open/close state
  useEffect(() => {
    if (Platform.OS !== 'web' || !dialogRef.current) return;

    const dialog = dialogRef.current;

    if (visible) {
      // Save scroll position and lock body
      scrollPositionRef.current = window.scrollY;
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollPositionRef.current}px`;
      document.body.style.width = '100%';

      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, scrollPositionRef.current);
    }

    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
    };
  }, [visible]);

  // Web: Handle ESC key and click outside
  useEffect(() => {
    if (Platform.OS !== 'web' || !dialogRef.current) return;

    const dialog = dialogRef.current;

    const handleCancel = (e: Event) => {
      e.preventDefault();
      onCancel();
    };

    const handleBackdropClick = (e: MouseEvent) => {
      if (e.target === dialog) {
        onCancel();
      }
    };

    dialog.addEventListener('cancel', handleCancel);
    dialog.addEventListener('click', handleBackdropClick);

    return () => {
      dialog.removeEventListener('cancel', handleCancel);
      dialog.removeEventListener('click', handleBackdropClick);
    };
  }, [onCancel]);

  // ============================================
  // WEB: HTML5 <dialog> with Portal
  // ============================================
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const dialogContent = (
      <dialog
        ref={dialogRef}
        className="confirm-dialog"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        aria-modal="true"
        style={{
          position: 'fixed',
          border: 'none',
          padding: 0,
          margin: 'auto',
          maxWidth: isDesktop ? theme.desktop.dialog.maxWidth : 360,
          width: 'calc(100% - 48px)',
          backgroundColor: 'transparent',
          overflow: 'visible',
        }}
      >
        <div
          style={{
            backgroundColor: theme.colors.white,
            borderRadius: theme.borderRadius.xl,
            padding: isDesktop ? theme.desktop.dialog.containerPadding : theme.spacing.xl,
            boxShadow: [
              boxShadow(0, 20, 25, -5, theme.colors.black, 0.1),
              boxShadow(0, 10, 10, -5, theme.colors.black, 0.04),
            ].join(', '),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Icon */}
          <div
            style={{
              width: isDesktop ? theme.desktop.dialog.iconCircleSize : 56,
              height: isDesktop ? theme.desktop.dialog.iconCircleSize : 56,
              borderRadius: theme.borderRadius.full,
              backgroundColor: `${getIconColor()}15`,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              margin: `0 auto ${isDesktop ? 10 : theme.spacing.md}px`,
            }}
          >
            <Ionicons name={getIconName() as any} size={isDesktop ? theme.desktop.dialog.iconSize : 28} color={getIconColor()} />
          </div>

          {/* Title */}
          <h2
            id="confirm-dialog-title"
            style={{
              margin: 0,
              fontFamily: theme.typography.fontSansBold,
              fontSize: isDesktop ? theme.desktop.dialog.titleFontSize : theme.typography.fontSize.xl,
              lineHeight: `${(isDesktop ? theme.desktop.dialog.titleFontSize : theme.typography.fontSize.xl) * 1.4}px`,
              color: theme.colors.gray900,
              textAlign: 'center',
              marginBottom: isDesktop ? 6 : theme.spacing.sm,
            }}
          >
            {title}
          </h2>

          {/* Message */}
          <p
            id="confirm-dialog-message"
            style={{
              margin: 0,
              fontFamily: theme.typography.fontSans,
              fontSize: isDesktop ? theme.desktop.dialog.messageFontSize : theme.typography.fontSize.sm,
              lineHeight: `${(isDesktop ? theme.desktop.dialog.messageFontSize : theme.typography.fontSize.sm) * 1.5}px`,
              color: theme.colors.gray500,
              textAlign: 'center',
              marginBottom: isDesktop ? 14 : theme.spacing.lg,
            }}
          >
            {message}
          </p>

          {/* Buttons */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              gap: isDesktop ? theme.desktop.dialog.buttonGap : 12,
            }}
          >
            <button
              onClick={onCancel}
              aria-label={cancelText}
              style={{
                flex: 1,
                padding: isDesktop ? `${theme.desktop.dialog.buttonPaddingV}px ${theme.desktop.dialog.buttonPaddingH}px` : '10px 16px',
                borderRadius: theme.borderRadius.md,
                minHeight: isDesktop ? theme.desktop.dialog.buttonHeight : 44,
                backgroundColor: theme.colors.gray100,
                border: `1px solid ${theme.colors.gray200}`,
                fontSize: isDesktop ? theme.desktop.button.fontSize : theme.typography.fontSize.base,
                fontFamily: theme.typography.fontSansSemiBold,
                color: theme.colors.gray900,
                cursor: 'pointer',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.gray200;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.gray100;
              }}
            >
              {cancelText}
            </button>

            <button
              onClick={onConfirm}
              aria-label={confirmText}
              style={{
                flex: 1,
                padding: isDesktop ? `${theme.desktop.dialog.buttonPaddingV}px ${theme.desktop.dialog.buttonPaddingH}px` : '10px 16px',
                borderRadius: theme.borderRadius.md,
                minHeight: isDesktop ? theme.desktop.dialog.buttonHeight : 44,
                backgroundColor: getConfirmButtonColor(),
                border: 'none',
                fontSize: isDesktop ? theme.desktop.button.fontSize : theme.typography.fontSize.base,
                fontFamily: theme.typography.fontSansSemiBold,
                color: theme.colors.white,
                cursor: 'pointer',
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.9';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
              }}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </dialog>
    );

    return visible ? createPortal(dialogContent, document.body) : null;
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
      onRequestClose={onCancel}
      statusBarTranslucent
      presentationStyle="overFullScreen"
    >
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable style={styles.container} onPress={(e) => e.stopPropagation()}>
          {/* Icon */}
          <View style={[styles.iconContainer, { backgroundColor: `${getIconColor()}15` }]}>
            <Ionicons name={getIconName() as any} size={28} color={getIconColor()} />
          </View>

          {/* Title */}
          <Text style={styles.title}>{title}</Text>

          {/* Message */}
          <Text style={styles.message}>{message}</Text>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onCancel}
              accessibilityLabel={cancelText}
              accessibilityRole="button"
            >
              <Text style={styles.cancelButtonText}>{cancelText}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.confirmButton, getConfirmButtonStyle()]}
              onPress={onConfirm}
              accessibilityLabel={confirmText}
              accessibilityRole="button"
            >
              <Text style={styles.confirmButtonText}>{confirmText}</Text>
            </TouchableOpacity>
          </View>
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
    width: 56,
    height: 56,
    borderRadius: theme.borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
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
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 44,
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
  confirmButtonDefault: {
    backgroundColor: theme.colors.primary,
  },
  confirmButtonDestructive: {
    backgroundColor: theme.colors.error,
  },
  confirmButtonSuccess: {
    backgroundColor: theme.colors.success,
  },
  confirmButtonText: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.white,
  },
}));
