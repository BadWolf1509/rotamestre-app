import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Platform,
} from 'react-native';

export type ToastType = 'success' | 'error' | 'info' | 'loading';

export interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onDismiss?: () => void;
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
export function Toast({ message, type = 'info', duration = 3000, onDismiss, visible }: ToastProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-100)).current;

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
    } else {
      handleDismiss();
    }
  }, [visible]);

  const handleDismiss = () => {
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
      onDismiss?.();
    });
  };

  if (!visible && fadeAnim._value === 0) return null;

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
        return '#10b981'; // Green 500
      case 'error':
        return '#ef4444'; // Red 500
      case 'loading':
        return '#3b82f6'; // Blue 500
      case 'info':
      default:
        return '#6b7280'; // Gray 500
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

const styles = StyleSheet.create({
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
    borderRadius: 12,
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
    color: '#fff',
    flex: 1,
    lineHeight: 20,
  },
  closeButton: {
    padding: 4,
    marginLeft: 12,
  },
  closeIcon: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '700',
  },
});
