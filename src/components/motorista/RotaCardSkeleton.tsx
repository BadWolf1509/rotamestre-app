/**
 * RotaCardSkeleton - Skeleton loading para cards de rota no histórico
 * Melhora UX mostrando estrutura do card enquanto carrega
 */

import React from 'react';
import { View } from 'react-native';

import { ShimmerBox } from '@/components/ShimmerBox';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

export function RotaCardSkeleton() {
  const { theme } = useUnistyles();
  const styles = makeStyles(theme);

  return (
    <View style={styles.card}>
      {/* Header: Data e Status Badge */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <ShimmerBox style={styles.dataLine} />
          <ShimmerBox style={styles.unidadeLine} />
        </View>
        <ShimmerBox style={styles.statusBadge} />
      </View>

      {/* Stats: Paradas, Concluídas, Taxa */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <ShimmerBox style={styles.statValue} />
          <ShimmerBox style={styles.statLabel} />
        </View>
        <View style={styles.statItem}>
          <ShimmerBox style={styles.statValue} />
          <ShimmerBox style={styles.statLabel} />
        </View>
        <View style={styles.statItem}>
          <ShimmerBox style={styles.statValue} />
          <ShimmerBox style={styles.statLabel} />
        </View>
      </View>

      {/* Expand indicator */}
      <View style={styles.expandIndicator}>
        <ShimmerBox style={styles.expandText} />
      </View>
    </View>
  );
}

// Componente para lista de skeletons
export function RotaCardSkeletonList({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <RotaCardSkeleton key={index} />
      ))}
    </>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.colors.white,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
      marginBottom: theme.spacing.md,
      borderLeftWidth: 4,
      borderLeftColor: theme.colors.gray300,
      ...theme.shadows.sm,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: theme.spacing.md,
    },
    headerLeft: {
      flex: 1,
      gap: theme.spacing.xs,
    },
    dataLine: {
      width: 140,
      height: 18,
    },
    unidadeLine: {
      width: 180,
      height: 14,
    },
    statusBadge: {
      width: 80,
      height: 28,
      borderRadius: theme.borderRadius.lg,
    },
    statsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingVertical: theme.spacing.sm,
    },
    statItem: {
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    statValue: {
      width: 32,
      height: 24,
    },
    statLabel: {
      width: 56,
      height: 12,
    },
    expandIndicator: {
      marginTop: theme.spacing.md,
      alignItems: 'center',
    },
    expandText: {
      width: 100,
      height: 14,
    },
  });
