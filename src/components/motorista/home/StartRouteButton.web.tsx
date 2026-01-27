import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Animated,
  TouchableOpacity,
  Text,
  View,
  ActivityIndicator,
} from 'react-native';

import type { IconName } from '@/types/icons';
import { withOpacity } from '@/utils/color';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

interface StartRouteButtonProps {
  /** Callback quando o botao e pressionado */
  onPress: () => void;
  /** Se o botao esta desabilitado */
  disabled?: boolean;
  /** Se esta carregando */
  loading?: boolean;
  /** Texto do botao */
  label?: string;
  /** Subtexto (ex: "1 parada - 24km") */
  subtitle?: string;
  /** Mensagem de erro/bloqueio */
  errorMessage?: string;
  /** Variante do botao */
  variant?: 'start' | 'navigate' | 'complete' | 'details';
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

/**
 * Botao de acao principal full-width para a tela do motorista
 * Usado principalmente para "Iniciar Rota" mas adaptavel para outros estados
 *
 * Nota: versao web usa Animated nativo do RN para evitar Worklets.
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

  // Animacao de pulse sutil quando habilitado
  const scale = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;

    if (!disabled && !loading && variant === 'start') {
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.02,
            duration: 1000,
            useNativeDriver: false,
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: false,
          }),
        ])
      );
      animation.start();
    } else {
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: false,
      }).start();
    }

    return () => {
      animation?.stop();
    };
  }, [disabled, loading, variant, scale]);

  const animatedStyle = {
    transform: [{ scale }],
  };

  // Configuracao visual por variante
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
