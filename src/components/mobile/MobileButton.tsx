import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  TouchableOpacityProps,
  ViewStyle,
  TextStyle,
} from 'react-native';

import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

interface MobileButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'warning';
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

/**
 * Botão padronizado para telas mobile
 * Segue o padrão de design estabelecido para o RotaMestre
 */
export function MobileButton({
  title,
  variant = 'primary',
  size = 'medium',
  loading = false,
  icon,
  fullWidth = false,
  disabled,
  style,
  textStyle,
  ...props
}: MobileButtonProps) {
  const { theme } = useUnistyles();

  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[
        styles.button,
        styles[`button${variant.charAt(0).toUpperCase()}${variant.slice(1)}` as keyof typeof styles] as ViewStyle,
        styles[`button${size.charAt(0).toUpperCase()}${size.slice(1)}` as keyof typeof styles] as ViewStyle,
        fullWidth && styles.buttonFullWidth,
        isDisabled && styles.buttonDisabled,
        style,
      ]}
      disabled={isDisabled}
      activeOpacity={0.7}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'secondary' ? theme.colors.gray900 : theme.colors.white}
        />
      ) : (
        <>
          {icon && icon}
          <Text
            style={[
              styles.buttonText,
              styles[`buttonText${variant.charAt(0).toUpperCase()}${variant.slice(1)}` as keyof typeof styles] as TextStyle,
              styles[`buttonText${size.charAt(0).toUpperCase()}${size.slice(1)}` as keyof typeof styles] as TextStyle,
              textStyle,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  // Base
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.lg,
    gap: theme.spacing.xs,
  },
  buttonText: {
    fontFamily: theme.typography.fontSansSemiBold,
  },

  // Variants
  buttonPrimary: {
    backgroundColor: theme.colors.primary,
  },
  buttonSecondary: {
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.gray300,
  },
  buttonDanger: {
    backgroundColor: theme.colors.error,
  },
  buttonSuccess: {
    backgroundColor: theme.colors.success,
  },
  buttonWarning: {
    backgroundColor: theme.colors.warning,
  },

  // Text Variants
  buttonTextPrimary: {
    color: theme.colors.white,
  },
  buttonTextSecondary: {
    color: theme.colors.gray900,
  },
  buttonTextDanger: {
    color: theme.colors.white,
  },
  buttonTextSuccess: {
    color: theme.colors.white,
  },
  buttonTextWarning: {
    color: theme.colors.white,
  },

  // Sizes
  buttonSmall: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    minHeight: 32,
  },
  buttonMedium: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    minHeight: 44,
  },
  buttonLarge: {
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xl,
    minHeight: 56,
  },

  // Text Sizes
  buttonTextSmall: {
    fontSize: theme.typography.sm,
  },
  buttonTextMedium: {
    fontSize: theme.typography.base,
  },
  buttonTextLarge: {
    fontSize: theme.typography.lg,
  },

  // States
  buttonFullWidth: {
    width: '100%',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
}));
