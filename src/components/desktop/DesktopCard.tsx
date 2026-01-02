import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, TouchableOpacity, View, ViewStyle } from 'react-native';

import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

interface DesktopCardProps {
  title?: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  onPress?: () => void;
  variant?: 'default' | 'outlined' | 'elevated';
  noPadding?: boolean;
  className?: string;
  style?: ViewStyle;
}

export function DesktopCard({
  title,
  subtitle,
  icon,
  iconColor,
  children,
  actions,
  onPress,
  variant = 'default',
  noPadding = false,
  style,
}: DesktopCardProps) {
  const { theme } = useUnistyles();

  const cardStyles = [
    styles.card,
    variant === 'outlined' && styles.cardOutlined,
    variant === 'elevated' && styles.cardElevated,
    style,
  ];

  const CardWrapper = onPress ? TouchableOpacity : View;

  return (
    <CardWrapper style={cardStyles} onPress={onPress} activeOpacity={0.95}>
      {(title || subtitle || icon || actions) && (
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {icon && (
              <View style={[styles.iconContainer, iconColor && { backgroundColor: iconColor + '15' }]}>
                <Ionicons name={icon} size={theme.components.desktopCard.iconSize} color={iconColor || theme.colors.primary} />
              </View>
            )}
            <View style={styles.headerText}>
              {title && <Text style={styles.title}>{title}</Text>}
              {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            </View>
          </View>
          {actions && <View style={styles.actions}>{actions}</View>}
        </View>
      )}
      <View style={[styles.content, noPadding && styles.contentNoPadding]}>
        {children}
      </View>
    </CardWrapper>
  );
}

// Grid Layout Component for Cards
interface DesktopCardGridProps {
  columns?: number;
  gap?: number;
  children: React.ReactNode;
}

export function DesktopCardGrid({
  columns = 3,
  gap = 24,
  children
}: DesktopCardGridProps) {
  return (
    <View style={[styles.grid, { gap }]}>
      {React.Children.map(children, (child) => (
        <View style={[styles.gridItem, { flex: 1 / columns }]}>
          {child}
        </View>
      ))}
    </View>
  );
}


const styles = StyleSheet.create((theme: Theme) => ({
  // Card Styles
  card: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.components.desktopCard.borderRadius,
    overflow: 'hidden',
  },
  cardOutlined: {
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
  cardElevated: {
    ...theme.shadows.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.components.desktopCard.headerPadding,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.components.desktopCard.headerGap,
    flex: 1,
  },
  iconContainer: {
    width: theme.components.desktopCard.iconContainerSize,
    height: theme.components.desktopCard.iconContainerSize,
    borderRadius: theme.components.desktopCard.iconContainerRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: theme.components.desktopCard.titleFontSize,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
  },
  subtitle: {
    fontSize: theme.components.desktopCard.subtitleFontSize,
    color: theme.colors.gray500,
    marginTop: theme.spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.components.desktopCard.actionsGap,
  },
  content: {
    padding: theme.components.desktopCard.contentPadding,
  },
  contentNoPadding: {
    padding: 0,
  },

  // Grid Styles
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridItem: {
    minWidth: 250,
  },
}));
