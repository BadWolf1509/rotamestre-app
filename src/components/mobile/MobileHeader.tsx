import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

import { StyleSheet, type Theme } from '@/utils/styles';

interface MobileHeaderProps {
  title: string;
  subtitle?: string;
  rightContent?: React.ReactNode;
  showBack?: boolean;
  onBack?: () => void;
}

/**
 * Componente padronizado para headers em telas mobile
 * Segue o padrão de design estabelecido para o RotaMestre
 */
export function MobileHeader({ title, subtitle, rightContent, showBack, onBack }: MobileHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.headerContent}>
        {showBack && onBack && (
          <TouchableOpacity
            onPress={onBack}
            style={styles.backButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
        )}
        <View style={styles.textContainer}>
          <Text style={styles.headerTitle}>{title}</Text>
          {subtitle && <Text style={styles.headerSubtitle}>{subtitle}</Text>}
        </View>
        {rightContent && <View style={styles.rightContent}>{rightContent}</View>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
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
  backButton: {
    marginRight: theme.spacing.md,
    padding: theme.spacing.xs,
  },
  backIcon: {
    fontSize: 24,
    color: theme.colors.gray700,
    fontWeight: '600',
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
