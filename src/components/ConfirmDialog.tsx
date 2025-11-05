import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Ionicons } from '@expo/vector-icons';

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

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Icon */}
          <View style={[styles.iconContainer, { backgroundColor: `${getIconColor()}15` }]}>
            <Ionicons name={getIconName() as any} size={32} color={getIconColor()} />
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
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create(theme => ({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  container: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    width: '100%',
    maxWidth: 400,
    ...Platform.select({
      web: {
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      },
      default: theme.shadows.lg,
    }),
  },
  iconContainer: {
    width: 64,
    height: 64,
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
    paddingVertical: 12,
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
