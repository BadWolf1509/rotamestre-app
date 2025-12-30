import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Pressable,
  Text,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  Platform,
} from 'react-native';

import { platformOverrides } from '@/design-system/tokens';
import { boxShadow } from '@/utils/color';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

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
  const isDisabled = disabled || loading;
  const sizeTokens = theme.components.button.size[size];
  const iconSize = Math.round(sizeTokens.fontSize * 1.2);
  const platformConfig = platformOverrides[Platform.OS as keyof typeof platformOverrides];
  const minTouchSize = platformConfig?.touchTarget?.minSize ?? 0;
  const minHeight = Math.max(sizeTokens.height, minTouchSize);
  const rippleColor = Platform.OS === 'android'
    ? platformOverrides.android.ripple?.color
    : undefined;

  return (
    <Pressable
      style={({ pressed }) => ([
        styles.button,
        styles[variant],
        styles[size],
        { minHeight },
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ])}
      onPress={onPress}
      disabled={isDisabled}
      android_ripple={rippleColor ? { color: rippleColor } : undefined}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: isDisabled }}
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
              size={iconSize}
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
              size={iconSize}
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
    </Pressable>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.components.button.radius,
    // Web-only: Smooth transitions and cursor
    ...(Platform.OS === 'web' && ({
      cursor: 'pointer',
      transitionProperty: 'all',
      transitionDuration: '0.2s',
      transitionTimingFunction: 'ease-in-out',
      ':focus-visible': {
        outlineStyle: 'solid',
        outlineColor: platformOverrides.web.focusRing.color,
        outlineWidth: platformOverrides.web.focusRing.width,
        outlineOffset: 2,
      },
    } as any)),
  },

  primary: {
    backgroundColor: theme.colors.primary,
    // Web-only: Hover effects
    ...(Platform.OS === 'web' && {
      // @ts-ignore - web-only CSS
      ':hover': {
        backgroundColor: theme.colors.primaryDark,
        transform: 'translateY(-1px)',
        boxShadow: boxShadow(0, 4, 8, 0, theme.colors.black, 0.15),
      },
      ':active': {
        transform: 'translateY(0px)',
        boxShadow: boxShadow(0, 2, 4, 0, theme.colors.black, 0.1),
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
        boxShadow: boxShadow(0, 4, 8, 0, theme.colors.black, 0.15),
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
        boxShadow: boxShadow(0, 4, 8, 0, theme.colors.error, 0.3),
      },
    }),
  },

  small: {
    minHeight: theme.components.button.size.small.height,
    paddingVertical: theme.components.button.size.small.paddingVertical,
    paddingHorizontal: theme.components.button.size.small.paddingHorizontal,
  },
  medium: {
    minHeight: theme.components.button.size.medium.height,
    paddingVertical: theme.components.button.size.medium.paddingVertical,
    paddingHorizontal: theme.components.button.size.medium.paddingHorizontal,
  },
  large: {
    minHeight: theme.components.button.size.large.height,
    paddingVertical: theme.components.button.size.large.paddingVertical,
    paddingHorizontal: theme.components.button.size.large.paddingHorizontal,
  },

  text: {
    fontFamily: theme.typography.fontSansSemiBold,
  },
  primaryText: {
    color: theme.colors.white,
  },
  secondaryText: {
    color: theme.colors.white,
  },
  outlineText: {
    color: theme.colors.primary,
  },
  ghostText: {
    color: theme.colors.primary,
  },
  dangerText: {
    color: theme.colors.white,
  },
  smallText: {
    fontSize: theme.components.button.size.small.fontSize,
  },
  mediumText: {
    fontSize: theme.components.button.size.medium.fontSize,
  },
  largeText: {
    fontSize: theme.components.button.size.large.fontSize,
  },

  disabled: {
    opacity: 0.5,
    ...(Platform.OS === 'web' && ({
      cursor: 'not-allowed',
      ':hover': {
        transform: 'none',
        boxShadow: boxShadow(0, 0, 0, 0, theme.colors.black, 0),
      },
    } as any)),
  },
  pressed: {
    opacity: 0.85,
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
