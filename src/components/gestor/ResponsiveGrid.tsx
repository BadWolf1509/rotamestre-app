import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useResponsive } from '@/hooks/useResponsive';
import { StyleSheet } from '@/utils/styles';

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

  // Calcular ordem
  const getOrder = () => {
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
          width: getWidth(),
          order: getOrder(),
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
                  color={trend === 'up' ? '#10b981' : trend === 'down' ? '#ef4444' : '#6b7280'}
                />
              </View>
            )}
          </View>
          {subtitle && <Text style={styles.metricSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      {isDesktop && (
        <TouchableOpacity style={styles.metricAction}>
          <Ionicons name="ellipsis-vertical" size={16} color="#6b7280" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create(theme => ({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridItem: {
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  // Metric Card Styles
  metricCard: {
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    padding: 20,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
    position: 'relative',
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  metricIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: theme.colors.blue50,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  metricContent: {
    flex: 1,
  },
  metricTitle: {
    fontSize: 12,
    color: theme.colors.gray500,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.gray900,
  },
  metricSubtitle: {
    fontSize: 12,
    color: theme.colors.gray500,
    marginTop: 4,
  },
  trendBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
  },
  trendup: {
    backgroundColor: '#d1fae5',
  },
  trenddown: {
    backgroundColor: '#fee2e2',
  },
  trendneutral: {
    backgroundColor: '#f3f4f6',
  },
  metricAction: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 4,
  },
}));
