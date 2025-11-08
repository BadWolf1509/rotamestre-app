import React, { useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Platform,
  Pressable,
} from 'react-native';
import { createPortal } from 'react-dom';
import { StyleSheet, useUnistyles } from '@/utils/styles';
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

  // Block body scroll on web when modal is open
  useEffect(() => {
    if (Platform.OS === 'web' && visible) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [visible]);

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

  if (!visible) return null;

  // Web-specific implementation using native divs to escape react-native-web z-index issues
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const dialogContent = (
      <div
        id="confirm-dialog-portal"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 2147483647, // Maximum z-index value
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          padding: 0,
          margin: 0,
        }}
        onClick={onCancel}
      >
        <div
          style={{
            backgroundColor: theme.colors.white,
            borderRadius: theme.borderRadius.xl,
            padding: theme.spacing.xl,
            width: 'calc(100% - 48px)',
            maxWidth: 360,
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            margin: '0 24px',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Icon */}
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: theme.borderRadius.full,
              backgroundColor: `${getIconColor()}15`,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              margin: `0 auto ${theme.spacing.md}px`,
            }}
          >
            <Ionicons name={getIconName() as any} size={28} color={getIconColor()} />
          </div>

          {/* Title */}
          <div
            style={{
              fontFamily: theme.typography.fontSansBold,
              fontSize: theme.typography.fontSize.xl,
              lineHeight: `${theme.typography.fontSize.xl * 1.4}px`,
              color: theme.colors.gray900,
              textAlign: 'center',
              marginBottom: theme.spacing.sm,
            }}
          >
            {title}
          </div>

          {/* Message */}
          <div
            style={{
              fontFamily: theme.typography.fontSans,
              fontSize: theme.typography.fontSize.sm,
              lineHeight: `${theme.typography.fontSize.sm * 1.5}px`,
              color: theme.colors.gray500,
              textAlign: 'center',
              marginBottom: theme.spacing.lg,
            }}
          >
            {message}
          </div>

          {/* Buttons */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              gap: 12,
            }}
          >
            <button
              onClick={onCancel}
              aria-label={cancelText}
              style={{
                flex: 1,
                padding: '10px 16px',
                borderRadius: theme.borderRadius.md,
                minHeight: 44,
                backgroundColor: theme.colors.gray100,
                border: `1px solid ${theme.colors.gray200}`,
                fontSize: theme.typography.fontSize.base,
                fontFamily: theme.typography.fontSansSemiBold,
                color: theme.colors.gray900,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.gray200;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.gray100;
              }}
            >
              {cancelText}
            </button>

            <button
              onClick={onConfirm}
              aria-label={confirmText}
              style={{
                flex: 1,
                padding: '10px 16px',
                borderRadius: theme.borderRadius.md,
                minHeight: 44,
                backgroundColor:
                  type === 'destructive'
                    ? theme.colors.error
                    : type === 'success'
                    ? theme.colors.success
                    : theme.colors.primary,
                border: 'none',
                fontSize: theme.typography.fontSize.base,
                fontFamily: theme.typography.fontSansSemiBold,
                color: theme.colors.white,
                cursor: 'pointer',
                transition: 'all 0.2s',
                opacity: 1,
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
      </div>
    );

    // Use portal to render directly into document.body, escaping the drawer hierarchy
    return createPortal(dialogContent, document.body);
  }

  // Mobile implementation using React Native Modal (works perfectly on mobile)
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
      presentationStyle="overFullScreen"
    >
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable style={styles.container} onPress={(e) => e.stopPropagation()}>
          {/* Icon */}
          <View style={[styles.iconContainer, { backgroundColor: `${getIconColor()}15` }]}>
            <Ionicons name={getIconName() as any} size={28} color={getIconColor()} />
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
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create(theme => ({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
      default: theme.shadows.lg,
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
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 10,
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
