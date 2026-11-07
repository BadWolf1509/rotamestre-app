import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

import { useIsOnline, useNetworkStatus } from '@/hooks/useNetworkStatus';
import type { IconName } from '@/types/icons';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

/**
 * Indicador compacto de conectividade (só o ícone), usado no cabeçalho da
 * Início do motorista (`StatusSection`). Sem rede: nuvem cortada vermelha,
 * pulsando; com rede: wifi, celular ou globo, em verde.
 *
 * Este arquivo era `ConnectivityBanner.tsx`: o banner que dava nome a ele não
 * era montado em nenhuma tela e saiu em 07/11/2026 (ajustes da 3058). Os
 * tokens `components.connectivityBanner` ficaram no tema e em `tokens/`, sem
 * uso — tirá-los mexe no pipeline de tokens e na checagem de drift.
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
        ]),
      );
      animation.start();
      return () => animation.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isOnline, pulseAnim]);

  const getIcon = (): IconName => {
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
      <Ionicons name={getIcon()} size={16} color={getColor()} />
    </Animated.View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  indicator: {
    padding: theme.spacing.xs,
  },
}));
