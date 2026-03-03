/**
 * ParadaCardSkeleton - Skeleton loading para cards de parada do motorista
 * Melhora UX mostrando estrutura do card enquanto carrega
 */

import React from 'react';
import { View } from 'react-native';

import { ShimmerBox } from '@/components/ShimmerBox';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

export function ParadaCardSkeleton() {
  const { theme } = useUnistyles();
  const styles = makeStyles(theme);

  return (
    <View style={styles.card}>
      {/* Header com badges */}
      <View style={styles.header}>
        <ShimmerBox style={styles.ordemBadge} />
        <ShimmerBox style={styles.statusBadge} />
        <ShimmerBox style={styles.tipoBadge} />
      </View>

      {/* Endereço */}
      <View style={styles.enderecoContainer}>
        <ShimmerBox style={styles.enderecoLine1} />
        <ShimmerBox style={styles.enderecoLine2} />
      </View>

      {/* Detalhes */}
      <View style={styles.detalhesContainer}>
        <ShimmerBox style={styles.detalhe} />
        <ShimmerBox style={styles.detalhe} />
      </View>

      {/* Ações */}
      <View style={styles.acoesContainer}>
        <ShimmerBox style={styles.botao} />
        <ShimmerBox style={styles.botao} />
      </View>

      {/* Swipe hint */}
      <View style={styles.swipeHintContainer}>
        <ShimmerBox style={styles.swipeHint} />
      </View>
    </View>
  );
}

// Componente para lista de skeletons
export function ParadaCardSkeletonList({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <ParadaCardSkeleton key={index} />
      ))}
    </>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.colors.white,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.sm,
      borderWidth: 1,
      borderColor: theme.colors.gray200,
      ...theme.shadows.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.sm,
    },
    ordemBadge: {
      width: theme.spacing.xl,
      height: theme.spacing.xl,
      borderRadius: theme.borderRadius.full,
    },
    statusBadge: {
      width: 80,
      height: 24,
      borderRadius: theme.borderRadius.full,
    },
    tipoBadge: {
      width: 60,
      height: 24,
      borderRadius: theme.borderRadius.full,
    },
    enderecoContainer: {
      gap: theme.spacing.xs,
      marginBottom: theme.spacing.sm,
    },
    enderecoLine1: {
      width: '90%',
      height: 16,
    },
    enderecoLine2: {
      width: '60%',
      height: 16,
    },
    detalhesContainer: {
      flexDirection: 'row',
      gap: theme.spacing.md,
      marginBottom: theme.spacing.sm,
    },
    detalhe: {
      width: 100,
      height: 14,
    },
    acoesContainer: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      marginTop: theme.spacing.sm,
    },
    botao: {
      flex: 1,
      height: 44,
      borderRadius: theme.borderRadius.md,
    },
    swipeHintContainer: {
      alignItems: 'center',
      marginTop: theme.spacing.sm,
    },
    swipeHint: {
      width: 140,
      height: 28,
      borderRadius: theme.borderRadius.sm,
    },
  });
