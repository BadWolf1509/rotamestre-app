import React from 'react';
import { View, Text } from 'react-native';
import { StyleSheet, useUnistyles } from '@/utils/styles';

interface MobileHeaderProps {
  title: string;
  subtitle?: string;
  rightContent?: React.ReactNode;
}

/**
 * Componente padronizado para headers em telas mobile
 * Segue o padrão de design estabelecido para o RotaMestre
 */
export function MobileHeader({ title, subtitle, rightContent }: MobileHeaderProps) {
  const { theme } = useUnistyles();

  return (
    <View style={styles.header}>
      <View style={styles.headerContent}>
        <View style={styles.textContainer}>
          <Text style={styles.headerTitle}>{title}</Text>
          {subtitle && <Text style={styles.headerSubtitle}>{subtitle}</Text>}
        </View>
        {rightContent && <View style={styles.rightContent}>{rightContent}</View>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create(theme => ({
  header: {
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
    paddingHorizontal: theme.spacing['3xl'],
    paddingVertical: theme.spacing['2xl'],
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: theme.typography['3xl'],
    fontFamily: theme.typography.fontDisplay,
    color: theme.colors.gray900,
  },
  headerSubtitle: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray500,
    marginTop: 4,
  },
  rightContent: {
    marginLeft: theme.spacing.md,
  },
}));