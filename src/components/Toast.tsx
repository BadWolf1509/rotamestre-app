import React, { useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Animated,
  TouchableOpacity,
  Platform,
} from 'react-native';

import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

export type ToastType = 'success' | 'error' | 'info' | 'loading';

export interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onDismiss?: () => void;
  /** Alias for onDismiss */
  onHide?: () => void;
  visible: boolean;
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
export function Toast({ message, type = 'info', duration = 3000, onDismiss, onHide, visible }: ToastProps) {
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

  return (
    <Animated.View
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
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    position: Platform.OS === 'web' ? ('fixed' as any) : 'absolute',
    top: Platform.OS === 'web' ? 20 : 60,
    left: Platform.OS === 'web' ? '50%' : 20,
    right: Platform.OS === 'web' ? undefined : 20,
    ...(Platform.OS === 'web' && {
      transform: 'translateX(-50%)' as any,
      marginLeft: 0,
      zIndex: 9999,
    }),
    maxWidth: 500,
    minWidth: 300,
    borderRadius: theme.borderRadius.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    paddingVertical: 16,
    paddingHorizontal: 20,
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
    marginRight: 12,
  },
  message: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.white,
    flex: 1,
    lineHeight: 20,
  },
  closeButton: {
    padding: 4,
    marginLeft: 12,
  },
  closeIcon: {
    fontSize: 18,
    color: theme.colors.white,
    fontWeight: '700',
  },
}));
