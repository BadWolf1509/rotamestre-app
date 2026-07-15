/**
 * FixedStopsList - Lista de paradas fixas (concluídas/puladas)
 *
 * Exibe paradas que não podem ser reordenadas com visual esmaecido
 */

import { Ionicons } from '@expo/vector-icons';
import React, { memo } from 'react';
import { View, Text } from 'react-native';

import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

import { StopCard } from './StopCard';

import type { Parada } from '../types';

export interface FixedStopsListProps {
  paradas: Parada[];
  /** Modo desktop para densidade compacta */
  isDesktop?: boolean;
}

export const FixedStopsList = memo(function FixedStopsList({
  paradas,
  isDesktop = false,
}: FixedStopsListProps) {
  const { theme } = useUnistyles();

  if (paradas.length === 0) {
    return null;
  }

  return (
    <View style={[styles.container, isDesktop && styles.containerCompact]}>
      <View
        style={[
          styles.labelContainer,
          isDesktop && styles.labelContainerCompact,
        ]}
      >
        <Ionicons
          name="lock-closed"
          size={isDesktop ? 10 : 12}
          color={theme.colors.gray500}
        />
        <Text style={[styles.labelText, isDesktop && styles.labelTextCompact]}>
          Paradas com ordem fixa
        </Text>
      </View>
      {paradas.map((parada) => (
        <StopCard
          key={parada.id}
          parada={parada}
          displayIndex={parada.ordem}
          variant="fixed"
          isDesktop={isDesktop}
        />
      ))}
    </View>
  );
});

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    padding: theme.spacing.md,
  },
  containerCompact: {
    padding: theme.desktop.section.gap,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing['1.5'],
    marginBottom: theme.spacing.sm,
  },
  labelContainerCompact: {
    gap: theme.spacing['1'],
    marginBottom: theme.spacing['1.5'],
  },
  labelText: {
    fontSize: theme.typography.xs,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  labelTextCompact: {
    fontSize: theme.typography.fontSize.xs, // Min readable (WCAG AA)
  },
}));
