import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Modal, View, Text, TouchableOpacity, Pressable, ViewStyle, DimensionValue, Platform } from 'react-native';

import { useResponsive } from '@/hooks/useResponsive';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

import { Toast, type ToastProps } from '../Toast';

/**
 * DesktopModal - Modal responsivo adaptativo
 *
 * Web: Usa HTML5 <dialog> nativo com:
 *   - Focus trap automático
 *   - ESC para fechar nativo
 *   - ::backdrop CSS
 *   - ARIA roles automáticos
 *   - Portal para document.body
 *
 * Mobile: Usa React Native Modal com:
 *   - Desktop (≥1024px): Modal centralizado com overlay
 *   - Mobile/Tablet (<1024px): Bottom sheet (slide from bottom)
 *
 * Padrão usado por: Stripe, Linear, Vercel
 *
 * @example Formulário de Edição
 * <DesktopModal
 *   visible={showModal}
 *   title="Editar Motorista"
 *   onClose={() => setShowModal(false)}
 * >
 *   <Form />
 * </DesktopModal>
 */

interface DesktopModalProps {
  /** Visibilidade do modal */
  visible: boolean;
  /** Callback ao fechar */
  onClose: () => void;
  /** Título do modal */
  title?: string;
  /** Conteúdo do modal */
  children: React.ReactNode;
  /** Largura máxima no desktop (default: 600) */
  maxWidth?: number;
  /** Largura (alias para maxWidth) */
  width?: number;
  /** Altura máxima (default: 80% da tela) */
  maxHeight?: string;
  /** Permitir fechar clicando fora (default: true) */
  closeOnOverlayPress?: boolean;
  /** Estilo adicional para o container de conteúdo */
  contentStyle?: ViewStyle;
  /** Props do Toast para renderizar DENTRO do modal (acima de tudo) */
  toast?: ToastProps;
}

export function DesktopModal({
  visible,
  onClose,
  title,
  children,
  maxWidth = 600,
  width,
  maxHeight = '80%',
  closeOnOverlayPress = true,
  contentStyle,
  toast,
}: DesktopModalProps) {
  const { isDesktop } = useResponsive();
  const { theme } = useUnistyles();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const scrollPositionRef = useRef(0);

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

      // Show modal dialog (enables focus trap and ESC to close)
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      // Close dialog and restore body scroll
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
      // Cleanup on unmount
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
    };
  }, [visible]);

  // Web: Handle ESC key (native dialog behavior) and click outside
  useEffect(() => {
    if (Platform.OS !== 'web' || !dialogRef.current) return;

    const dialog = dialogRef.current;

    // Native dialog fires 'cancel' event on ESC
    const handleCancel = (e: Event) => {
      e.preventDefault(); // Prevent default close to control it ourselves
      onClose();
    };

    // Handle click on backdrop (the dialog element itself, not content)
    const handleBackdropClick = (e: MouseEvent) => {
      if (closeOnOverlayPress && e.target === dialog) {
        onClose();
      }
    };

    dialog.addEventListener('cancel', handleCancel);
    dialog.addEventListener('click', handleBackdropClick);

    return () => {
      dialog.removeEventListener('cancel', handleCancel);
      dialog.removeEventListener('click', handleBackdropClick);
    };
  }, [onClose, closeOnOverlayPress]);

  // Determine effective maxWidth
  const effectiveMaxWidth = width || maxWidth;

  // ============================================
  // WEB: HTML5 <dialog> with Portal
  // ============================================
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const dialogContent = (
      <dialog
        ref={dialogRef}
        aria-labelledby={title ? 'dialog-title' : undefined}
        aria-modal="true"
        style={{
          position: 'fixed',
          border: 'none',
          padding: 0,
          margin: 'auto',
          maxWidth: isDesktop ? effectiveMaxWidth : '100%',
          maxHeight: isDesktop ? maxHeight : '90%',
          width: isDesktop ? '90%' : '100%',
          backgroundColor: 'transparent',
          overflow: 'visible',
          // Bottom sheet for mobile
          ...(isDesktop ? {} : {
            bottom: 0,
            top: 'auto',
            marginBottom: 0,
          }),
        }}
      >
        {/* Styled content container */}
        <div
          style={{
            backgroundColor: theme.colors.white,
            borderRadius: isDesktop ? theme.borderRadius.lg : `${theme.borderRadius.lg}px ${theme.borderRadius.lg}px 0 0`,
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: isDesktop ? maxHeight : '90vh',
            pointerEvents: 'auto',
            ...(contentStyle as React.CSSProperties),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          {title && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingLeft: isDesktop ? theme.desktop.section.padding : theme.spacing.lg,
                paddingRight: isDesktop ? theme.desktop.section.padding : theme.spacing.lg,
                paddingTop: isDesktop ? theme.desktop.section.gap : theme.spacing.md,
                paddingBottom: isDesktop ? theme.desktop.section.gap : theme.spacing.md,
                borderBottom: `1px solid ${theme.colors.gray200}`,
              }}
            >
              <h2
                id="dialog-title"
                style={{
                  margin: 0,
                  fontSize: isDesktop ? theme.typography.fontSize.base : theme.typography.fontSize.lg,
                  fontWeight: 600,
                  color: theme.colors.gray900,
                  fontFamily: theme.typography.fontSansSemiBold,
                  flex: 1,
                }}
              >
                {title}
              </h2>
              <button
                onClick={onClose}
                aria-label="Fechar modal"
                style={{
                  padding: isDesktop ? 4 : theme.spacing.sm,
                  marginRight: isDesktop ? -4 : -theme.spacing.sm,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: theme.borderRadius.sm,
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = theme.colors.gray100;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <Ionicons name="close" size={isDesktop ? 20 : 24} color="#6b7280" />
              </button>
            </div>
          )}

          {/* Content */}
          <div
            className="modal-scroll"
            style={{
              padding: isDesktop ? theme.desktop.section.padding : theme.spacing.lg,
              flex: 1,
              pointerEvents: 'auto',
            }}
          >
            {children}
          </div>
        </div>

        {/* Toast inside dialog */}
        {toast && <Toast {...toast} disablePortal />}
      </dialog>
    );

    // Portal to document.body to escape any parent z-index issues
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
      animationType={isDesktop ? 'fade' : 'slide'}
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.overlay}
        onPress={closeOnOverlayPress ? onClose : undefined}
      >
        <Pressable
          style={[
            styles.modalContainer,
            isDesktop ? styles.desktopModal : styles.mobileModal,
            isDesktop && { maxWidth: effectiveMaxWidth, maxHeight: maxHeight as DimensionValue },
            contentStyle,
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          {title && (
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              <TouchableOpacity
                onPress={onClose}
                style={styles.closeButton}
                accessibilityLabel="Fechar modal"
                accessibilityRole="button"
              >
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
          )}

          {/* Content */}
          <View style={styles.content}>{children}</View>
        </Pressable>

        {/* Toast renderizado no overlay (fora do container) para aparecer acima de tudo */}
        {toast && <Toast {...toast} disablePortal={false} />}
      </Pressable>
    </Modal>
  );
}

// Global styles for dialog backdrop and scrollbar (injected once)
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const styleId = 'desktop-modal-backdrop-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      dialog::backdrop {
        background-color: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(2px);
      }
      dialog[open] {
        animation: dialog-fade-in 0.15s ease-out;
      }
      @keyframes dialog-fade-in {
        from {
          opacity: 0;
          transform: scale(0.98);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }
      /* Desktop modal scrollbar - hidden until hover */
      .modal-scroll {
        overflow-x: hidden;
        overflow-y: auto;
        scrollbar-width: thin;
        scrollbar-color: transparent transparent;
      }
      .modal-scroll:hover {
        scrollbar-color: #cbd5e1 transparent;
      }
      .modal-scroll::-webkit-scrollbar {
        width: 8px;
      }
      .modal-scroll::-webkit-scrollbar-track {
        background: transparent;
      }
      .modal-scroll::-webkit-scrollbar-thumb {
        background: transparent;
        border-radius: 4px;
      }
      .modal-scroll:hover::-webkit-scrollbar-thumb {
        background: #cbd5e1;
      }
      .modal-scroll::-webkit-scrollbar-thumb:hover {
        background: #94a3b8;
      }
    `;
    document.head.appendChild(style);
  }
}

const styles = StyleSheet.create((theme: Theme) => ({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    overflow: 'hidden',
  },
  desktopModal: {
    width: '90%',
    alignSelf: 'center',
  },
  mobileModal: {
    width: '100%',
    position: 'absolute',
    bottom: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
  },
  title: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.gray900,
    flex: 1,
  },
  closeButton: {
    padding: theme.spacing.sm,
    marginRight: -theme.spacing.sm,
  },
  content: {
    padding: theme.spacing.lg,
  },
}));
