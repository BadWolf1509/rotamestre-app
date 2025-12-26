import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Platform } from 'react-native';

import { DesktopModal } from '@/components/desktop/DesktopModal';
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
  /**
   * Texto que o usuário deve digitar para confirmar ações destrutivas.
   * Quando fornecido, o botão de confirmar só é habilitado após digitar o texto exato.
   * @example destructiveConfirmText="EXCLUIR"
   */
  destructiveConfirmText?: string;
}

// Mapeamento de type para nome do ícone Ionicons
const ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
  danger: 'trash-outline',
  warning: 'warning-outline',
  success: 'checkmark-circle-outline',
  info: 'information-circle-outline',
};

// Mapeamento de type para label de acessibilidade
const ACCESSIBILITY_LABEL_MAP: Record<string, string> = {
  danger: 'Ação destrutiva',
  warning: 'Aviso',
  success: 'Sucesso',
  info: 'Informação',
};

/**
 * Modal de confirmação customizado com design system
 *
 * Usa DesktopModal internamente com API declarativa para:
 * - Web: HTML5 <dialog> nativo com Portal
 * - Mobile: React Native Modal
 *
 * Recursos:
 * - Ícones Ionicons consistentes (não emojis)
 * - Fundo colorido no ícone baseado no type
 * - Acessibilidade completa (labels, roles)
 * - Auto-focus no botão seguro para ações danger
 * - Confirmação destrutiva com digitação obrigatória
 * - Loading state no botão de confirmação
 *
 * @example Básico
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
 *
 * @example Com confirmação destrutiva
 * ```tsx
 * <ConfirmModal
 *   visible={showModal}
 *   title="Excluir Conta"
 *   message="Esta ação não pode ser desfeita."
 *   type="danger"
 *   destructiveConfirmText="EXCLUIR"
 *   onConfirm={handleDeleteAccount}
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
  loading = false,
  destructiveConfirmText,
}: ConfirmModalProps) {
  const { theme } = useUnistyles();
  const { isDesktop } = useResponsive();
  const inputRef = useRef<TextInput>(null);

  // Estado para confirmação destrutiva
  const [confirmInput, setConfirmInput] = useState('');

  // Reset input quando modal fecha
  useEffect(() => {
    if (!visible) {
      setConfirmInput('');
    }
  }, [visible]);

  // Auto-focus no input de confirmação destrutiva ou no botão cancelar para danger
  useEffect(() => {
    if (visible && Platform.OS === 'web') {
      // Pequeno delay para garantir que o modal está renderizado
      const timer = setTimeout(() => {
        if (destructiveConfirmText && inputRef.current) {
          // Focus no input de confirmação
          (inputRef.current as unknown as HTMLInputElement)?.focus?.();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [visible, destructiveConfirmText]);

  // Mapear type para cor
  const getColor = () => {
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

  // Mapear type para cor de fundo do ícone (15% opacity)
  const getIconBackgroundColor = () => {
    const color = getColor();
    // Adicionar transparência
    return `${color}15`;
  };

  const iconName = ICON_MAP[type] || ICON_MAP.info;
  const accessibilityLabel = ACCESSIBILITY_LABEL_MAP[type] || ACCESSIBILITY_LABEL_MAP.info;
  const iconColor = getColor();

  // Verificar se confirmação destrutiva está correta
  const isDestructiveConfirmValid = destructiveConfirmText
    ? confirmInput.toUpperCase() === destructiveConfirmText.toUpperCase()
    : true;

  // Botão de confirmar desabilitado se loading ou confirmação destrutiva inválida
  const isConfirmDisabled = loading || !isDestructiveConfirmValid;

  return (
    <DesktopModal
      visible={visible}
      onClose={onCancel}
      maxWidth={420}
      primaryButton={{
        text: confirmText,
        onPress: onConfirm,
        loading,
        disabled: isConfirmDisabled,
        color: getColor(),
      }}
      secondaryButton={cancelText ? {
        text: cancelText,
        onPress: onCancel,
        disabled: loading,
      } : undefined}
    >
      {/* Header com ícone e título */}
      <View
        style={[styles.header, isDesktop && styles.headerCompact]}
        accessible={true}
        accessibilityRole="header"
      >
        {/* Ícone com fundo colorido */}
        <View
          style={[
            styles.iconContainer,
            isDesktop && styles.iconContainerCompact,
            { backgroundColor: getIconBackgroundColor() }
          ]}
          accessibilityLabel={accessibilityLabel}
          accessibilityRole="image"
        >
          <Ionicons
            name={iconName}
            size={isDesktop ? 20 : 24}
            color={iconColor}
          />
        </View>
        <Text style={[styles.title, isDesktop && styles.titleCompact]}>{title}</Text>
      </View>

      {/* Mensagem */}
      <Text
        style={[styles.message, isDesktop && styles.messageCompact]}
        accessibilityRole="text"
      >
        {message}
      </Text>

      {/* Campo de confirmação destrutiva */}
      {destructiveConfirmText && (
        <View style={[styles.destructiveContainer, isDesktop && styles.destructiveContainerCompact]}>
          <Text style={[styles.destructiveLabel, isDesktop && styles.destructiveLabelCompact]}>
            Digite <Text style={styles.destructiveHighlight}>{destructiveConfirmText}</Text> para confirmar:
          </Text>
          <TextInput
            ref={inputRef}
            style={[
              styles.destructiveInput,
              isDesktop && styles.destructiveInputCompact,
              confirmInput.length > 0 && !isDestructiveConfirmValid && styles.destructiveInputError,
              isDestructiveConfirmValid && confirmInput.length > 0 && styles.destructiveInputValid,
            ]}
            value={confirmInput}
            onChangeText={setConfirmInput}
            placeholder={destructiveConfirmText}
            placeholderTextColor={theme.colors.gray400}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!loading}
            accessibilityLabel={`Digite ${destructiveConfirmText} para confirmar a ação`}
            accessibilityHint="Campo obrigatório para confirmar ação destrutiva"
          />
        </View>
      )}
    </DesktopModal>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  headerCompact: {
    marginBottom: theme.spacing.sm,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  iconContainerCompact: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  title: {
    fontSize: theme.typography.xl,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
    flex: 1,
  },
  titleCompact: {
    fontSize: theme.desktop.dialog.titleFontSize,
  },
  message: {
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray700,
    lineHeight: 24,
  },
  messageCompact: {
    fontSize: 14,
    lineHeight: 20,
  },
  // Estilos para confirmação destrutiva
  destructiveContainer: {
    marginTop: theme.spacing.lg,
    padding: theme.spacing.md,
    backgroundColor: `${theme.colors.error}08`,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: `${theme.colors.error}20`,
  },
  destructiveContainerCompact: {
    marginTop: theme.spacing.md,
    padding: theme.spacing.sm,
  },
  destructiveLabel: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray700,
    marginBottom: theme.spacing.sm,
  },
  destructiveLabelCompact: {
    fontSize: 13,
    marginBottom: 6,
  },
  destructiveHighlight: {
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.error,
  },
  destructiveInput: {
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
    letterSpacing: 1,
  },
  destructiveInputCompact: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    fontSize: 14,
  },
  destructiveInputError: {
    borderColor: theme.colors.error,
    backgroundColor: `${theme.colors.error}05`,
  },
  destructiveInputValid: {
    borderColor: theme.colors.success,
    backgroundColor: `${theme.colors.success}05`,
  },
}));
