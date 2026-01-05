import React, { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  View,
  Text,
  Animated,
  TouchableOpacity,
  Platform,
} from 'react-native';

import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

// Container global para Toasts (z-index máximo, acima de qualquer Modal)
const TOAST_ROOT_ID = 'toast-root';

function getToastRoot(): HTMLElement {
  let root = document.getElementById(TOAST_ROOT_ID);
  if (!root) {
    root = document.createElement('div');
    root.id = TOAST_ROOT_ID;
    root.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      pointer-events: none;
      z-index: 2147483647;
    `;
    document.body.appendChild(root);
  }
  return root;
}

export type ToastType = 'success' | 'error' | 'info' | 'loading';

export interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onDismiss?: () => void;
  /** Alias for onDismiss */
  onHide?: () => void;
  visible: boolean;
  /** Desabilitar portal (usar quando Toast está dentro de Modal) */
  disablePortal?: boolean;
  testID?: string;
}

/**
 * Componente Toast para feedback visual de ações
 *
 * @example
 * ```tsx
 * <Toast
 *   visible={showToast}
 *   message="Motorista ativado com sucesso"
 *   type="success"
 *   onDismiss={() => setShowToast(false)}
 * />
 * ```
 */
export function Toast({
  message,
  type = 'info',
  duration = 3000,
  onDismiss,
  onHide,
  visible,
  disablePortal = false,
  testID,
}: ToastProps) {
  const { theme } = useUnistyles();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-100)).current;
  const wasVisibleRef = useRef(false);
  const dismissCallback = onDismiss || onHide;

  const handleDismiss = useCallback(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      dismissCallback?.();
    });
  }, [fadeAnim, dismissCallback, translateY]);

  useEffect(() => {
    if (visible) {
      // Slide in + fade in
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto dismiss (exceto loading)
      if (type !== 'loading' && duration > 0) {
        const timer = setTimeout(() => {
          handleDismiss();
        }, duration);
        return () => clearTimeout(timer);
      }
    } else if (wasVisibleRef.current) {
      handleDismiss();
    }

    wasVisibleRef.current = visible;
  }, [duration, handleDismiss, type, translateY, visible, fadeAnim]);

  if (!visible) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'loading':
        return '⏳';
      case 'info':
      default:
        return 'ℹ️';
    }
  };

  const getBackgroundColor = () => {
    switch (type) {
      case 'success':
        return theme.colors.success;
      case 'error':
        return theme.colors.error;
      case 'loading':
        return theme.colors.info;
      case 'info':
      default:
        return theme.colors.gray500;
    }
  };

  const toastContent = (
    <Animated.View
      testID={testID}
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY }],
          backgroundColor: getBackgroundColor(),
        },
      ]}
    >
      <View style={styles.content}>
        <Text style={styles.icon}>{getIcon()}</Text>
        <Text style={styles.message} numberOfLines={2}>
          {message}
        </Text>
      </View>

      {type !== 'loading' && (
        <TouchableOpacity onPress={handleDismiss} style={styles.closeButton}>
          <Text style={styles.closeIcon}>✕</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );

  // ✅ No web, usar Portal com container dedicado (z-index máximo)
  // Isso garante que o Toast apareça acima de qualquer Modal
  // Exceto quando disablePortal=true (Toast já está dentro de um Modal)
  if (Platform.OS === 'web' && typeof document !== 'undefined' && !disablePortal) {
    return createPortal(toastContent, getToastRoot());
  }

  return toastContent;
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    position: Platform.OS === 'web' ? ('fixed' as any) : 'absolute',
    top: Platform.OS === 'web' ? theme.spacing['5'] : 60,
    left: Platform.OS === 'web' ? '50%' : theme.spacing['5'],
    right: Platform.OS === 'web' ? undefined : theme.spacing['5'],
    // Garantir que o toast fique acima de modais/overlays
    zIndex: 2147483647,
    ...(Platform.OS === 'web' && {
      transform: 'translateX(-50%)' as any,
      marginLeft: 0,
      pointerEvents: 'auto' as any, // Habilitar cliques (container pai tem pointer-events: none)
    }),
    maxWidth: 500,
    minWidth: 300,
    borderRadius: theme.borderRadius.md,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    paddingVertical: theme.spacing['4'],
    paddingHorizontal: theme.spacing['5'],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  icon: {
    fontSize: 20,
    marginRight: theme.spacing['3'],
  },
  message: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.white,
    flex: 1,
    lineHeight: 20,
  },
  closeButton: {
    padding: theme.spacing['1'],
    marginLeft: theme.spacing['3'],
  },
  closeIcon: {
    fontSize: theme.typography.lg,
    color: theme.colors.white,
    fontFamily: theme.typography.fontSansBold,
  },
}));
