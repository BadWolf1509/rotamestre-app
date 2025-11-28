import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, View, Text, TouchableOpacity, Pressable, ViewStyle, DimensionValue } from 'react-native';

import { useResponsive } from '@/hooks/useResponsive';
import { StyleSheet, type Theme } from '@/utils/styles';

/**
 * DesktopModal - Modal responsivo adaptativo
 *
 * Desktop (≥1024px): Modal centralizado com overlay
 * Mobile/Tablet (<1024px): Bottom sheet (slide from bottom)
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
}: DesktopModalProps) {
  const { isDesktop } = useResponsive();

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
            isDesktop && { maxWidth: width || maxWidth, maxHeight: maxHeight as DimensionValue },
            contentStyle,
          ]}
          onPress={(e) => e.stopPropagation()} // Previne fechar ao clicar dentro
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
    marginRight: -theme.spacing.sm, // Compensar padding para alinhar à borda
  },
  content: {
    padding: theme.spacing.lg,
  },
}));
