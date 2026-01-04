import React from 'react';
import {
  Text,
  TouchableOpacity,
  type TextStyle,
  type TouchableOpacityProps,
  type ViewStyle,
} from 'react-native';

import { StyleSheet, type Theme } from '@/utils/styles';

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
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      accessibilityHint={selected ? 'Toque para desmarcar filtro' : 'Toque para aplicar filtro'}
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

const styles = StyleSheet.create((theme: Theme) => ({
  base: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    minHeight: theme.components.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compact: {
    paddingVertical: theme.spacing.xs + 2, // 6px
    paddingHorizontal: theme.desktop.button.paddingHorizontal,
    minHeight: theme.desktop.button.height,
  },
  active: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  text: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray700,
  },
  textCompact: {
    fontSize: theme.desktop.button.fontSize,
  },
  textActive: {
    color: theme.colors.white,
  },
}));
