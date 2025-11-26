import React from 'react';
import { View, Text, ViewStyle, TouchableOpacity } from 'react-native';

import { StyleSheet, type Theme } from '@/utils/styles';

interface MobileCardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  style?: ViewStyle;
  variant?: 'default' | 'highlight' | 'bordered';
  noPadding?: boolean;
  onPress?: () => void;
}

/**
 * Componente padronizado para cards em telas mobile
 * Segue o padrão de design estabelecido para o RotaMestre
 */
export function MobileCard({
  children,
  title,
  subtitle,
  style,
  variant = 'default',
  noPadding = false,
  onPress
}: MobileCardProps) {
  const content = (
    <>
      {(title || subtitle) && (
        <View style={styles.cardHeader}>
          {title && <Text style={styles.cardTitle}>{title}</Text>}
          {subtitle && <Text style={styles.cardSubtitle}>{subtitle}</Text>}
        </View>
      )}
      {children}
    </>
  );

  const cardStyle = [
    styles.card,
    variant === 'highlight' && styles.cardHighlight,
    variant === 'bordered' && styles.cardBordered,
    noPadding && styles.noPadding,
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity style={cardStyle} onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyle}>{content}</View>;
}

const styles = StyleSheet.create((theme: Theme) => ({
  card: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    ...theme.shadows.sm,
  },
  cardHighlight: {
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
  },
  cardBordered: {
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
  noPadding: {
    padding: 0,
  },
  cardHeader: {
    marginBottom: theme.spacing.md,
  },
  cardTitle: {
    fontSize: theme.typography.lg,
    fontWeight: '600',
    color: theme.colors.gray900,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray500,
  },
}));
