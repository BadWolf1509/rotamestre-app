import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, Text, View, Platform } from 'react-native';

import { useIsOnline, useNetworkStatus } from '@/hooks/useNetworkStatus';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

interface ConnectivityBannerProps {
  /** Posição do banner */
  position?: 'top' | 'bottom';
  /** Mostrar banner quando conectado (depois de ter ficado offline) */
  showOnReconnect?: boolean;
  /** Duração para esconder o banner de reconexão (ms) */
  reconnectDuration?: number;
}

/**
 * Banner de conectividade que aparece quando o dispositivo está offline
 * Com animação slide in/out e opção de mostrar reconexão
 *
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <View style={{ flex: 1 }}>
 *       <ConnectivityBanner position="top" showOnReconnect />
 *       <MainContent />
 *     </View>
 *   );
 * }
 * ```
 */
export function ConnectivityBanner({
  position = 'top',
  showOnReconnect = true,
  reconnectDuration = 3000,
}: ConnectivityBannerProps) {
  const { theme } = useUnistyles();
  const isOnline = useIsOnline();
  const { connectionType, isWifi } = useNetworkStatus();

  const slideAnim = useRef(new Animated.Value(position === 'top' ? -100 : 100)).current;
  const wasOfflineRef = useRef(false);
  const showReconnectedRef = useRef(false);
  const [showReconnected, setShowReconnected] = React.useState(false);

  useEffect(() => {
    const isOffline = !isOnline;
    const shouldShow = isOffline || (showOnReconnect && showReconnectedRef.current);

    if (isOffline) {
      wasOfflineRef.current = true;
      showReconnectedRef.current = false;
      setShowReconnected(false);

      // Slide in
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }).start();
    } else if (wasOfflineRef.current && showOnReconnect) {
      // Voltou online - mostrar mensagem de reconexão
      wasOfflineRef.current = false;
      showReconnectedRef.current = true;
      setShowReconnected(true);

      // Manter visível por um momento
      const timer = setTimeout(() => {
        showReconnectedRef.current = false;
        setShowReconnected(false);

        // Slide out
        Animated.timing(slideAnim, {
          toValue: position === 'top' ? -100 : 100,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }, reconnectDuration);

      return () => clearTimeout(timer);
    } else if (!shouldShow) {
      // Slide out
      Animated.timing(slideAnim, {
        toValue: position === 'top' ? -100 : 100,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [isOnline, showOnReconnect, reconnectDuration, position, slideAnim]);

  const isOffline = !isOnline;
  const shouldRender = isOffline || showReconnected;

  if (!shouldRender) return null;

  const backgroundColor = isOffline ? theme.colors.error : theme.colors.success;
  const icon = isOffline ? 'cloud-offline' : 'cloud-done';
  const message = isOffline
    ? 'Sem conexão com a internet'
    : `Conectado${isWifi ? ' via Wi-Fi' : connectionType === 'cellular' ? ' via rede móvel' : ''}`;

  return (
    <Animated.View
      style={[
        styles.container,
        position === 'top' ? styles.positionTop : styles.positionBottom,
        {
          backgroundColor,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.content}>
        <Ionicons name={icon as any} size={18} color={theme.colors.white} />
        <Text style={styles.message}>{message}</Text>
        {isOffline && (
          <View style={[styles.pulsingDot, { backgroundColor: theme.colors.white }]} />
        )}
      </View>
    </Animated.View>
  );
}

/**
 * Indicador compacto de conectividade (ícone apenas)
 * Ideal para usar em headers/status bars
 *
 * @example
 * ```tsx
 * <View style={styles.header}>
 *   <Text>Título</Text>
 *   <ConnectivityIndicator />
 * </View>
 * ```
 */
export function ConnectivityIndicator() {
  const { theme } = useUnistyles();
  const isOnline = useIsOnline();
  const { isWifi, isCellular } = useNetworkStatus();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isOnline) {
      // Pulse animation when offline
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.3,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isOnline, pulseAnim]);

  const getIcon = (): string => {
    if (!isOnline) return 'cloud-offline';
    if (isWifi) return 'wifi';
    if (isCellular) return 'cellular';
    return 'globe';
  };

  const getColor = () => {
    if (!isOnline) return theme.colors.error;
    return theme.colors.success;
  };

  return (
    <Animated.View style={[styles.indicator, { opacity: pulseAnim }]}>
      <Ionicons name={getIcon() as any} size={16} color={getColor()} />
    </Animated.View>
  );
}

/**
 * Badge de status de conexão com texto
 * Mostra tipo de conexão atual
 */
export function ConnectionStatusBadge() {
  const { theme } = useUnistyles();
  const isOnline = useIsOnline();
  const { isWifi, isCellular } = useNetworkStatus();

  const getLabel = (): string => {
    if (!isOnline) return 'Offline';
    if (isWifi) return 'Wi-Fi';
    if (isCellular) return 'Móvel';
    return 'Online';
  };

  const getIcon = (): string => {
    if (!isOnline) return 'cloud-offline';
    if (isWifi) return 'wifi';
    if (isCellular) return 'cellular';
    return 'globe';
  };

  const backgroundColor = isOnline ? theme.colors.successBg : theme.colors.errorBg;
  const textColor = isOnline ? theme.colors.success : theme.colors.error;

  return (
    <View style={[styles.badge, { backgroundColor }]}>
      <Ionicons name={getIcon() as any} size={12} color={textColor} />
      <Text style={[styles.badgeText, { color: textColor }]}>{getLabel()}</Text>
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    position: Platform.OS === 'web' ? ('fixed' as any) : 'absolute',
    left: 0,
    right: 0,
    zIndex: theme.zIndex.banner,
    paddingVertical: theme.components.connectivityBanner.paddingV,
    paddingHorizontal: theme.spacing.md,
  },
  positionTop: {
    top: 0,
  },
  positionBottom: {
    bottom: 0,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  message: {
    color: theme.colors.white,
    fontSize: theme.components.connectivityBanner.messageFontSize,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  pulsingDot: {
    width: theme.components.connectivityBanner.dotSize,
    height: theme.components.connectivityBanner.dotSize,
    borderRadius: theme.components.connectivityBanner.dotSize / 2,
  },
  indicator: {
    padding: theme.spacing.xs,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.components.connectivityBanner.badgePaddingH,
    paddingVertical: theme.components.connectivityBanner.badgePaddingV,
    borderRadius: theme.components.connectivityBanner.badgeBorderRadius,
  },
  badgeText: {
    fontSize: theme.components.connectivityBanner.badgeFontSize,
    fontFamily: theme.typography.fontSansSemiBold,
  },
}));
