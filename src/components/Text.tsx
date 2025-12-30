import React from 'react';
import { Text as RNText, TextProps as RNTextProps, TextStyle } from 'react-native';

import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

type TextVariant = 'body' | 'title' | 'subtitle' | 'label' | 'caption';
type TextTone = 'default' | 'muted' | 'primary' | 'success' | 'warning' | 'error' | 'inverse';

interface TextProps extends RNTextProps {
  variant?: TextVariant;
  tone?: TextTone;
}

const getToneColor = (theme: Theme, tone: TextTone): string => {
  switch (tone) {
    case 'muted':
      return theme.colors.gray600;
    case 'primary':
      return theme.colors.primary;
    case 'success':
      return theme.colors.success;
    case 'warning':
      return theme.colors.warning;
    case 'error':
      return theme.colors.error;
    case 'inverse':
      return theme.colors.white;
    case 'default':
    default:
      return theme.colors.gray900;
  }
};

export function Text({ variant = 'body', tone = 'default', style, ...props }: TextProps) {
  const { theme } = useUnistyles();

  return (
    <RNText
      {...props}
      style={[
        styles.base,
        styles[variant],
        { color: getToneColor(theme, tone) },
        style as TextStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  base: {
    fontFamily: theme.typography.fontSans,
  },
  body: {
    fontSize: theme.typography.fontSize.base,
    lineHeight: theme.typography.fontSize.base * 1.5,
  },
  title: {
    fontFamily: theme.typography.fontSansBold,
    fontSize: theme.typography.fontSize.xl,
    lineHeight: theme.typography.fontSize.xl * 1.3,
  },
  subtitle: {
    fontFamily: theme.typography.fontSansSemiBold,
    fontSize: theme.typography.fontSize.lg,
    lineHeight: theme.typography.fontSize.lg * 1.4,
  },
  label: {
    fontFamily: theme.typography.fontSansSemiBold,
    fontSize: theme.typography.fontSize.sm,
    lineHeight: theme.typography.fontSize.sm * 1.4,
  },
  caption: {
    fontSize: theme.typography.fontSize.xs,
    lineHeight: theme.typography.fontSize.xs * 1.4,
  },
}));

export default Text;
