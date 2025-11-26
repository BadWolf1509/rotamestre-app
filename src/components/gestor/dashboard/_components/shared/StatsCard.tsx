import { Ionicons } from '@expo/vector-icons';
import { View, Text } from 'react-native';

import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

interface StatsCardProps {
  value: string | number;
  label: string;
  backgroundColor?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  change?: number;
  changeLabel?: string;
  trend?: 'up' | 'down' | 'neutral';
  variant?: 'simple' | 'detailed';
}

/**
 * Card de estatística unificado - mobile e desktop
 * Suporta modo simples (compatível com versão anterior) e detalhado
 */
export function StatsCard({
  value,
  label,
  backgroundColor,
  icon,
  iconColor,
  change,
  changeLabel,
  trend = 'neutral',
  variant = 'simple'
}: StatsCardProps) {
  const { theme } = useUnistyles();

  // Modo simples - compatível com versão anterior
  if (variant === 'simple' && backgroundColor) {
    return (
      <View style={[styles.containerSimple, { backgroundColor }]}>
        <Text style={styles.valueSimple}>{value}</Text>
        <Text style={styles.labelSimple}>{label}</Text>
      </View>
    );
  }

  // Modo detalhado - novo design com trends
  const getTrendColor = () => {
    switch (trend) {
      case 'up':
        return theme.colors.success;
      case 'down':
        return theme.colors.error;
      default:
        return theme.colors.gray500;
    }
  };

  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return 'trending-up';
      case 'down':
        return 'trending-down';
      default:
        return 'remove';
    }
  };

  return (
    <View style={[styles.container, backgroundColor && { backgroundColor }]}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        {icon && (
          <View style={[styles.iconContainer, { backgroundColor: (iconColor || theme.colors.primary) + '15' }]}>
            <Ionicons name={icon} size={20} color={iconColor || theme.colors.primary} />
          </View>
        )}
      </View>
      <Text style={styles.value}>{value}</Text>
      {change !== undefined && (
        <View style={styles.changeContainer}>
          <Ionicons name={getTrendIcon()} size={16} color={getTrendColor()} />
          <Text style={[styles.changeText, { color: getTrendColor() }]}>
            {change > 0 ? '+' : ''}{change}%
          </Text>
          {changeLabel && (
            <Text style={styles.changeLabel}>{changeLabel}</Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  // Modo detalhado (padrão)
  container: {
    backgroundColor: theme.colors.white,
    padding: theme.spacing.xl,
    borderRadius: theme.borderRadius.lg,
    ...theme.shadows.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.colors.gray600,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.gray900,
    marginTop: 4,
  },
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  changeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  changeLabel: {
    fontSize: 13,
    color: theme.colors.gray500,
    marginLeft: 4,
  },

  // Modo simples (compatibilidade)
  containerSimple: {
    padding: theme.spacing.xl,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    ...theme.shadows.md,
  },
  valueSimple: {
    fontSize: 32,
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.white,
  },
  labelSimple: {
    fontSize: theme.typography.xs,
    color: theme.colors.white,
    marginTop: 4,
    opacity: 0.9,
  },
}));
