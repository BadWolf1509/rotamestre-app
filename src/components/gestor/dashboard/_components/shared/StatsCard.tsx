import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Platform, View, Text } from 'react-native';

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
 * Memoizado para evitar re-renders desnecessários em listas
 */
export const StatsCard = memo(function StatsCard({
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
  const statsTokens = theme.components.statsCard;

  // Modo simples - compatível com versão anterior
  if (variant === 'simple' && backgroundColor) {
    return (
      <View style={[styles.containerSimple, { backgroundColor }]}>
        {icon && (
          <View style={styles.simpleIconContainer}>
            <Ionicons name={icon} size={16} color="rgba(255,255,255,0.85)" />
          </View>
        )}
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
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: (iconColor || theme.colors.primary) + '15' },
            ]}
          >
            <Ionicons
              name={icon}
              size={statsTokens.iconSize}
              color={iconColor || theme.colors.primary}
            />
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
});

const styles = StyleSheet.create((theme: Theme) => ({
  // Modo detalhado (padrão)
  container: {
    backgroundColor: theme.colors.white,
    padding: theme.components.statsCard.padding,
    borderRadius: theme.components.statsCard.radius,
    ...theme.shadows.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.xs,
  },
  label: {
    fontSize: theme.components.statsCard.labelFontSize,
    fontWeight: '500',
    color: theme.colors.gray600,
    textTransform: 'uppercase',
    letterSpacing: theme.components.statsCard.labelLetterSpacing,
  },
  iconContainer: {
    width: theme.components.statsCard.iconContainerSize,
    height: theme.components.statsCard.iconContainerSize,
    borderRadius: theme.components.statsCard.iconContainerRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: theme.typography.fontSize['2xl'],
    fontFamily: theme.typography.fontDisplay,
    color: theme.colors.gray900,
    letterSpacing: -0.5,
    marginTop: theme.spacing.xs,
    ...(Platform.OS === 'web' && { fontVariantNumeric: 'tabular-nums' as any }),
  },
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },
  changeText: {
    fontSize: theme.components.statsCard.changeFontSize,
    fontWeight: '600',
  },
  changeLabel: {
    fontSize: theme.components.statsCard.changeFontSize,
    color: theme.colors.gray500,
    marginLeft: theme.spacing.xs,
  },

  // Modo simples (compatibilidade)
  containerSimple: {
    padding: theme.components.statsCard.padding,
    borderRadius: theme.components.statsCard.radius,
    alignItems: 'center',
    ...theme.shadows.md,
  },
  simpleIconContainer: {
    position: 'absolute',
    top: theme.spacing.sm,
    right: theme.spacing.sm,
  },
  valueSimple: {
    fontSize: theme.components.statsCard.valueFontSize + 4,
    fontFamily: theme.typography.fontDisplay,
    color: theme.colors.white,
    letterSpacing: -0.5,
    ...(Platform.OS === 'web' && { fontVariantNumeric: 'tabular-nums' as any }),
  },
  labelSimple: {
    fontSize: theme.typography.xs,
    color: theme.colors.white,
    marginTop: theme.spacing.xs,
    opacity: 0.9,
  },
}));
