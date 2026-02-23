/**
 * Breadcrumbs - Hierarchical navigation
 *
 * Shows the current location in the app hierarchy.
 * Last item is rendered as active (non-clickable).
 *
 * @example
 * ```tsx
 * <Breadcrumbs
 *   items={[
 *     { label: 'Dashboard', onPress: () => router.push('/gestor/dashboard') },
 *     { label: 'Rotas', onPress: () => router.push('/gestor/historico') },
 *     { label: 'Rota #42' },
 *   ]}
 * />
 * ```
 */

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ViewStyle,
  Platform,
} from 'react-native';

import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

export interface BreadcrumbItem {
  /** Display text */
  label: string;
  /** Navigation callback. Omit for the current (active) item. */
  onPress?: () => void;
}

export interface BreadcrumbsProps {
  /** Array of breadcrumb items, from root to current */
  items: BreadcrumbItem[];
  /** Separator icon */
  separator?: keyof typeof Ionicons.glyphMap;
  /** Container style */
  style?: ViewStyle;
  /** Test ID */
  testID?: string;
}

export function Breadcrumbs({
  items,
  separator = 'chevron-forward',
  style,
  testID,
}: BreadcrumbsProps) {
  const { theme } = useUnistyles();

  return (
    <View style={[styles.container, style]} testID={testID}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const isClickable = !isLast && !!item.onPress;

        return (
          <View key={index} style={styles.item}>
            {isClickable ? (
              <TouchableOpacity onPress={item.onPress} activeOpacity={0.7}>
                <Text style={styles.link}>{item.label}</Text>
              </TouchableOpacity>
            ) : (
              <Text style={[styles.text, isLast && styles.activeText]} numberOfLines={1}>
                {item.label}
              </Text>
            )}
            {!isLast && (
              <Ionicons
                name={separator}
                size={14}
                color={theme.colors.gray400}
                style={styles.separator}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing['0.5'],
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  link: {
    fontFamily: theme.typography.fontSans,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.primary,
    ...(Platform.OS === 'web' && {
      cursor: 'pointer' as any,
      textDecorationLine: 'none' as any,
    }),
  },
  text: {
    fontFamily: theme.typography.fontSans,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray500,
  },
  activeText: {
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray800,
  },
  separator: {
    marginHorizontal: theme.spacing['1'],
  },
}));

export default Breadcrumbs;
