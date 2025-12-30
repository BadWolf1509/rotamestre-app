/**
 * LoadingOverlay - Overlay de carregamento durante salvamento
 */

import React, { memo } from 'react';
import { View, Text, ActivityIndicator, Platform } from 'react-native';

import { withOpacity } from '@/utils/color';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

export interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
}

export const LoadingOverlay = memo(function LoadingOverlay({
  visible,
  message = 'Salvando nova ordem...',
}: LoadingOverlayProps) {
  const { theme } = useUnistyles();

  if (!visible) {
    return null;
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
});

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    ...Platform.select({
      web: {
        position: 'absolute' as const,
      },
      default: {
        position: 'absolute',
      },
    }),
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: withOpacity(theme.colors.white, 0.9),
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  text: {
    marginTop: theme.spacing.md,
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray600,
  },
}));
