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

interface AlertDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  onConfirm: () => void;
  type?: 'default' | 'error' | 'success' | 'warning';
}

// Inject global styles for dialog backdrop (once)
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const styleId = 'alert-dialog-backdrop-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      dialog.alert-dialog::backdrop {
        background-color: ${defaultTheme.colors.overlay};
      }
      dialog.alert-dialog[open] {
        animation: alert-dialog-fade-in 0.15s ease-out;
      }
      @keyframes alert-dialog-fade-in {
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
 * AlertDialog - Dialog de alerta com apenas um botão de confirmação
 * Similar ao ConfirmDialog mas sem botão de cancelar
 * Web: Usa HTML5 <dialog> para focus trap nativo e ESC para fechar
 */
export function AlertDialog({
  visible,
  title,
  message,
  confirmText = 'OK',
  onConfirm,
  type = 'default',
}: AlertDialogProps) {
  const { theme } = useUnistyles();
  const { isDesktop } = useResponsive();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const scrollPositionRef = useRef(0);

  const getIconName = () => {
    switch (type) {
      case 'error':
        return 'close-circle-outline';
      case 'success':
        return 'checkmark-circle-outline';
      case 'warning':
        return 'warning-outline';
      default:
        return 'information-circle-outline';
    }
  };

  const getIconColor = () => {
    switch (type) {
      case 'error':
        return theme.colors.error;
      case 'success':
        return theme.colors.success;
      case 'warning':
        return theme.colors.warning;
      default:
        return theme.colors.primary;
    }
  };

  const getConfirmButtonColor = () => {
    switch (type) {
      case 'error':
        return theme.colors.error;
      case 'success':
        return theme.colors.success;
      case 'warning':
        return theme.colors.warning;
      default:
        return theme.colors.primary;
    }
  };

  const getConfirmButtonStyle = () => {
    switch (type) {
      case 'error':
        return styles.confirmButtonError;
      case 'success':
        return styles.confirmButtonSuccess;
      case 'warning':
        return styles.confirmButtonWarning;
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
      onConfirm();
    };

    const handleBackdropClick = (e: MouseEvent) => {
      if (e.target === dialog) {
        onConfirm();
      }
    };

    dialog.addEventListener('cancel', handleCancel);
    dialog.addEventListener('click', handleBackdropClick);

    return () => {
      dialog.removeEventListener('cancel', handleCancel);
      dialog.removeEventListener('click', handleBackdropClick);
    };
  }, [onConfirm]);

  // ============================================
  // WEB: HTML5 <dialog> with Portal
  // ============================================
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const dialogContent = (
      <dialog
        ref={dialogRef}
        className="alert-dialog"
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-message"
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
              margin: `0 auto ${isDesktop ? theme.spacing.sm + 2 : theme.spacing.md}px`,
            }}
          >
            <Ionicons name={getIconName() as any} size={isDesktop ? theme.desktop.dialog.iconSize : 28} color={getIconColor()} />
          </div>

          {/* Title */}
          <h2
            id="alert-dialog-title"
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
            id="alert-dialog-message"
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

          {/* Confirm Button */}
          <button
            onClick={onConfirm}
            aria-label={confirmText}
            style={{
              width: '100%',
              padding: isDesktop ? `${theme.desktop.dialog.buttonPaddingV}px ${theme.desktop.dialog.buttonPaddingH}px` : `${theme.components.dialog.buttonPaddingV}px ${theme.components.dialog.buttonPaddingH}px`,
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
      onRequestClose={onConfirm}
      statusBarTranslucent
      presentationStyle="overFullScreen"
    >
      <Pressable style={styles.overlay} onPress={onConfirm}>
        <Pressable style={styles.container} onPress={(e) => e.stopPropagation()}>
          {/* Icon */}
          <View style={[styles.iconContainer, { backgroundColor: `${getIconColor()}15` }]}>
            <Ionicons name={getIconName() as any} size={28} color={getIconColor()} />
          </View>

          {/* Title */}
          <Text style={styles.title}>{title}</Text>

          {/* Message */}
          <Text style={styles.message}>{message}</Text>

          {/* Confirm Button */}
          <TouchableOpacity
            style={[styles.confirmButton, getConfirmButtonStyle()]}
            onPress={onConfirm}
            accessibilityLabel={confirmText}
            accessibilityRole="button"
          >
            <Text style={styles.confirmButtonText}>{confirmText}</Text>
          </TouchableOpacity>
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
      default: theme.shadows?.lg ?? {},
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
  confirmButton: {
    width: '100%',
    paddingVertical: theme.components.dialog.buttonPaddingV,
    paddingHorizontal: theme.components.dialog.buttonPaddingH,
    borderRadius: theme.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: theme.components.minTouchTarget,
    borderWidth: 0,
  },
  confirmButtonDefault: {
    backgroundColor: theme.colors.primary,
  },
  confirmButtonError: {
    backgroundColor: theme.colors.error,
  },
  confirmButtonSuccess: {
    backgroundColor: theme.colors.success,
  },
  confirmButtonWarning: {
    backgroundColor: theme.colors.warning,
  },
  confirmButtonText: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.white,
  },
}));
