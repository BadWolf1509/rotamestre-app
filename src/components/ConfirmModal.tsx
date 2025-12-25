import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Platform,
  Pressable,
} from 'react-native';

import { useResponsive } from '@/hooks/useResponsive';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

export interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: 'danger' | 'warning' | 'info' | 'success';
  loading?: boolean;
}

// Inject global styles for dialog backdrop (once)
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const styleId = 'confirm-modal-backdrop-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      dialog.confirm-modal-dialog::backdrop {
        background-color: rgba(0, 0, 0, 0.5);
      }
      dialog.confirm-modal-dialog[open] {
        animation: confirm-modal-fade-in 0.2s ease-out;
      }
      @keyframes confirm-modal-fade-in {
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
 * Modal de confirmação customizado com design system
 *
 * Web: Usa HTML5 <dialog> nativo com Portal
 * Mobile: Usa React Native Modal
 *
 * @example
 * ```tsx
 * <ConfirmModal
 *   visible={showModal}
 *   title="Confirmar Exclusão"
 *   message="Tem certeza que deseja excluir esta rota?"
 *   type="danger"
 *   onConfirm={handleConfirm}
 *   onCancel={() => setShowModal(false)}
 * />
 * ```
 */
export function ConfirmModal({
  visible,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  onConfirm,
  onCancel,
  type = 'danger',
}: ConfirmModalProps) {
  const { theme } = useUnistyles();
  const { isDesktop } = useResponsive();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const scrollPositionRef = useRef(0);

  const getConfirmButtonColor = () => {
    switch (type) {
      case 'danger':
        return theme.colors.error;
      case 'warning':
        return theme.colors.warning;
      case 'success':
        return theme.colors.success;
      case 'info':
      default:
        return theme.colors.primary;
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'danger':
        return '🗑️';
      case 'warning':
        return '⚠️';
      case 'success':
        return '✅';
      case 'info':
      default:
        return 'ℹ️';
    }
  };

  // Web: Control dialog open/close state
  useEffect(() => {
    if (Platform.OS !== 'web' || !dialogRef.current) return;

    const dialog = dialogRef.current;

    if (visible) {
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
        className="confirm-modal-dialog"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-message"
        aria-modal="true"
        style={{
          position: 'fixed',
          border: 'none',
          padding: 0,
          margin: 'auto',
          maxWidth: isDesktop ? 420 : 500,
          width: '100%',
          backgroundColor: 'transparent',
          overflow: 'visible',
        }}
      >
        <div
          style={{
            backgroundColor: theme.colors.white,
            borderRadius: theme.borderRadius.lg,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            overflow: 'hidden',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              padding: isDesktop ? theme.desktop.modal.headerPadding : theme.spacing['2xl'],
              borderBottom: `1px solid ${theme.colors.gray200}`,
            }}
          >
            <span style={{ fontSize: isDesktop ? 20 : 24, marginRight: isDesktop ? 10 : theme.spacing.md }}>{getIcon()}</span>
            <h2
              id="confirm-modal-title"
              style={{
                margin: 0,
                fontSize: isDesktop ? theme.desktop.dialog.titleFontSize : theme.typography.xl,
                fontFamily: theme.typography.fontSansSemiBold,
                color: theme.colors.gray900,
                flex: 1,
              }}
            >
              {title}
            </h2>
          </div>

          {/* Body */}
          <div style={{ padding: isDesktop ? theme.desktop.modal.bodyPadding : theme.spacing['2xl'] }}>
            <p
              id="confirm-modal-message"
              style={{
                margin: 0,
                fontSize: isDesktop ? 14 : theme.typography.base,
                fontFamily: theme.typography.fontSans,
                color: theme.colors.gray700,
                lineHeight: isDesktop ? '20px' : '24px',
              }}
            >
              {message}
            </p>
          </div>

          {/* Footer */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              gap: isDesktop ? theme.desktop.modal.footerGap : theme.spacing.md,
              padding: isDesktop ? theme.desktop.modal.footerPadding : theme.spacing.lg,
              backgroundColor: theme.colors.gray50,
              justifyContent: 'flex-end',
            }}
          >
            {cancelText ? (
              <button
                onClick={onCancel}
                style={{
                  paddingLeft: isDesktop ? theme.desktop.button.paddingHorizontal : theme.spacing.lg,
                  paddingRight: isDesktop ? theme.desktop.button.paddingHorizontal : theme.spacing.lg,
                  paddingTop: isDesktop ? theme.desktop.dialog.buttonPaddingV : theme.spacing.md,
                  paddingBottom: isDesktop ? theme.desktop.dialog.buttonPaddingV : theme.spacing.md,
                  backgroundColor: theme.colors.white,
                  borderRadius: theme.borderRadius.md,
                  border: `1px solid ${theme.colors.gray300}`,
                  minWidth: isDesktop ? 80 : 100,
                  cursor: 'pointer',
                  fontSize: isDesktop ? theme.desktop.button.fontSize : theme.typography.sm,
                  fontFamily: theme.typography.fontSansSemiBold,
                  color: theme.colors.gray700,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = theme.colors.gray50;
                  e.currentTarget.style.borderColor = theme.colors.gray400;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = theme.colors.white;
                  e.currentTarget.style.borderColor = theme.colors.gray300;
                }}
              >
                {cancelText}
              </button>
            ) : null}

            <button
              onClick={onConfirm}
              style={{
                paddingLeft: isDesktop ? theme.desktop.button.paddingHorizontal : theme.spacing.lg,
                paddingRight: isDesktop ? theme.desktop.button.paddingHorizontal : theme.spacing.lg,
                paddingTop: isDesktop ? theme.desktop.dialog.buttonPaddingV : theme.spacing.md,
                paddingBottom: isDesktop ? theme.desktop.dialog.buttonPaddingV : theme.spacing.md,
                backgroundColor: getConfirmButtonColor(),
                borderRadius: theme.borderRadius.md,
                border: 'none',
                minWidth: isDesktop ? 80 : 100,
                cursor: 'pointer',
                fontSize: isDesktop ? theme.desktop.button.fontSize : theme.typography.sm,
                fontFamily: theme.typography.fontSansSemiBold,
                color: theme.colors.white,
                transition: 'all 0.2s',
                flex: cancelText ? undefined : 1,
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
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable style={styles.modalContainer} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.icon}>{getIcon()}</Text>
            <Text style={styles.title}>{title}</Text>
          </View>

          {/* Body */}
          <View style={styles.body}>
            <Text style={styles.message}>{message}</Text>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            {cancelText ? (
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onCancel}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelButtonText}>{cancelText}</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={[
                styles.confirmButton,
                { backgroundColor: getConfirmButtonColor() },
                !cancelText && styles.singleButton,
              ]}
              onPress={onConfirm}
              activeOpacity={0.8}
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalContainer: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    width: '100%',
    maxWidth: 500,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing['2xl'],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
  },
  icon: {
    fontSize: 24,
    marginRight: theme.spacing.md,
  },
  title: {
    fontSize: theme.typography.xl,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
    flex: 1,
  },
  body: {
    padding: theme.spacing['2xl'],
  },
  message: {
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray700,
    lineHeight: 24,
  },
  footer: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.gray50,
    justifyContent: 'flex-end',
  },
  cancelButton: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    minWidth: 100,
    alignItems: 'center',
    // Web-only hover state
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
      transitionProperty: 'all',
      transitionDuration: '0.2s',
      transitionTimingFunction: 'ease-in-out',
      // @ts-ignore - web-only CSS
      ':hover': {
        backgroundColor: theme.colors.gray50,
        borderColor: theme.colors.gray400,
      },
    }),
  },
  cancelButtonText: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray700,
  },
  confirmButton: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    minWidth: 100,
    alignItems: 'center',
    // Web-only hover state
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
      transitionProperty: 'all',
      transitionDuration: '0.2s',
      transitionTimingFunction: 'ease-in-out',
      // @ts-ignore - web-only CSS
      ':hover': {
        opacity: 0.9,
        transform: 'translateY(-1px)',
        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
      },
    }),
  },
  confirmButtonText: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.white,
  },
  singleButton: {
    flex: 1,
  },
}));
