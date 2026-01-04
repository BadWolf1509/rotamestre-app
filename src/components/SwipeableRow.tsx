import { Ionicons } from '@expo/vector-icons';
import React, { useRef } from 'react';
import {
  View,
  Text,
  Animated,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';

import type { IconName } from '@/types/icons';
import { mediumHaptic } from '@/utils/haptics';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

const { width: screenWidth } = Dimensions.get('window');
const SWIPE_THRESHOLD = screenWidth * 0.25;

interface SwipeAction {
  icon: IconName;
  label: string;
  color: string;
  onPress: () => void | Promise<void>;
  loading?: boolean;
}

interface SwipeableRowProps {
  children: React.ReactNode;
  leftActions?: SwipeAction[];
  rightActions?: SwipeAction[];
  onSwipeableOpen?: (direction: 'left' | 'right') => void;
  enabled?: boolean;
}

export function SwipeableRow({
  children,
  leftActions = [],
  rightActions = [],
  onSwipeableOpen,
  enabled = true,
}: SwipeableRowProps) {
  const { theme } = useUnistyles();
  const swipeableRef = useRef<Swipeable>(null);

  const renderLeftActions = (
    progress: Animated.AnimatedInterpolation<number>,
    _dragX: Animated.AnimatedInterpolation<number>
  ) => {
    if (leftActions.length === 0) return null;

    return (
      <View style={styles.actionsContainer}>
        {leftActions.map((action, index) => {
          const trans = progress.interpolate({
            inputRange: [0, 1],
            outputRange: [-100, 0],
          });

          return (
            <Animated.View
              key={index}
              style={[
                styles.actionButton,
                {
                  transform: [{ translateX: trans }],
                  backgroundColor: action.color,
                },
              ]}
            >
              <TouchableOpacity
                style={styles.actionContent}
                onPress={async () => {
                  await mediumHaptic();
                  swipeableRef.current?.close();
                  action.onPress();
                }}
                disabled={action.loading}
                accessible
                accessibilityRole="button"
                accessibilityLabel={action.label}
                accessibilityState={{ disabled: action.loading }}
              >
                {action.loading ? (
                  <ActivityIndicator color={theme.colors.white} size="small" />
                ) : (
                  <Ionicons
                    name={action.icon}
                    size={24}
                    color={theme.colors.white}
                  />
                )}
                <Text style={styles.actionText}>{action.label}</Text>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>
    );
  };

  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
    _dragX: Animated.AnimatedInterpolation<number>
  ) => {
    if (rightActions.length === 0) return null;

    return (
      <View style={styles.actionsContainer}>
        {rightActions.map((action, index) => {
          const trans = progress.interpolate({
            inputRange: [0, 1],
            outputRange: [100, 0],
          });

          return (
            <Animated.View
              key={index}
              style={[
                styles.actionButton,
                {
                  transform: [{ translateX: trans }],
                  backgroundColor: action.color,
                },
              ]}
            >
              <TouchableOpacity
                style={styles.actionContent}
                onPress={async () => {
                  await mediumHaptic();
                  swipeableRef.current?.close();
                  action.onPress();
                }}
                disabled={action.loading}
                accessible
                accessibilityRole="button"
                accessibilityLabel={action.label}
                accessibilityState={{ disabled: action.loading }}
              >
                {action.loading ? (
                  <ActivityIndicator color={theme.colors.white} size="small" />
                ) : (
                  <Ionicons
                    name={action.icon}
                    size={24}
                    color={theme.colors.white}
                  />
                )}
                <Text style={styles.actionText}>{action.label}</Text>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>
    );
  };

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <Swipeable
      ref={swipeableRef}
      friction={2}
      leftThreshold={SWIPE_THRESHOLD}
      rightThreshold={SWIPE_THRESHOLD}
      renderLeftActions={leftActions.length > 0 ? renderLeftActions : undefined}
      renderRightActions={rightActions.length > 0 ? renderRightActions : undefined}
      onSwipeableOpen={(direction) => {
        if (onSwipeableOpen) {
          onSwipeableOpen(direction);
        }
      }}
      overshootLeft={false}
      overshootRight={false}
    >
      {children}
    </Swipeable>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
    height: '100%',
  },
  actionContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  actionText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.xs,
    marginTop: theme.spacing.xs,
    fontFamily: theme.typography.fontSansSemiBold,
  },
}));
