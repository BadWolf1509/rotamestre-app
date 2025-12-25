import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Platform,
  Pressable,
} from 'react-native';

import { useResponsive } from '@/hooks/useResponsive';
import { useUnistyles } from '@/utils/styles';

interface SupportModalProps {
  visible: boolean;
  onClose: () => void;
}

// Inject global styles for dialog backdrop (once)
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const styleId = 'support-modal-backdrop-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      dialog.support-modal-dialog::backdrop {
        background-color: rgba(0, 0, 0, 0.5);
      }
      dialog.support-modal-dialog[open] {
        animation: support-modal-fade-in 0.2s ease-out;
      }
      @keyframes support-modal-fade-in {
        from {
          opacity: 0;
          transform: scale(0.95);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }
      .support-contact-option {
        transition: background-color 0.2s;
      }
      .support-contact-option:hover {
        background-color: #f3f4f6 !important;
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
            backgroundColor: '#fff',
            borderRadius: 16,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
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
              paddingTop: isDesktop ? 16 : 24,
              paddingLeft: isDesktop ? 16 : 24,
              paddingRight: isDesktop ? 16 : 24,
              paddingBottom: isDesktop ? 12 : 16,
              borderBottom: '1px solid #e5e7eb',
            }}
          >
            <div
              style={{
                width: isDesktop ? 52 : 64,
                height: isDesktop ? 52 : 64,
                borderRadius: isDesktop ? 26 : 32,
                backgroundColor: '#e0e7ff',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: isDesktop ? 10 : 12,
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
                color: '#111827',
                marginBottom: 4,
              }}
            >
              Central de Ajuda
            </h2>
            <p style={{ margin: 0, fontSize: isDesktop ? 13 : 14, color: '#6b7280', textAlign: 'center' }}>
              Como podemos ajudar você?
            </p>
          </div>

          {/* Contact Options */}
          <div style={{ padding: isDesktop ? 12 : 16 }}>
            <button
              className="support-contact-option"
              onClick={handleWhatsApp}
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                padding: isDesktop ? 12 : 16,
                backgroundColor: '#f9fafb',
                borderRadius: isDesktop ? 10 : 12,
                marginBottom: isDesktop ? 10 : 12,
                border: 'none',
                width: '100%',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div
                style={{
                  width: isDesktop ? 40 : 48,
                  height: isDesktop ? 40 : 48,
                  borderRadius: isDesktop ? 20 : 24,
                  backgroundColor: '#25D366',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: isDesktop ? 10 : 12,
                }}
              >
                <Ionicons name="logo-whatsapp" size={isDesktop ? 20 : 24} color="#fff" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: isDesktop ? 11 : 12, color: '#6b7280', marginBottom: 2 }}>WhatsApp</div>
                <div style={{ fontSize: isDesktop ? 13 : 14, fontWeight: 600, color: '#111827' }}>(83) 98715-6206</div>
              </div>
              <Ionicons name="chevron-forward" size={isDesktop ? 18 : 20} color="#9ca3af" />
            </button>

            <button
              className="support-contact-option"
              onClick={handleCall}
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                padding: isDesktop ? 12 : 16,
                backgroundColor: '#f9fafb',
                borderRadius: isDesktop ? 10 : 12,
                marginBottom: isDesktop ? 10 : 12,
                border: 'none',
                width: '100%',
                cursor: 'pointer',
                textAlign: 'left',
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
                  marginRight: isDesktop ? 10 : 12,
                }}
              >
                <Ionicons name="call" size={isDesktop ? 20 : 24} color="#fff" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: isDesktop ? 11 : 12, color: '#6b7280', marginBottom: 2 }}>Telefone</div>
                <div style={{ fontSize: isDesktop ? 13 : 14, fontWeight: 600, color: '#111827' }}>(83) 98715-6206</div>
              </div>
              <Ionicons name="chevron-forward" size={isDesktop ? 18 : 20} color="#9ca3af" />
            </button>

            <button
              className="support-contact-option"
              onClick={handleEmail}
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                padding: isDesktop ? 12 : 16,
                backgroundColor: '#f9fafb',
                borderRadius: isDesktop ? 10 : 12,
                border: 'none',
                width: '100%',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div
                style={{
                  width: isDesktop ? 40 : 48,
                  height: isDesktop ? 40 : 48,
                  borderRadius: isDesktop ? 20 : 24,
                  backgroundColor: '#ea4335',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: isDesktop ? 10 : 12,
                }}
              >
                <Ionicons name="mail" size={isDesktop ? 20 : 24} color="#fff" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: isDesktop ? 11 : 12, color: '#6b7280', marginBottom: 2 }}>E-mail</div>
                <div style={{ fontSize: isDesktop ? 13 : 14, fontWeight: 600, color: '#111827' }}>contato@rotamestre.tec.br</div>
              </div>
              <Ionicons name="chevron-forward" size={isDesktop ? 18 : 20} color="#9ca3af" />
            </button>
          </div>

          {/* Footer */}
          <div style={{ padding: isDesktop ? 12 : 16, borderTop: '1px solid #e5e7eb' }}>
            <button
              onClick={onClose}
              style={{
                width: '100%',
                backgroundColor: '#f3f4f6',
                paddingTop: isDesktop ? 10 : 12,
                paddingBottom: isDesktop ? 10 : 12,
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                fontSize: isDesktop ? 14 : 16,
                fontWeight: 600,
                color: '#374151',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#e5e7eb';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#f3f4f6';
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
              <View style={[styles.contactIcon, { backgroundColor: '#25D366' }]}>
                <Ionicons name="logo-whatsapp" size={24} color="#fff" />
              </View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactLabel}>WhatsApp</Text>
                <Text style={styles.contactValue}>(83) 98715-6206</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.contactOption} onPress={handleCall}>
              <View style={[styles.contactIcon, { backgroundColor: theme.colors.primary }]}>
                <Ionicons name="call" size={24} color="#fff" />
              </View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactLabel}>Telefone</Text>
                <Text style={styles.contactValue}>(83) 98715-6206</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.contactOption} onPress={handleEmail}>
              <View style={[styles.contactIcon, { backgroundColor: '#ea4335' }]}>
                <Ionicons name="mail" size={24} color="#fff" />
              </View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactLabel}>E-mail</Text>
                <Text style={styles.contactValue}>contato@rotamestre.tec.br</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
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

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  header: {
    alignItems: 'center',
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#e0e7ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  content: {
    padding: 16,
  },
  contactOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    marginBottom: 12,
  },
  contactIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contactInfo: {
    flex: 1,
  },
  contactLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 2,
  },
  contactValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  closeButton: {
    backgroundColor: '#f3f4f6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
});
