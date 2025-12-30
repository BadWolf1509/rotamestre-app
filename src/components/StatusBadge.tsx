import React from 'react';
import {
  Text,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { withOpacity } from '@/utils/color';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

type StatusBadgeVariant = 'soft' | 'solid';
type StatusBadgeSize = 'sm' | 'md';

interface StatusBadgeProps {
  label: string;
  color: string;
  variant?: StatusBadgeVariant;
  size?: StatusBadgeSize;
  containerStyle?: ViewStyle;
  labelStyle?: TextStyle;
  testID?: string;
}

export function StatusBadge({
  label,
  color,
  variant = 'soft',
  size = 'md',
  containerStyle,
  labelStyle,
  testID,
}: StatusBadgeProps) {
  const { theme } = useUnistyles();
  const styles = createStyles(theme);
  const isSmall = size === 'sm';
  const backgroundColor = variant === 'solid' ? color : withOpacity(color, 0.15);
  const textColor = variant === 'solid' ? theme.colors.white : color;

  return (
    <View
      testID={testID}
      style={[
        styles.base,
        isSmall && styles.small,
        { backgroundColor, borderColor: color },
        containerStyle,
      ]}
    >
      <Text
        style={[
          styles.text,
          isSmall && styles.textSmall,
          { color: textColor },
          labelStyle,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    base: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 4,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      alignSelf: 'flex-start',
    },
    small: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 2,
    },
    text: {
      fontSize: theme.typography.xs,
      fontFamily: theme.typography.fontSansSemiBold,
    },
    textSmall: {
      fontSize: 11,
    },
  });
