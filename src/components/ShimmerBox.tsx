/**
 * ShimmerBox - Premium skeleton shimmer component
 *
 * Web: CSS-based gradient shimmer (most performant, no JS animation overhead)
 * Native: Enhanced opacity pulse (avoids LinearGradient dependency)
 */

import { memo, useEffect, useRef } from 'react';
import { Animated, Easing, Platform, View, type StyleProp, type ViewStyle } from 'react-native';

import { useUnistyles } from '@/utils/styles';

// Inject CSS @keyframes once on web
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const styleId = 'shimmer-keyframes';
  if (!document.getElementById(styleId)) {
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = `
      @keyframes shimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
    `;
    document.head.appendChild(styleEl);
  }
}

interface ShimmerBoxProps {
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Animated shimmer box that works on both web and native.
 *
 * Web: horizontal gradient sweep via CSS animation (zero JS overhead).
 * Native: smooth opacity pulse with eased timing.
 */
export const ShimmerBox = memo(function ShimmerBox({ style, testID }: ShimmerBoxProps) {
  const { theme } = useUnistyles();

  if (Platform.OS === 'web') {
    return (
      <View
        testID={testID}
        style={[
          {
            backgroundColor: theme.colors.gray200,
            borderRadius: theme.borderRadius.sm,
            background: `linear-gradient(90deg, ${theme.colors.gray200} 25%, ${theme.colors.gray100} 50%, ${theme.colors.gray200} 75%)`,
            backgroundSize: '200% 100%',
            animationName: 'shimmer',
            animationDuration: '1.5s',
            animationIterationCount: 'infinite',
            animationTimingFunction: 'ease-in-out',
          } as any,
          style,
        ]}
      />
    );
  }

  // Native: enhanced opacity pulse
  return <ShimmerBoxNative style={style} testID={testID} />;
});

/**
 * Native-only shimmer using Animated opacity pulse.
 * Separated to avoid running hooks conditionally in the parent.
 */
const ShimmerBoxNative = memo(function ShimmerBoxNative({
  style,
  testID,
}: ShimmerBoxProps) {
  const { theme } = useUnistyles();
  const shimmerValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerValue, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(shimmerValue, {
          toValue: 0,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [shimmerValue]);

  const opacity = shimmerValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.15, 0.45],
  });

  return (
    <Animated.View
      testID={testID}
      style={[
        {
          backgroundColor: theme.colors.gray200,
          borderRadius: theme.borderRadius.sm,
        },
        style,
        { opacity },
      ]}
    />
  );
});
