import React from 'react';
import { View, Text, ActivityIndicator, ViewStyle } from 'react-native';

import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

interface MobileLoadingProps {
  message?: string;
  size?: 'small' | 'large';
  fullScreen?: boolean;
  color?: string;
  style?: ViewStyle;
}

/**
 * Componente padronizado para indicadores de carregamento em telas mobile
 * Segue o padrão de design estabelecido para o RotaMestre
 */
export function MobileLoading({
  message = 'Carregando...',
  size = 'large',
  fullScreen = true,
  color,
  style,
}: MobileLoadingProps) {
  const { theme } = useUnistyles();
  const indicatorColor = color || theme.colors.primary;

  const content = (
    <>
      <ActivityIndicator size={size} color={indicatorColor} />
      {message && <Text style={styles.loadingText}>{message}</Text>}
    </>
  );

  if (fullScreen) {
    return (
      <View style={[styles.containerFullScreen, style]}>
        {content}
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    padding: theme.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  containerFullScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.gray50,
  },
  loadingText: {
    marginTop: theme.spacing.lg,
    fontSize: theme.typography.sm,
    color: theme.colors.gray500,
  },
}));
