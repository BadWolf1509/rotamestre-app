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

function StatusBadgeComponent({
  label,
  color,
  variant = 'soft',
  size = 'md',
  containerStyle,
  labelStyle,
  testID,
}: StatusBadgeProps) {
  const { theme } = useUnistyles();
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

export const StatusBadge = React.memo(StatusBadgeComponent);
StatusBadge.displayName = 'StatusBadge';

const styles = StyleSheet.create((theme: Theme) => ({
  base: {
    // Use consistent medium size tokens
    paddingHorizontal: theme.components.badge.size.medium.paddingHorizontal,
    paddingVertical: theme.components.badge.size.medium.paddingVertical,
    borderRadius: theme.borderRadius.sm, // Align with Badge component
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  small: {
    // Use consistent small size tokens
    paddingHorizontal: theme.components.badge.size.small.paddingHorizontal,
    paddingVertical: theme.components.badge.size.small.paddingVertical,
  },
  text: {
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  textSmall: {
    fontSize: theme.typography.fontSize.xs, // Min readable (was 11)
  },
}));
