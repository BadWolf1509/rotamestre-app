import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Modal, View, Text, TouchableOpacity, Pressable, ViewStyle, DimensionValue, Platform, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useResponsive } from '@/hooks/useResponsive';
import { boxShadow, withOpacity } from '@/utils/color';
import { StyleSheet, defaultTheme, useUnistyles, type Theme } from '@/utils/styles';

import { Toast, type ToastProps } from '../Toast';

/**
 * Configuração de botão para o footer do modal
 * API declarativa para botões padronizados com estilos consistentes
 */
export interface ModalButtonConfig {
  /** Texto do botão */
  text: string;
  /** Callback ao pressionar */
  onPress: () => void;
  /** Estado de loading (exibe spinner e desabilita) */
  loading?: boolean;
  /** Estado desabilitado */
  disabled?: boolean;
  /** Variante visual (primary = azul preenchido, secondary = outline cinza) */
  variant?: 'primary' | 'secondary';
  /** Cor customizada do botão (sobrescreve a cor padrão do primary) */
  color?: string;
}

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
 * Estrutura do Modal:
 *   - Header: título + botão fechar (opcional via prop title)
 *   - Body: conteúdo scrollável (children)
 *   - Footer: botões de ação fora do scroll (opcional via prop footer)
 *
 * Padrão usado por: Stripe, Linear, Vercel
 *
 * @example Botões via Props (recomendado)
 * <DesktopModal
 *   visible={showModal}
 *   title="Adicionar Parada"
 *   onClose={() => setShowModal(false)}
 *   primaryButton={{ text: "Salvar", onPress: onSave, loading: isSaving }}
 *   secondaryButton={{ text: "Cancelar", onPress: onCancel }}
 * >
 *   <Form />
 * </DesktopModal>
 *
 * @example Footer Customizado (casos especiais)
 * <DesktopModal
 *   visible={showModal}
 *   title="Confirmar"
 *   onClose={() => setShowModal(false)}
 *   footer={<CustomFooterContent />}
 * >
 *   <Content />
 * </DesktopModal>
 *
 * @example Modal Simples (sem footer)
 * <DesktopModal
 *   visible={showModal}
 *   title="Detalhes"
 *   onClose={() => setShowModal(false)}
 * >
 *   <Content />
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
  /** Footer do modal (botões de ação) - renderizado fora do scroll */
  footer?: React.ReactNode;
  /**
   * Botão primário (ação principal) - API declarativa recomendada
   * Estilos padronizados: azul preenchido, tamanho compacto no desktop
   */
  primaryButton?: ModalButtonConfig;
  /**
   * Botão secundário (cancelar/voltar) - API declarativa recomendada
   * Estilos padronizados: outline cinza, tamanho compacto no desktop
   */
  secondaryButton?: ModalButtonConfig;
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
  footer,
  primaryButton,
  secondaryButton,
  maxWidth = 600,
  width,
  maxHeight = '80%',
  closeOnOverlayPress = true,
  contentStyle,
  toast,
}: DesktopModalProps) {
  const { isDesktop } = useResponsive();
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const scrollPositionRef = useRef(0);

  // Determina se deve renderizar footer com botões declarativos
  const hasDeclarativeButtons = primaryButton || secondaryButton;
  // Footer declarativo tem precedência sobre footer customizado
  const shouldRenderFooter = hasDeclarativeButtons || footer;

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
  // BUTTON RENDERING (Declarative API)
  // ============================================

  /**
   * Renderiza um botão para Web com estilos padronizados
   * Usa design tokens do theme para garantir consistência
   */
  const renderWebButton = (config: ModalButtonConfig, isPrimary: boolean) => {
    const isDisabled = config.disabled || config.loading;
    const baseStyles: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing['1.5'],
      borderRadius: theme.borderRadius.sm,
      fontFamily: theme.typography.fontSansSemiBold,
      cursor: isDisabled ? 'not-allowed' : 'pointer',
      transition: 'all 0.15s ease',
      border: 'none',
      outline: 'none',
      // Desktop compact vs Mobile
      height: isDesktop ? theme.desktop.button.height : 44,
      paddingLeft: isDesktop ? theme.desktop.button.paddingHorizontal : theme.spacing.lg,
      paddingRight: isDesktop ? theme.desktop.button.paddingHorizontal : theme.spacing.lg,
      fontSize: isDesktop ? theme.desktop.button.fontSize : theme.typography.sm,
      minWidth: isDesktop ? 80 : 100,
      opacity: isDisabled ? 0.6 : 1,
    };

    // Usar cor customizada ou cor padrão primary
    const buttonColor = config.color || theme.colors.primary;

    const primaryStyles: React.CSSProperties = {
      ...baseStyles,
      backgroundColor: buttonColor,
      color: theme.colors.white,
    };

    const secondaryStyles: React.CSSProperties = {
      ...baseStyles,
      backgroundColor: 'transparent',
      color: theme.colors.gray600,
      border: `1px solid ${theme.colors.gray300}`,
    };

    const buttonStyle = isPrimary ? primaryStyles : secondaryStyles;

    return (
      <button
        key={isPrimary ? 'primary' : 'secondary'}
        onClick={isDisabled ? undefined : config.onPress}
        disabled={isDisabled}
        style={buttonStyle}
        onMouseEnter={(e) => {
          if (isDisabled) return;
          if (isPrimary) {
            // Escurecer a cor do botão no hover
            e.currentTarget.style.filter = 'brightness(0.9)';
          } else {
            e.currentTarget.style.backgroundColor = theme.colors.gray100;
          }
        }}
        onMouseLeave={(e) => {
          if (isDisabled) return;
          if (isPrimary) {
            e.currentTarget.style.filter = 'none';
          } else {
            e.currentTarget.style.backgroundColor = 'transparent';
          }
        }}
      >
        {config.loading && (
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              border: `2px solid ${isPrimary ? withOpacity(theme.colors.white, 0.3) : withOpacity(theme.colors.black, 0.2)}`,
              borderTopColor: isPrimary ? theme.colors.white : theme.colors.gray600,
              animation: 'spin 0.8s linear infinite',
            }}
          />
        )}
        {config.text}
      </button>
    );
  };

  /**
   * Renderiza um botão para React Native com estilos padronizados
   */
  const renderNativeButton = (config: ModalButtonConfig, isPrimary: boolean) => {
    const isDisabled = config.disabled || config.loading;
    // Usar cor customizada ou cor padrão primary
    const buttonColor = config.color || theme.colors.primary;

    return (
      <TouchableOpacity
        key={isPrimary ? 'primary' : 'secondary'}
        onPress={isDisabled ? undefined : config.onPress}
        disabled={isDisabled}
        style={[
          styles.footerButton,
          isPrimary ? [styles.primaryButton, { backgroundColor: buttonColor }] : styles.secondaryButton,
          isDisabled && styles.buttonDisabled,
        ]}
        activeOpacity={0.7}
      >
        {config.loading && (
          <ActivityIndicator
            size="small"
            color={isPrimary ? theme.colors.white : theme.colors.gray600}
            style={{ marginRight: theme.spacing['1.5'] }}
          />
        )}
        <Text
          style={[
            styles.footerButtonText,
            isPrimary ? styles.primaryButtonText : styles.secondaryButtonText,
          ]}
        >
          {config.text}
        </Text>
      </TouchableOpacity>
    );
  };

  /**
   * Renderiza o conteúdo do footer (botões declarativos ou footer customizado)
   */
  const renderFooterContent = (forWeb: boolean) => {
    if (hasDeclarativeButtons) {
      const buttons = [];
      if (secondaryButton) {
        buttons.push(forWeb
          ? renderWebButton(secondaryButton, false)
          : renderNativeButton(secondaryButton, false)
        );
      }
      if (primaryButton) {
        buttons.push(forWeb
          ? renderWebButton(primaryButton, true)
          : renderNativeButton(primaryButton, true)
        );
      }
      return buttons;
    }
    return footer;
  };

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
            boxShadow: [
              boxShadow(0, 20, 25, -5, theme.colors.black, 0.1),
              boxShadow(0, 10, 10, -5, theme.colors.black, 0.04),
            ].join(', '),
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
                  padding: isDesktop ? theme.spacing['1'] : theme.spacing.sm,
                  marginRight: isDesktop ? -theme.spacing['1'] : -theme.spacing.sm,
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
                <Ionicons name="close" size={isDesktop ? 20 : 24} color={theme.colors.gray500} />
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
              overflowY: 'auto',
            }}
          >
            {children}
          </div>

          {/* Footer */}
          {shouldRenderFooter && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: isDesktop ? theme.desktop.modal.footerGap : theme.spacing.md,
                padding: isDesktop ? theme.desktop.modal.footerPadding : theme.spacing.lg,
                backgroundColor: theme.colors.gray50,
                borderTop: 'none',
                flexShrink: 0,
              }}
            >
              {renderFooterContent(true)}
            </div>
          )}
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
            // No mobile, eleva o modal para ficar acima da navigation bar do Android
            // Usa Math.max para garantir mínimo de 34px (Android 15 pode retornar insets.bottom = 0)
            !isDesktop && { bottom: Math.max(insets.bottom, 34) },
            contentStyle,
          ]}
          onPress={(e) => e?.stopPropagation?.()}
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
                <Ionicons name="close" size={24} color={theme.colors.gray500} />
              </TouchableOpacity>
            </View>
          )}

          {/* Content */}
          <View style={styles.content}>{children}</View>

          {/* Footer */}
          {shouldRenderFooter && (
            <View style={styles.footer}>
              {renderFooterContent(false)}
            </View>
          )}
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
    const scrollbarThumb = defaultTheme.colors.gray300;
    const scrollbarThumbHover = defaultTheme.colors.gray400;
    style.textContent = `
      dialog::backdrop {
        background-color: ${defaultTheme.colors.overlay};
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
        scrollbar-color: ${scrollbarThumb} transparent;
      }
      .modal-scroll::-webkit-scrollbar {
        width: 8px;
      }
      .modal-scroll::-webkit-scrollbar-track {
        background: transparent;
      }
      .modal-scroll::-webkit-scrollbar-thumb {
        background: transparent;
        border-radius: ${defaultTheme.borderRadius.xs}px;
      }
      .modal-scroll:hover::-webkit-scrollbar-thumb {
        background: ${scrollbarThumb};
      }
      .modal-scroll::-webkit-scrollbar-thumb:hover {
        background: ${scrollbarThumbHover};
      }
      /* Spinner animation for loading buttons */
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }
}

const styles = StyleSheet.create((theme: Theme) => ({
  overlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    ...theme.shadows.lg,
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
    top: '10%',
    bottom: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    // bottom é sobrescrito dinamicamente com Math.max(insets.bottom, 34)
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
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
    flex: 1,
  },
  closeButton: {
    padding: theme.spacing.sm,
    marginRight: -theme.spacing.sm,
  },
  content: {
    flex: 1,
    padding: theme.spacing.lg,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.gray50,
  },
  // Estilos para botões declarativos (React Native)
  footerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.sm,
    minWidth: 100,
    height: 44,
    paddingHorizontal: theme.spacing.lg,
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.gray300,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  footerButtonText: {
    fontFamily: theme.typography.fontSansSemiBold,
    fontSize: theme.typography.fontSize.sm,
  },
  primaryButtonText: {
    color: theme.colors.white,
  },
  secondaryButtonText: {
    color: theme.colors.gray600,
  },
}));
