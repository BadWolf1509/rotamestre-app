import React from 'react';
import {
  Text,
  TouchableOpacity,
  type TextStyle,
  type TouchableOpacityProps,
  type ViewStyle,
} from 'react-native';

import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

type FilterChipSize = 'regular' | 'compact';

interface FilterChipProps extends TouchableOpacityProps {
  label: string;
  selected?: boolean;
  size?: FilterChipSize;
  containerStyle?: ViewStyle;
  labelStyle?: TextStyle;
}

export function FilterChip({
  label,
  selected = false,
  size = 'regular',
  containerStyle,
  labelStyle,
  ...props
}: FilterChipProps) {
  const { theme } = useUnistyles();
  const styles = createStyles(theme);
  const isCompact = size === 'compact';

  return (
    <TouchableOpacity
      {...props}
      style={[
        styles.base,
        isCompact && styles.compact,
        selected && styles.active,
        containerStyle,
      ]}
    >
      <Text
        style={[
          styles.text,
          isCompact && styles.textCompact,
          selected && styles.textActive,
          labelStyle,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    base: {
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.white,
      borderWidth: 1,
      borderColor: theme.colors.gray300,
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    compact: {
      paddingVertical: 6,
      paddingHorizontal: theme.desktop.button.paddingHorizontal,
      minHeight: theme.desktop.button.height,
    },
    active: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    text: {
      fontSize: theme.typography.sm,
      fontFamily: theme.typography.fontSansSemiBold,
      color: theme.colors.gray700,
    },
    textCompact: {
      fontSize: theme.desktop.button.fontSize,
    },
    textActive: {
      color: theme.colors.white,
    },
  });
