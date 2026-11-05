import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Linking,
  Platform,
  Pressable,
} from 'react-native';

import { useResponsive } from '@/hooks/useResponsive';
import { boxShadow } from '@/utils/color';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';
import { defaultTheme } from '@/utils/styles.base';

interface SupportModalProps {
  visible: boolean;
  onClose: () => void;
}

// Inject global styles for dialog backdrop (once)
// Uses same animation as DesktopModal for consistency (scale 0.98, blur backdrop)
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const styleId = 'support-modal-backdrop-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      dialog.support-modal-dialog::backdrop {
        background-color: ${defaultTheme.colors.overlay};
        backdrop-filter: blur(2px);
      }
      dialog.support-modal-dialog[open] {
        animation: support-modal-fade-in 0.15s ease-out;
      }
      @keyframes support-modal-fade-in {
        from {
          opacity: 0;
          transform: scale(0.98);
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

export function SupportModal({ visible, onClose }: SupportModalProps) {
  const { theme } = useUnistyles();
  const { isDesktop } = useResponsive();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const scrollPositionRef = useRef(0);

  const handleCall = () => {
    const phoneNumber = '83987156206';
    const url = `tel:${phoneNumber}`;

    Linking.canOpenURL(url).then((supported) => {
      if (supported) {
        Linking.openURL(url);
      }
    });
  };

  const handleEmail = () => {
    const email = 'contato@rotamestre.tec.br';
    const url = `mailto:${email}`;

    Linking.canOpenURL(url).then((supported) => {
      if (supported) {
        Linking.openURL(url);
      }
    });
  };

  const handleWhatsApp = () => {
    const phoneNumber = '5583987156206';
    const message = 'Olá! Preciso de ajuda com o RotaMestre.';
    const url = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;

    Linking.canOpenURL(url).then((supported) => {
      if (supported) {
        Linking.openURL(url);
      }
    });
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

  // ============================================
  // WEB: HTML5 <dialog> with Portal
  // ============================================
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const dialogContent = (
      <dialog
        ref={dialogRef}
        className="support-modal-dialog"
        aria-labelledby="support-modal-title"
        aria-modal="true"
        style={{
          position: 'fixed',
          border: 'none',
          padding: 0,
          margin: 'auto',
          maxWidth: isDesktop ? 340 : 400,
          width: '90%',
          backgroundColor: 'transparent',
          overflow: 'visible',
        }}
      >
        <div
          style={{
            backgroundColor: theme.colors.white,
            borderRadius: theme.borderRadius.lg, // Consistent with DesktopModal
            boxShadow: boxShadow(0, 25, 50, -12, theme.colors.black, 0.25),
            overflow: 'hidden',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              paddingTop: isDesktop ? theme.spacing['4'] : theme.spacing['6'],
              paddingLeft: isDesktop ? theme.spacing['4'] : theme.spacing['6'],
              paddingRight: isDesktop ? theme.spacing['4'] : theme.spacing['6'],
              paddingBottom: isDesktop ? theme.spacing['3'] : theme.spacing['4'],
              borderBottom: `1px solid ${theme.colors.border}`,
            }}
          >
            <div
              style={{
                width: isDesktop ? 52 : 64,
                height: isDesktop ? 52 : 64,
                borderRadius: isDesktop ? 26 : 32,
                backgroundColor: theme.colors.indigo100,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: isDesktop ? theme.spacing['2.5'] : theme.spacing['3'],
              }}
            >
              <Ionicons name="help-circle" size={isDesktop ? 26 : 32} color={theme.colors.primary} />
            </div>
            <h2
              id="support-modal-title"
              style={{
                margin: 0,
                fontSize: isDesktop ? 18 : 20,
                fontWeight: 700,
                color: theme.colors.gray900,
                marginBottom: theme.spacing['1'],
              }}
            >
              Central de Ajuda
            </h2>
            <p style={{ margin: 0, fontSize: isDesktop ? 13 : 14, color: theme.colors.gray500, textAlign: 'center' }}>
              Como podemos ajudar você?
            </p>
          </div>

          {/* Contact Options */}
          <div style={{ padding: isDesktop ? theme.spacing['3'] : theme.spacing['4'] }}>
            <button
              className="support-contact-option"
              onClick={handleWhatsApp}
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                padding: isDesktop ? theme.spacing['3'] : theme.spacing['4'],
                backgroundColor: theme.colors.gray50,
                borderRadius: isDesktop ? theme.borderRadius.md : theme.borderRadius.lg,
                marginBottom: isDesktop ? theme.spacing['2.5'] : theme.spacing['3'],
                border: 'none',
                width: '100%',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.gray100;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.gray50;
              }}
            >
              <div
                style={{
                  width: isDesktop ? 40 : 48,
                  height: isDesktop ? 40 : 48,
                  borderRadius: isDesktop ? 20 : 24,
                  backgroundColor: theme.colors.success,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: isDesktop ? theme.spacing['2.5'] : theme.spacing['3'],
                }}
              >
                <Ionicons name="logo-whatsapp" size={isDesktop ? 20 : 24} color={theme.colors.white} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: isDesktop ? 11 : 12, color: theme.colors.gray500, marginBottom: theme.spacing['0.5'] }}>WhatsApp</div>
                <div style={{ fontSize: isDesktop ? 13 : 14, fontWeight: 600, color: theme.colors.gray900 }}>(83) 98715-6206</div>
              </div>
              <Ionicons name="chevron-forward" size={isDesktop ? 18 : 20} color={theme.colors.gray400} />
            </button>

            <button
              className="support-contact-option"
              onClick={handleCall}
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                padding: isDesktop ? theme.spacing['3'] : theme.spacing['4'],
                backgroundColor: theme.colors.gray50,
                borderRadius: isDesktop ? theme.borderRadius.md : theme.borderRadius.lg,
                marginBottom: isDesktop ? theme.spacing['2.5'] : theme.spacing['3'],
                border: 'none',
                width: '100%',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.gray100;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.gray50;
              }}
            >
              <div
                style={{
                  width: isDesktop ? 40 : 48,
                  height: isDesktop ? 40 : 48,
                  borderRadius: isDesktop ? 20 : 24,
                  backgroundColor: theme.colors.primary,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: isDesktop ? theme.spacing['2.5'] : theme.spacing['3'],
                }}
              >
                <Ionicons name="call" size={isDesktop ? 20 : 24} color={theme.colors.white} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: isDesktop ? 11 : 12, color: theme.colors.gray500, marginBottom: theme.spacing['0.5'] }}>Telefone</div>
                <div style={{ fontSize: isDesktop ? 13 : 14, fontWeight: 600, color: theme.colors.gray900 }}>(83) 98715-6206</div>
              </div>
              <Ionicons name="chevron-forward" size={isDesktop ? 18 : 20} color={theme.colors.gray400} />
            </button>

            <button
              className="support-contact-option"
              onClick={handleEmail}
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                padding: isDesktop ? theme.spacing['3'] : theme.spacing['4'],
                backgroundColor: theme.colors.gray50,
                borderRadius: isDesktop ? theme.borderRadius.md : theme.borderRadius.lg,
                border: 'none',
                width: '100%',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.gray100;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.gray50;
              }}
            >
              <div
                style={{
                  width: isDesktop ? 40 : 48,
                  height: isDesktop ? 40 : 48,
                  borderRadius: isDesktop ? 20 : 24,
                  backgroundColor: theme.colors.error,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: isDesktop ? theme.spacing['2.5'] : theme.spacing['3'],
                }}
              >
                <Ionicons name="mail" size={isDesktop ? 20 : 24} color={theme.colors.white} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: isDesktop ? 11 : 12, color: theme.colors.gray500, marginBottom: theme.spacing['0.5'] }}>E-mail</div>
                <div style={{ fontSize: isDesktop ? 13 : 14, fontWeight: 600, color: theme.colors.gray900 }}>contato@rotamestre.tec.br</div>
              </div>
              <Ionicons name="chevron-forward" size={isDesktop ? 18 : 20} color={theme.colors.gray400} />
            </button>
          </div>

          {/* Footer */}
          <div style={{ padding: isDesktop ? theme.spacing['3'] : theme.spacing['4'], borderTop: `1px solid ${theme.colors.border}` }}>
            <button
              onClick={onClose}
              style={{
                width: '100%',
                backgroundColor: theme.colors.gray100,
                paddingTop: isDesktop ? theme.spacing['2.5'] : theme.spacing['3'],
                paddingBottom: isDesktop ? theme.spacing['2.5'] : theme.spacing['3'],
                borderRadius: theme.borderRadius.sm,
                border: 'none',
                cursor: 'pointer',
                fontSize: isDesktop ? 14 : 16,
                fontWeight: 600,
                color: theme.colors.gray700,
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.gray200;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.gray100;
              }}
            >
              Fechar
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
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.overlay}
        onPress={onClose}
      >
        <Pressable
          style={styles.modalContainer}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons name="help-circle" size={32} color={theme.colors.primary} />
            </View>
            <Text style={styles.title}>Central de Ajuda</Text>
            <Text style={styles.subtitle}>Como podemos ajudar você?</Text>
          </View>

          {/* Contact Options */}
          <View style={styles.content}>
            <TouchableOpacity style={styles.contactOption} onPress={handleWhatsApp}>
              <View style={[styles.contactIcon, { backgroundColor: theme.colors.success }]}>
                <Ionicons name="logo-whatsapp" size={24} color={theme.colors.white} />
              </View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactLabel}>WhatsApp</Text>
                <Text style={styles.contactValue}>(83) 98715-6206</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.gray400} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.contactOption} onPress={handleCall}>
              <View style={[styles.contactIcon, { backgroundColor: theme.colors.primary }]}>
                <Ionicons name="call" size={24} color={theme.colors.white} />
              </View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactLabel}>Telefone</Text>
                <Text style={styles.contactValue}>(83) 98715-6206</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.gray400} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.contactOption} onPress={handleEmail}>
              <View style={[styles.contactIcon, { backgroundColor: theme.colors.error }]}>
                <Ionicons name="mail" size={24} color={theme.colors.white} />
              </View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactLabel}>E-mail</Text>
                <Text style={styles.contactValue}>contato@rotamestre.tec.br</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.gray400} />
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>Fechar</Text>
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
  },
  modalContainer: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg, // Consistent with DesktopModal
    width: '90%',
    maxWidth: 400,
    ...theme.shadows.lg,
  },
  header: {
    alignItems: 'center',
    paddingTop: theme.spacing.xl,
    paddingHorizontal: theme.spacing.xl,
    paddingBottom: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.indigo100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  title: {
    fontSize: theme.typography.fontSize.xl,
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.gray900,
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray500,
    textAlign: 'center',
  },
  content: {
    padding: theme.spacing.lg,
  },
  contactOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.gray50,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.md,
  },
  contactIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  contactInfo: {
    flex: 1,
  },
  contactLabel: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray500,
    marginBottom: theme.spacing.xs / 2,
  },
  contactValue: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
  },
  footer: {
    padding: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  closeButton: {
    backgroundColor: theme.colors.gray100,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray700,
  },
}));
