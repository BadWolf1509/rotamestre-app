import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, useUnistyles } from '@/utils/styles';

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
}: DesktopCardProps) {
  const { theme } = useUnistyles();

  const cardStyles = [
    styles.card,
    variant === 'outlined' && styles.cardOutlined,
    variant === 'elevated' && styles.cardElevated,
  ];

  const CardWrapper = onPress ? TouchableOpacity : View;

  return (
    <CardWrapper style={cardStyles} onPress={onPress} activeOpacity={0.95}>
      {(title || subtitle || icon || actions) && (
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {icon && (
              <View style={[styles.iconContainer, iconColor && { backgroundColor: iconColor + '15' }]}>
                <Ionicons name={icon} size={20} color={iconColor || theme.colors.primary} />
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
      {React.Children.map(children, (child, index) => (
        <View style={[styles.gridItem, { flex: 1 / columns }]}>
          {child}
        </View>
      ))}
    </View>
  );
}


const styles = StyleSheet.create(theme => ({
  // Card Styles
  card: {
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardOutlined: {
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
  cardElevated: {
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.gray900,
  },
  subtitle: {
    fontSize: 13,
    color: theme.colors.gray500,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  content: {
    padding: 20,
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