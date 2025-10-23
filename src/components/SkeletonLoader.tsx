import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, ViewStyle } from 'react-native';
import { colors, spacing, borderRadius } from '@/lib/design-tokens';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width = '100%', height = 20, borderRadius = 4, style }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
}

// Componentes específicos
export function SkeletonCard() {
  return (
    <View style={styles.card}>
      <Skeleton width={60} height={60} borderRadius={30} style={{ marginBottom: 12 }} />
      <Skeleton width="80%" height={20} style={{ marginBottom: 8 }} />
      <Skeleton width="60%" height={16} />
    </View>
  );
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  // ⚠️ PERFORMANCE: Limitar a 7 skeletons para evitar lag em dispositivos antigos
  const safeCount = Math.min(count, 7);

  return (
    <View>
      {Array.from({ length: safeCount }).map((_, i) => (
        <View key={i} style={styles.listItem}>
          <Skeleton width={40} height={40} borderRadius={8} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Skeleton width="70%" height={16} style={{ marginBottom: 8 }} />
            <Skeleton width="50%" height={14} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function SkeletonDashboard() {
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Skeleton width={150} height={24} style={{ marginBottom: 8 }} />
        <Skeleton width={100} height={16} />
      </View>

      {/* Stats Cards */}
      <View style={styles.statsRow}>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={styles.statCard}>
            <Skeleton width={50} height={40} style={{ marginBottom: 8 }} />
            <Skeleton width={60} height={14} />
          </View>
        ))}
      </View>

      {/* List */}
      <SkeletonList count={5} />
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: colors.gray[200],
  },
  card: {
    padding: spacing.md,
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
  },
  listItem: {
    flexDirection: 'row',
    padding: spacing.md,
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
    padding: spacing.md,
  },
  header: {
    marginBottom: spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    padding: spacing.md,
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
});
