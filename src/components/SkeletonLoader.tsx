import { View, type ViewStyle, type DimensionValue } from 'react-native';

import { ShimmerBox } from '@/components/ShimmerBox';
import { StyleSheet, type Theme } from '@/utils/styles';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

/**
 * Componente base de skeleton com efeito shimmer animado.
 * Delegates to ShimmerBox for premium gradient shimmer on web / opacity pulse on native.
 */
export function Skeleton({ width = '100%', height = 20, borderRadius = 4, style }: SkeletonProps) {
  return (
    <ShimmerBox
      style={[
        styles.skeleton,
        {
          width: width as DimensionValue,
          height,
          borderRadius,
        },
        style,
      ]}
    />
  );
}

/**
 * Skeleton card genérico com avatar e texto
 */
export function SkeletonCard() {
  return (
    <View style={styles.card}>
      <Skeleton width={60} height={60} borderRadius={30} style={{ marginBottom: 12 }} />
      <Skeleton width="80%" height={20} style={{ marginBottom: 8 }} />
      <Skeleton width="60%" height={16} />
    </View>
  );
}

/**
 * Lista de skeletons genéricos
 */
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

const styles = StyleSheet.create((theme: Theme) => ({
  skeleton: {
    backgroundColor: theme.colors.gray200,
  },
  card: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.md,
  },
  listItem: {
    flexDirection: 'row',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.md,
  },
}));
