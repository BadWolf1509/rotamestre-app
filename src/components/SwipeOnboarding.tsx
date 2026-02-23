/**
 * SwipeOnboarding - One-time overlay teaching swipe gestures
 *
 * Shows an animated overlay explaining swipe-left (skip) and swipe-right (complete)
 * gestures on the motorista home screen. Displayed only once per user.
 *
 * @example
 * ```tsx
 * <SwipeOnboarding onDismiss={() => setShowOnboarding(false)} />
 * ```
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Animated,
  TouchableOpacity,
  Platform,
} from 'react-native';

import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

const STORAGE_KEY = '@rotamestre/onboarding_swipe_seen';

export interface SwipeOnboardingProps {
  /** Called when the user dismisses the overlay */
  onDismiss: () => void;
}

/**
 * Check if swipe onboarding has been seen.
 * Use with AsyncStorage before rendering SwipeOnboarding.
 */
export async function hasSeenSwipeOnboarding(): Promise<boolean> {
  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    const value = await AsyncStorage.getItem(STORAGE_KEY);
    return value === 'true';
  } catch {
    return false;
  }
}

/**
 * Mark swipe onboarding as seen.
 */
export async function markSwipeOnboardingSeen(): Promise<void> {
  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    await AsyncStorage.setItem(STORAGE_KEY, 'true');
  } catch {
    // Silently fail - worst case user sees it again
  }
}

export function SwipeOnboarding({ onDismiss }: SwipeOnboardingProps) {
  const { theme } = useUnistyles();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const leftSwipeAnim = useRef(new Animated.Value(0)).current;
  const rightSwipeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade in
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    // Loop the swipe animations
    const loopLeft = Animated.loop(
      Animated.sequence([
        Animated.timing(leftSwipeAnim, {
          toValue: -40,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(leftSwipeAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.delay(500),
      ])
    );

    const loopRight = Animated.loop(
      Animated.sequence([
        Animated.delay(400), // Stagger from left animation
        Animated.timing(rightSwipeAnim, {
          toValue: 40,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(rightSwipeAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.delay(100),
      ])
    );

    loopLeft.start();
    loopRight.start();

    return () => {
      loopLeft.stop();
      loopRight.stop();
    };
  }, [fadeAnim, leftSwipeAnim, rightSwipeAnim]);

  const handleDismiss = async () => {
    await markSwipeOnboardingSeen();
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(onDismiss);
  };

  return (
    <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
      <View style={styles.card}>
        <Text style={styles.title}>Dica de Gestos</Text>
        <Text style={styles.subtitle}>
          Deslize os cards das paradas para ações rápidas
        </Text>

        {/* Swipe Left Instruction */}
        <View style={styles.gestureRow}>
          <Animated.View
            style={[
              styles.gestureIcon,
              { backgroundColor: theme.colors.warning + '20' },
              { transform: [{ translateX: leftSwipeAnim }] },
            ]}
          >
            <Ionicons name="arrow-back" size={24} color={theme.colors.warning} />
          </Animated.View>
          <View style={styles.gestureText}>
            <Text style={styles.gestureLabel}>Deslize para esquerda</Text>
            <Text style={styles.gestureDesc}>Pular parada</Text>
          </View>
        </View>

        {/* Swipe Right Instruction */}
        <View style={styles.gestureRow}>
          <Animated.View
            style={[
              styles.gestureIcon,
              { backgroundColor: theme.colors.success + '20' },
              { transform: [{ translateX: rightSwipeAnim }] },
            ]}
          >
            <Ionicons name="arrow-forward" size={24} color={theme.colors.success} />
          </Animated.View>
          <View style={styles.gestureText}>
            <Text style={styles.gestureLabel}>Deslize para direita</Text>
            <Text style={styles.gestureDesc}>Concluir parada</Text>
          </View>
        </View>

        {/* Dismiss button */}
        <TouchableOpacity style={styles.button} onPress={handleDismiss} activeOpacity={0.8}>
          <Text style={styles.buttonText}>Entendi!</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  overlay: {
    ...Platform.select({
      web: { position: 'fixed' as any },
      default: { position: 'absolute' },
    }),
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    padding: theme.spacing.xl,
  },
  card: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    ...theme.shadows.lg,
  },
  title: {
    fontFamily: theme.typography.fontSansBold,
    fontSize: theme.typography.fontSize.xl,
    color: theme.colors.gray900,
    marginBottom: theme.spacing['1'],
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: theme.typography.fontSans,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray500,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
    lineHeight: theme.typography.fontSize.sm * 1.5,
  },
  gestureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: theme.spacing.md,
    gap: theme.spacing['3'],
  },
  gestureIcon: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gestureText: {
    flex: 1,
  },
  gestureLabel: {
    fontFamily: theme.typography.fontSansSemiBold,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray800,
  },
  gestureDesc: {
    fontFamily: theme.typography.fontSans,
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray500,
    marginTop: 2,
  },
  button: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing['3'],
    paddingHorizontal: theme.spacing.xl,
    marginTop: theme.spacing.lg,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    fontFamily: theme.typography.fontSansBold,
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.white,
  },
}));

export default SwipeOnboarding;
