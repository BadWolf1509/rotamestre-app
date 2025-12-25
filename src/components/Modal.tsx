/**
 * ============================================
 * Modal - Componente de Modal Reutilizável
 * ============================================
 *
 * Modal customizável com overlay, animações e variantes.
 * Usa design tokens para cores, sombras e espaçamento.
 *
 * Web: Usa HTML5 <dialog> nativo com:
 *   - Focus trap automático
 *   - ESC para fechar nativo
 *   - ::backdrop CSS
 *   - Portal para document.body
 *
 * Mobile: Usa React Native Modal
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Modal as RNModal,
  View,
  Text,
  TouchableOpacity,
  ViewStyle,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';

import { useResponsive } from '@/hooks/useResponsive';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';


type ModalSize = 'small' | 'medium' | 'large' | 'full';

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: ModalSize;
  showCloseButton?: boolean;
  animationType?: 'none' | 'slide' | 'fade';
  transparent?: boolean;
  style?: ViewStyle;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Inject global styles for dialog backdrop (once)
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const styleId = 'modal-backdrop-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      dialog.modal-dialog::backdrop {
        background-color: rgba(0, 0, 0, 0.8);
      }
      dialog.modal-dialog[open] {
        animation: modal-fade-in 0.3s ease-out;
      }
      @keyframes modal-fade-in {
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

export function Modal({
  visible,
  onClose,
  title,
  children,
  size = 'medium',
  showCloseButton = true,
  animationType = 'fade',
  transparent = true,
  style,
}: ModalProps) {
  const { theme } = useUnistyles();
  const { isDesktop } = useResponsive();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const scrollPositionRef = useRef(0);

  const getModalWidth = (): string | number => {
    switch (size) {
      case 'small':
        return 400;
      case 'medium':
        return 600;
      case 'large':
        return 900;
      case 'full':
        return '100%';
      default:
        return 600;
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
      onClose();
    };

    const handleBackdropClick = (e: MouseEvent) => {
      if (e.target === dialog) {
        onClose();
      }
    };

    dialog.addEventListener('cancel', handleCancel);
    dialog.addEventListener('click', handleBackdropClick);

    return () => {
      dialog.removeEventListener('cancel', handleCancel);
      dialog.removeEventListener('click', handleBackdropClick);
    };
  }, [onClose]);

  // Mobile animations
  useEffect(() => {
    if (Platform.OS === 'web') return;

    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 20,
          stiffness: 90,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [fadeAnim, slideAnim, visible]);

  // ============================================
  // WEB: HTML5 <dialog> with Portal
  // ============================================
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const modalWidth = getModalWidth();
    const isFull = size === 'full';

    const dialogContent = (
      <dialog
        ref={dialogRef}
        className="modal-dialog"
        aria-labelledby={title ? 'modal-title' : undefined}
        aria-modal="true"
        style={{
          position: 'fixed',
          border: 'none',
          padding: 0,
          margin: 'auto',
          maxWidth: isFull ? '100%' : modalWidth,
          width: isFull ? '100%' : '90%',
          maxHeight: isFull ? '100%' : '80%',
          backgroundColor: 'transparent',
          overflow: 'visible',
          ...(isFull ? { top: 0, left: 0, right: 0, bottom: 0 } : {}),
        }}
      >
        <div
          style={{
            backgroundColor: theme.colors.white,
            borderRadius: isFull ? 0 : theme.borderRadius.xl,
            boxShadow: isFull ? 'none' : '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: isFull ? '100vh' : '80vh',
            height: isFull ? '100vh' : 'auto',
            ...(style as React.CSSProperties),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          {(title || showCloseButton) && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingLeft: isDesktop ? theme.desktop.modal.headerPadding : theme.spacing.md,
                paddingRight: isDesktop ? theme.desktop.modal.headerPadding : theme.spacing.md,
                paddingTop: isDesktop ? 10 : theme.spacing.md,
                paddingBottom: isDesktop ? 10 : theme.spacing.sm,
                borderBottom: `1px solid ${theme.colors.gray200}`,
              }}
            >
              {title ? (
                <h2
                  id="modal-title"
                  style={{
                    margin: 0,
                    fontFamily: theme.typography.fontSansBold,
                    fontSize: isDesktop ? theme.desktop.modal.titleFontSize : theme.typography.fontSize.base,
                    lineHeight: `${(isDesktop ? theme.desktop.modal.titleFontSize : theme.typography.fontSize.base) * 1.5}px`,
                    color: theme.colors.gray900,
                    flex: 1,
                  }}
                >
                  {title}
                </h2>
              ) : (
                <div style={{ flex: 1 }} />
              )}
              {showCloseButton && (
                <button
                  onClick={onClose}
                  aria-label="Fechar modal"
                  style={{
                    padding: theme.spacing.xs,
                    marginLeft: theme.spacing.sm,
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
                  <Ionicons name="close" size={isDesktop ? theme.desktop.modal.closeButtonSize : 24} color={theme.colors.gray500} />
                </button>
              )}
            </div>
          )}

          {/* Content */}
          <div
            style={{
              padding: isDesktop ? theme.desktop.modal.bodyPadding : theme.spacing.md,
              overflow: 'auto',
              flex: 1,
            }}
          >
            {children}
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
    <RNModal
      visible={visible}
      transparent={transparent}
      animationType={animationType === 'none' ? 'none' : undefined}
      onRequestClose={onClose}
    >
      {/* Overlay */}
      <Animated.View
        style={[
          styles.overlay,
          {
            opacity: fadeAnim,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.overlayTouchable}
          activeOpacity={1}
          onPress={onClose}
        />
      </Animated.View>

      {/* Modal Content */}
      <View style={styles.container}>
        <Animated.View
          style={[
            styles.modal,
            {
              width: getModalWidth() as any,
              transform: [{ translateY: animationType === 'slide' ? slideAnim : 0 }],
              opacity: animationType === 'fade' ? fadeAnim : 1,
            },
            size === 'full' && styles.fullModal,
            style,
          ]}
        >
          {/* Header */}
          {(title || showCloseButton) && (
            <View style={styles.header}>
              {title ? <Text style={styles.title}>{title}</Text> : <View style={{ flex: 1 }} />}
              {showCloseButton && (
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={onClose}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={24} color={theme.colors.gray500} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Content */}
          <View style={styles.content}>{children}</View>
        </Animated.View>
      </View>
    </RNModal>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    zIndex: 30,
  },
  overlayTouchable: {
    flex: 1,
  },

  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 31,
  },

  modal: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.xl,
    maxHeight: '80%',
    ...theme.shadows.lg,
  },
  fullModal: {
    width: '100%',
    height: '100%',
    maxHeight: '100%',
    borderRadius: 0,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
  },

  title: {
    fontFamily: theme.typography.fontSansBold,
    fontSize: theme.typography.fontSize.base,
    lineHeight: theme.typography.fontSize.base * 1.5,
    color: theme.colors.gray900,
    flex: 1,
  },

  closeButton: {
    padding: theme.spacing.xs,
    marginLeft: theme.spacing.sm,
  },

  content: {
    padding: theme.spacing.md,
  },
}));

// Export default para facilitar import
export default Modal;

/**
 * ============================================
 * EXEMPLOS DE USO
 * ============================================
 *
 * import Modal from '@/components/Modal';
 * import { Button } from '@/components/Button';
 *
 * // Modal básico
 * const [visible, setVisible] = useState(false);
 *
 * <Modal
 *   visible={visible}
 *   onClose={() => setVisible(false)}
 *   title="Confirmar Ação"
 * >
 *   <Text>Tem certeza que deseja continuar?</Text>
 *   <Button title="Confirmar" onPress={() => setVisible(false)} />
 * </Modal>
 *
 * // Modal pequeno
 * <Modal
 *   visible={visible}
 *   onClose={() => setVisible(false)}
 *   size="small"
 *   title="Aviso"
 * >
 *   <Text>Operação concluída com sucesso!</Text>
 * </Modal>
 *
 * // Modal grande
 * <Modal
 *   visible={visible}
 *   onClose={() => setVisible(false)}
 *   size="large"
 *   title="Detalhes da Rota"
 * >
 *   <ScrollView>
 *     // Conteúdo grande
 *   </ScrollView>
 * </Modal>
 *
 * // Modal full screen
 * <Modal
 *   visible={visible}
 *   onClose={() => setVisible(false)}
 *   size="full"
 *   title="Editor"
 * >
 *   // Conteúdo que precisa de tela cheia
 * </Modal>
 *
 * // Modal sem botão de fechar
 * <Modal
 *   visible={visible}
 *   onClose={() => {}}
 *   showCloseButton={false}
 * >
 *   <Text>Carregando...</Text>
 * </Modal>
 *
 * // Modal com animação de slide
 * <Modal
 *   visible={visible}
 *   onClose={() => setVisible(false)}
 *   animationType="slide"
 *   title="Nova Rota"
 * >
 *   // Formulário
 * </Modal>
 *
 * // Modal com conteúdo customizado
 * <Modal
 *   visible={visible}
 *   onClose={() => setVisible(false)}
 *   title="Filtros"
 * >
 *   <Input label="Data" />
 *   <Input label="Status" />
 *   <Button title="Aplicar Filtros" onPress={applyFilters} />
 * </Modal>
 */
