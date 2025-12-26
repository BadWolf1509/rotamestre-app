/**
 * Instructions - Componente de instruções para reordenação
 *
 * Exibe instruções contextuais baseadas na plataforma (web vs mobile)
 */

import { Ionicons } from '@expo/vector-icons';
import React, { memo } from 'react';
import { View, Text, Platform } from 'react-native';

import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

export interface InstructionsProps {
  /** Força um modo específico (para testes) */
  forceMode?: 'web' | 'mobile';
  /** Modo desktop para densidade compacta */
  isDesktop?: boolean;
}

export const Instructions = memo(function Instructions({ forceMode, isDesktop = false }: InstructionsProps) {
  const { theme } = useUnistyles();
  const isWeb = forceMode === 'web' || (forceMode !== 'mobile' && Platform.OS === 'web');

  return (
    <View style={[styles.container, isDesktop && styles.containerCompact]}>
      <Ionicons name="swap-vertical" size={isDesktop ? 14 : 18} color={theme.colors.secondary} />
      <Text style={[styles.text, isDesktop && styles.textCompact]}>
        {isWeb
          ? 'Use as setas para alterar a ordem'
          : 'Arraste as paradas para alterar a ordem'}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
  },
  containerCompact: {
    gap: 6,
    paddingHorizontal: theme.desktop.section.gap,
    paddingVertical: 6,
  },
  text: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray600,
  },
  textCompact: {
    fontSize: theme.desktop.input.fontSize,
  },
}));
