import { Ionicons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Platform,
  Pressable,
} from 'react-native';

import { StyleSheet, useUnistyles } from '@/utils/styles';

interface AlertDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  onConfirm: () => void;
  type?: 'default' | 'error' | 'success' | 'warning';
}

/**
 * AlertDialog - Dialog de alerta com apenas um botão de confirmação
 * Similar ao ConfirmDialog mas sem botão de cancelar
 * Usa Portal para web para evitar problemas de z-index
 */
export function AlertDialog({
  visible,
  title,
  message,
  confirmText = 'OK',
  onConfirm,
  type = 'default',
}: AlertDialogProps) {
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
      case 'error':
        return 'close-circle-outline';
      case 'success':
        return 'checkmark-circle-outline';
      case 'warning':
        return 'warning-outline';
      default:
        return 'information-circle-outline';
    }
  };

  const getIconColor = () => {
    switch (type) {
      case 'error':
        return theme.colors.error;
      case 'success':
        return theme.colors.success;
      case 'warning':
        return theme.colors.warning;
      default:
        return theme.colors.primary;
    }
  };

  const getConfirmButtonStyle = () => {
    switch (type) {
      case 'error':
        return styles.confirmButtonError;
      case 'success':
        return styles.confirmButtonSuccess;
      case 'warning':
        return styles.confirmButtonWarning;
      default:
        return styles.confirmButtonDefault;
    }
  };

  if (!visible) return null;

  // Web-specific implementation using native divs to escape react-native-web z-index issues
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const dialogContent = (
      <div
        id="alert-dialog-portal"
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
        onClick={onConfirm}
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

          {/* Confirm Button */}
          <button
            onClick={onConfirm}
            aria-label={confirmText}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: theme.borderRadius.md,
              minHeight: 44,
              backgroundColor:
                type === 'error'
                  ? theme.colors.error
                  : type === 'success'
                  ? theme.colors.success
                  : type === 'warning'
                  ? theme.colors.warning
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
    );

    // Use portal to render directly into document.body, escaping any parent hierarchy
    return createPortal(dialogContent, document.body);
  }

  // Mobile implementation using React Native Modal (works perfectly on mobile)
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onConfirm}
      statusBarTranslucent
      presentationStyle="overFullScreen"
    >
      <Pressable style={styles.overlay} onPress={onConfirm}>
        <Pressable style={styles.container} onPress={(e) => e.stopPropagation()}>
          {/* Icon */}
          <View style={[styles.iconContainer, { backgroundColor: `${getIconColor()}15` }]}>
            <Ionicons name={getIconName() as any} size={28} color={getIconColor()} />
          </View>

          {/* Title */}
          <Text style={styles.title}>{title}</Text>

          {/* Message */}
          <Text style={styles.message}>{message}</Text>

          {/* Confirm Button */}
          <TouchableOpacity
            style={[styles.confirmButton, getConfirmButtonStyle()]}
            onPress={onConfirm}
            accessibilityLabel={confirmText}
            accessibilityRole="button"
          >
            <Text style={styles.confirmButtonText}>{confirmText}</Text>
          </TouchableOpacity>
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
  confirmButton: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 44,
    borderWidth: 0,
  },
  confirmButtonDefault: {
    backgroundColor: theme.colors.primary,
  },
  confirmButtonError: {
    backgroundColor: theme.colors.error,
  },
  confirmButtonSuccess: {
    backgroundColor: theme.colors.success,
  },
  confirmButtonWarning: {
    backgroundColor: theme.colors.warning,
  },
  confirmButtonText: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.white,
  },
}));
