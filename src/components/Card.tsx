import React, { useRef } from 'react';
import { View, ViewStyle, Pressable, Animated, Platform } from 'react-native';

import { platformOverrides } from '@/design-system/tokens';
import type { PressableStateWithHover } from '@/types';
import { boxShadow } from '@/utils/color';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

interface CardProps {
  children: React.ReactNode;
  variant?: 'elevated' | 'outlined' | 'filled';
  padding?: 'none' | 'small' | 'medium' | 'large';
  onPress?: () => void;
  style?: ViewStyle;
  testID?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

function CardComponent({
  children,
  variant = 'elevated',
  padding = 'medium',
  onPress,
  style,
  testID,
  accessibilityLabel,
  accessibilityHint,
}: CardProps) {
  const { theme } = useUnistyles();
  const scaleAnim = useRef(new Animated.Value(1)).current;

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

  const paddingKey = `padding${padding.charAt(0).toUpperCase() + padding.slice(1)}` as keyof typeof styles;

  const handlePressIn = () => {
    Animated.timing(scaleAnim, {
      toValue: 0.97,
      duration: 150,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 200,
      friction: 10,
      useNativeDriver: true,
    }).start();
  };

  const cardStyles = [
    styles.card,
    styles[variant],
    elevatedStyle,
    styles[paddingKey],
    style,
  ];

  // Non-interactive cards render as plain View
  if (!onPress) {
    return (
      <View
        style={cardStyles}
        testID={testID}
        accessible
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
      >
        {children}
      </View>
    );
  }

  // Interactive cards use Pressable + Animated scale
  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      testID={testID}
      accessible
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={(state) => {
        const { focused, pressed } = state as PressableStateWithHover;
        return [
          styles.interactive,
          // Web focus ring for keyboard navigation
          focused && !pressed && styles.focusRing,
        ];
      }}
    >
      <Animated.View style={[cardStyles, { transform: [{ scale: scaleAnim }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

export const Card = React.memo(CardComponent);
Card.displayName = 'Card';

const styles = StyleSheet.create((theme: Theme) => ({
  card: {
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.white,
  },

  interactive: {
    // Web-specific styles (as any needed due to Unistyles type limitations)
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
      transitionProperty: 'box-shadow',
      transitionDuration: '150ms',
      outlineWidth: 0,
    } as any),
  },

  focusRing: {
    ...(Platform.OS === 'web' && {
      boxShadow: boxShadow(0, 0, 0, 3, theme.colors.primary, 0.25),
      outlineWidth: 0,
    } as any),
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
    padding: theme.components.card.padding.none,
  },
  paddingSmall: {
    padding: theme.components.card.padding.small,
  },
  paddingMedium: {
    padding: theme.components.card.padding.medium,
  },
  paddingLarge: {
    padding: theme.components.card.padding.large,
  },
}));
