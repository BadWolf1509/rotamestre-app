import React, { useEffect, useRef } from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';

interface AnimatedListItemProps {
  /** Index of the item in the list, used to calculate stagger delay */
  index: number;
  children: React.ReactNode;
  /** Milliseconds of delay per item (default: 50) */
  delay?: number;
  /** Additional style applied to the animated wrapper (e.g. flex:1 for row layouts) */
  style?: StyleProp<ViewStyle>;
}

/**
 * Wraps a list item with a staggered fade-in + slide-up animation.
 *
 * Each item fades from 0 to 1 and translates from 20px below to 0,
 * with a stagger offset based on its index.
 *
 * Usage:
 * ```tsx
 * <AnimatedListItem index={i}>
 *   <MyCard />
 * </AnimatedListItem>
 * ```
 */
function AnimatedListItemInner({ index, children, delay = 50, style }: AnimatedListItemProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    const staggerDelay = index * delay;

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();
    }, staggerDelay);

    return () => {
      clearTimeout(timer);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
}

export const AnimatedListItem = React.memo(AnimatedListItemInner);
export default AnimatedListItem;
