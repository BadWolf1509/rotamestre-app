import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  Platform,
} from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Ionicons } from '@expo/vector-icons';
import { useBreakpoint } from '@/hooks/useBreakpoint';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'small' | 'medium' | 'large';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  icon,
  iconPosition = 'left',
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
  textStyle,
}: ButtonProps) {
  const { theme } = useUnistyles();
  const { isDesktop, isLargeDesktop } = useBreakpoint();
  const isDisabled = disabled || loading;

  // Responsive sizing for desktop
  const getResponsiveStyle = () => {
    if (isLargeDesktop) {
      return { paddingScale: 1.15, fontScale: 1.125 };
    }
    if (isDesktop) {
      return { paddingScale: 1.1, fontScale: 1.0625 };
    }
    return { paddingScale: 1, fontScale: 1 };
  };

  const { paddingScale } = getResponsiveStyle();

  return (
    <TouchableOpacity
      style={[
        styles.button,
        styles[variant],
        styles[size],
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'outline' || variant === 'ghost' ? theme.colors.primary : theme.colors.white}
        />
      ) : (
        <>
          {icon && iconPosition === 'left' && (
            <Ionicons
              name={icon}
              size={size === 'small' ? 16 : size === 'large' ? 24 : 20}
              color={
                variant === 'outline' || variant === 'ghost'
                  ? theme.colors.primary
                  : theme.colors.white
              }
              style={styles.iconLeft}
            />
          )}
          <Text style={[styles.text, styles[`${variant}Text`], styles[`${size}Text`], textStyle]}>
            {title}
          </Text>
          {icon && iconPosition === 'right' && (
            <Ionicons
              name={icon}
              size={size === 'small' ? 16 : size === 'large' ? 24 : 20}
              color={
                variant === 'outline' || variant === 'ghost'
                  ? theme.colors.primary
                  : theme.colors.white
              }
              style={styles.iconRight}
            />
          )}
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create(theme => ({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.md,
    minHeight: 44,
    // Web-only: Smooth transitions and cursor
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
      transitionProperty: 'all',
      transitionDuration: '0.2s',
      transitionTimingFunction: 'ease-in-out',
    }),
  },

  primary: {
    backgroundColor: theme.colors.primary,
    // Web-only: Hover effects
    ...(Platform.OS === 'web' && {
      // @ts-ignore - web-only CSS
      ':hover': {
        backgroundColor: theme.colors.primaryDark,
        transform: 'translateY(-1px)',
        boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
      },
      ':active': {
        transform: 'translateY(0px)',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      },
    }),
  },
  secondary: {
    backgroundColor: theme.colors.secondary,
    ...(Platform.OS === 'web' && {
      // @ts-ignore
      ':hover': {
        opacity: 0.9,
        transform: 'translateY(-1px)',
        boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
      },
    }),
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: theme.colors.primary,
    ...(Platform.OS === 'web' && {
      // @ts-ignore
      ':hover': {
        backgroundColor: theme.colors.primary + '08',
        borderColor: theme.colors.primaryDark,
        transform: 'translateY(-1px)',
      },
    }),
  },
  ghost: {
    backgroundColor: 'transparent',
    ...(Platform.OS === 'web' && {
      // @ts-ignore
      ':hover': {
        backgroundColor: theme.colors.gray100,
      },
    }),
  },
  danger: {
    backgroundColor: theme.colors.error,
    ...(Platform.OS === 'web' && {
      // @ts-ignore
      ':hover': {
        opacity: 0.9,
        transform: 'translateY(-1px)',
        boxShadow: '0 4px 8px rgba(239, 68, 68, 0.3)',
      },
    }),
  },

  small: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: 12,
  },
  medium: {
    paddingVertical: 12,
    paddingHorizontal: theme.spacing.md,
  },
  large: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },

  text: {
    fontFamily: theme.typography.fontSansSemiBold,
  },
  primaryText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.base,
  },
  secondaryText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.base,
  },
  outlineText: {
    color: theme.colors.primary,
    fontSize: theme.typography.fontSize.base,
  },
  ghostText: {
    color: theme.colors.primary,
    fontSize: theme.typography.fontSize.base,
  },
  dangerText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.base,
  },
  smallText: {
    fontSize: theme.typography.fontSize.sm,
  },
  mediumText: {
    fontSize: theme.typography.fontSize.base,
  },
  largeText: {
    fontSize: theme.typography.fontSize.lg,
  },

  disabled: {
    opacity: 0.5,
    ...(Platform.OS === 'web' && {
      cursor: 'not-allowed',
      // @ts-ignore
      ':hover': {
        transform: 'none',
        boxShadow: 'none',
      },
    }),
  },
  fullWidth: {
    width: '100%',
  },

  iconLeft: {
    marginRight: theme.spacing.sm,
  },
  iconRight: {
    marginLeft: theme.spacing.sm,
  },
}));
