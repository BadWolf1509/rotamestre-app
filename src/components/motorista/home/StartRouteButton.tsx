import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  TouchableOpacity,
  Text,
  View,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
} from 'react-native-reanimated';

import type { IconName } from '@/types/icons';
import { withOpacity } from '@/utils/color';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

interface StartRouteButtonProps {
  /** Callback quando o botão é pressionado */
  onPress: () => void;
  /** Se o botão está desabilitado */
  disabled?: boolean;
  /** Se está carregando */
  loading?: boolean;
  /** Texto do botão */
  label?: string;
  /** Subtexto (ex: "1 parada • 24km") */
  subtitle?: string;
  /** Mensagem de erro/bloqueio */
  errorMessage?: string;
  /** Variante do botão */
  variant?: 'start' | 'navigate' | 'complete' | 'details';
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

/**
 * Botão de ação principal full-width para a tela do motorista
 * Usado principalmente para "Iniciar Rota" mas adaptável para outros estados
 */
export function StartRouteButton({
  onPress,
  disabled = false,
  loading = false,
  label = 'Iniciar Rota',
  subtitle,
  errorMessage,
  variant = 'start',
}: StartRouteButtonProps) {
  const { theme } = useUnistyles();

  // Animação de pulse sutil quando habilitado
  const scale = useSharedValue(1);

  React.useEffect(() => {
    if (!disabled && !loading && variant === 'start') {
      // Pulse animation para chamar atenção
      scale.value = withRepeat(
        withSequence(
          withTiming(1.02, { duration: 1000 }),
          withTiming(1, { duration: 1000 })
        ),
        -1, // Infinito
        true
      );
    } else {
      scale.value = withSpring(1);
    }
  }, [disabled, loading, variant, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Configuração visual por variante
  const getVariantConfig = (): { icon: IconName; color: string; disabledColor: string } => {
    switch (variant) {
      case 'start':
        return {
          icon: 'play-circle',
          color: theme.colors.success,
          disabledColor: theme.colors.gray300,
        };
      case 'navigate':
        return {
          icon: 'navigate',
          color: theme.colors.primary,
          disabledColor: theme.colors.gray300,
        };
      case 'complete':
        return {
          icon: 'checkmark-circle',
          color: theme.colors.success,
          disabledColor: theme.colors.gray300,
        };
      case 'details':
        return {
          icon: 'document-text',
          color: theme.colors.primary,
          disabledColor: theme.colors.gray300,
        };
      default:
        return {
          icon: 'play-circle',
          color: theme.colors.success,
          disabledColor: theme.colors.gray300,
        };
    }
  };

  const config = getVariantConfig();
  const backgroundColor = disabled ? config.disabledColor : config.color;

  return (
    <View style={styles.container}>
      <AnimatedTouchable
        onPress={onPress}
        disabled={disabled || loading}
        activeOpacity={0.8}
        style={[
          styles.button,
          { backgroundColor },
          disabled && styles.buttonDisabled,
          animatedStyle,
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={theme.colors.white} />
        ) : (
          <>
            <Ionicons
              name={config.icon}
              size={24}
              color={theme.colors.white}
            />
            <View style={styles.textContainer}>
              <Text style={styles.label}>{label}</Text>
              {subtitle && !disabled && (
                <Text style={styles.subtitle}>{subtitle}</Text>
              )}
              {errorMessage && disabled && (
                <Text style={styles.errorText}>{errorMessage}</Text>
              )}
            </View>
          </>
        )}
      </AnimatedTouchable>
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    paddingHorizontal: theme.spacing['4'],
    paddingVertical: theme.spacing['3'],
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing['3'],
    paddingVertical: theme.spacing['4'],
    paddingHorizontal: theme.spacing['6'],
    borderRadius: theme.borderRadius.lg,
    minHeight: 56,
    // Shadow
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  textContainer: {
    alignItems: 'flex-start',
  },
  label: {
    fontSize: theme.typography.lg,
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.white,
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: theme.typography.sm,
    color: withOpacity(theme.colors.white, 0.85),
    marginTop: theme.spacing['0.5'],
  },
  errorText: {
    fontSize: theme.typography.xs,
    color: withOpacity(theme.colors.white, 0.7),
    marginTop: theme.spacing['0.5'],
  },
}));
