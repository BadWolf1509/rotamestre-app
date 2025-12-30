import React from 'react';
import { View, ViewStyle, TouchableOpacity, Platform } from 'react-native';

import { platformOverrides } from '@/design-system/tokens';
import { StyleSheet, type Theme } from '@/utils/styles';

interface CardProps {
  children: React.ReactNode;
  variant?: 'elevated' | 'outlined' | 'filled';
  padding?: 'none' | 'small' | 'medium' | 'large';
  onPress?: () => void;
  style?: ViewStyle;
  testID?: string;
}

export function Card({
  children,
  variant = 'elevated',
  padding = 'medium',
  onPress,
  style,
  testID,
}: CardProps) {
  const Container = onPress ? TouchableOpacity : View;
  const elevatedStyle =
    variant === 'elevated'
      ? Platform.select({
          ios: {
            shadowOpacity: platformOverrides.ios.shadow.opacity,
            shadowRadius: platformOverrides.ios.shadow.radius,
            shadowOffset: { width: 0, height: platformOverrides.ios.shadow.offsetY },
          },
          android: {
            elevation: platformOverrides.android.shadow.elevation,
          },
        })
      : undefined;

  return (
    <Container
      style={[
        styles.card,
        styles[variant],
        elevatedStyle,
        styles[`padding${padding.charAt(0).toUpperCase() + padding.slice(1)}` as keyof typeof styles],
        style,
      ]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      testID={testID}
    >
      {children}
    </Container>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  card: {
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.white,
  },

  elevated: {
    ...theme.shadows.md,
  },
  outlined: {
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
  filled: {
    backgroundColor: theme.colors.gray50,
  },

  paddingNone: {
    padding: 0,
  },
  paddingSmall: {
    padding: 12,
  },
  paddingMedium: {
    padding: 16,
  },
  paddingLarge: {
    padding: 20,
  },
}));
