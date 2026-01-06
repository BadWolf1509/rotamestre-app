import React from 'react';
import { View, Text, ViewStyle } from 'react-native';

import { StyleSheet, type Theme } from '@/utils/styles';

import { MobileButton } from './MobileButton';

interface MobileEmptyStateProps {
  icon?: string;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
  fullScreen?: boolean;
}

/**
 * Componente padronizado para estados vazios em telas mobile
 * Segue o padrão de design estabelecido para o RotaMestre
 */
export function MobileEmptyState({
  icon = '📋',
  title,
  subtitle,
  actionLabel,
  onAction,
  style,
  fullScreen = false,
}: MobileEmptyStateProps) {
  return (
    <View style={[
      fullScreen ? styles.containerFullScreen : styles.container,
      style,
    ]}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}

      {actionLabel && onAction && (
        <View style={styles.actionContainer}>
          <MobileButton
            title={actionLabel}
            variant="primary"
            size="medium"
            onPress={onAction}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    padding: theme.spacing['3xl'],
    alignItems: 'center',
  },
  containerFullScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing['3xl'],
    backgroundColor: theme.colors.gray50,
  },
  icon: {
    fontSize: theme.typography.fontSize['4xl'] + 28,
    marginBottom: theme.spacing['2xl'],
  },
  title: {
    fontSize: theme.typography.lg,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray500,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  actionContainer: {
    marginTop: theme.spacing.xl,
  },
}));
