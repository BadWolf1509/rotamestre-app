/**
 * EmptyState - Componente de estado vazio para reordenação
 *
 * Exibe mensagem quando:
 * - Rota não pode ser reordenada (concluída/cancelada)
 * - Não há paradas para reordenar
 */

import { Ionicons } from '@expo/vector-icons';
import React, { memo } from 'react';
import { View, Text } from 'react-native';

import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

export type EmptyStateVariant = 'locked' | 'empty';

export interface EmptyStateProps {
  variant: EmptyStateVariant;
}

export const EmptyState = memo(function EmptyState({ variant }: EmptyStateProps) {
  const { theme } = useUnistyles();

  const config = {
    locked: {
      icon: 'lock-closed-outline' as const,
      message: 'A ordem das paradas só pode ser alterada em rotas pendentes ou em andamento.',
    },
    empty: {
      icon: 'list-outline' as const,
      message: 'Nenhuma parada para reordenar.',
    },
  };

  const { icon, message } = config[variant];

  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={32} color={theme.colors.gray400} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
});

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  text: {
    marginTop: theme.spacing.md,
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray500,
    textAlign: 'center',
  },
}));
