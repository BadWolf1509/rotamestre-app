import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  DimensionValue,
} from 'react-native';

import { useResponsive } from '@/hooks/useResponsive';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

interface ResponsiveGridProps {
  children: React.ReactNode;
  spacing?: number;
  scrollable?: boolean;
}

interface GridItemProps {
  children: React.ReactNode;
  span?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
  };
  order?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
  };
}

/**
 * Sistema de Grid Responsivo
 *
 * Breakpoints:
 * - Mobile: 1 coluna
 * - Tablet: 2 colunas
 * - Desktop: 4 colunas
 *
 * @example
 * ```tsx
 * <ResponsiveGrid>
 *   <GridItem span={{ desktop: 2, tablet: 1, mobile: 1 }}>
 *     <MetricCard />
 *   </GridItem>
 *   <GridItem span={{ desktop: 1, tablet: 1, mobile: 1 }}>
 *     <StatusCard />
 *   </GridItem>
 * </ResponsiveGrid>
 * ```
 */
export function ResponsiveGrid({
  children,
  spacing = 16,
  scrollable = false,
}: ResponsiveGridProps) {
  const gridStyles = [
    styles.grid,
    {
      padding: spacing,
      gap: spacing,
    },
  ];

  const Container = scrollable ? ScrollView : View;
  const containerProps = scrollable
    ? { showsVerticalScrollIndicator: Platform.OS === 'web', contentContainerStyle: gridStyles }
    : { style: gridStyles };

  return (
    <Container {...containerProps}>
      {React.Children.map(children, (child) => child)}
    </Container>
  );
}

/**
 * Item do Grid
 *
 * @param span - Quantas colunas o item deve ocupar em cada breakpoint
 * @param order - Ordem de exibição em cada breakpoint (útil para reorganizar em mobile)
 */
export function GridItem({ children, span = {}, order = {} }: GridItemProps) {
  const { isDesktop, isTablet, isMobile } = useResponsive();

  // Calcular largura baseado no span
  const getWidth = () => {
    if (isMobile) {
      const mobileSpan = span.mobile || 1;
      return `${mobileSpan * 100}%`;
    }
    if (isTablet) {
      const tabletSpan = span.tablet || 1;
      return `${(tabletSpan / 2) * 100}%`;
    }
    if (isDesktop) {
      const desktopSpan = span.desktop || 1;
      return `${(desktopSpan / 4) * 100}%`;
    }
    return '100%';
  };

  // Calcular ordem (web-only, kept for future use)
  const _getOrder = () => {
    if (isMobile) return order.mobile || 0;
    if (isTablet) return order.tablet || 0;
    if (isDesktop) return order.desktop || 0;
    return 0;
  };

  return (
    <View
      style={[
        styles.gridItem,
        {
          width: getWidth() as DimensionValue,
          // order is web-only, handled by flexbox
        },
      ]}
    >
      {children}
    </View>
  );
}

/**
 * Container de métricas responsivo
 */
interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  color?: string;
}

export function MetricCard({ title, value, subtitle, icon, trend, color }: MetricCardProps) {
  const { isDesktop } = useResponsive();
  const { theme } = useUnistyles();

  return (
    <View style={[styles.metricCard, { borderLeftColor: color }]}>
      <View style={styles.metricHeader}>
        {icon && <View style={styles.metricIcon}>{icon}</View>}
        <View style={styles.metricContent}>
          <Text style={styles.metricTitle}>{title}</Text>
          <View style={styles.metricValueRow}>
            <Text style={styles.metricValue}>{value}</Text>
            {trend && (
              <View style={[styles.trendBadge, styles[`trend${trend}`]]}>
                <Ionicons
                  name={trend === 'up' ? 'trending-up' : trend === 'down' ? 'trending-down' : 'remove'}
                  size={16}
                  color={trend === 'up' ? theme.colors.success : trend === 'down' ? theme.colors.error : theme.colors.gray500}
                />
              </View>
            )}
          </View>
          {subtitle && <Text style={styles.metricSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      {isDesktop && (
        <TouchableOpacity style={styles.metricAction}>
          <Ionicons name="ellipsis-vertical" size={16} color={theme.colors.gray500} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridItem: {
    paddingHorizontal: theme.spacing.xs,
    marginBottom: theme.spacing.md,
  },
  // Metric Card Styles - unified with statsCard tokens
  metricCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.components.statsCard.radius,
    padding: theme.components.statsCard.padding,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
    ...theme.shadows.md,
    position: 'relative',
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  metricIcon: {
    width: theme.components.statsCard.iconContainerSize + theme.spacing.xs,
    height: theme.components.statsCard.iconContainerSize + theme.spacing.xs,
    borderRadius: theme.components.statsCard.iconContainerRadius,
    backgroundColor: theme.colors.blue50,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.sm,
  },
  metricContent: {
    flex: 1,
  },
  metricTitle: {
    fontSize: theme.components.statsCard.labelFontSize,
    color: theme.colors.gray500,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: theme.components.statsCard.labelLetterSpacing,
    marginBottom: theme.spacing.xs,
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  metricValue: {
    fontSize: theme.components.statsCard.valueFontSize,
    fontWeight: 'bold',
    color: theme.colors.gray900,
  },
  metricSubtitle: {
    fontSize: theme.components.statsCard.labelFontSize,
    color: theme.colors.gray500,
    marginTop: theme.spacing.xs,
  },
  trendBadge: {
    paddingHorizontal: theme.spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.full,
  },
  trendup: {
    backgroundColor: theme.colors.successBg,
  },
  trenddown: {
    backgroundColor: theme.colors.errorBg,
  },
  trendneutral: {
    backgroundColor: theme.colors.gray100,
  },
  metricAction: {
    position: 'absolute',
    top: theme.spacing.md,
    right: theme.spacing.md,
    padding: theme.spacing.xs,
  },
}));
