/**
 * DrawerMenuItems component
 * Renders the list of menu items in the drawer
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

import { StyleSheet, type Theme } from '@/utils/styles';

import type { MenuItem } from './types';

interface DrawerMenuItemsProps {
  items: MenuItem[];
  currentPath: string;
  onNavigate: (path: string) => void;
  onAction: (action: string) => void;
}

export function DrawerMenuItems({
  items,
  currentPath,
  onNavigate,
  onAction,
}: DrawerMenuItemsProps) {
  return (
    <View style={styles.menuSection}>
      {items
        .filter((item) => item.show)
        .map((item, index) => {
          const isActive = item.path ? currentPath === item.path : false;
          const isDanger = item.danger;
          const hasAction = item.action;

          return (
            <TouchableOpacity
              key={index}
              style={[
                styles.menuItem,
                isActive && styles.menuItemActive,
                isDanger && styles.menuItemDanger,
              ]}
              onPress={() => {
                if (hasAction) {
                  onAction(item.action!);
                } else if (item.path) {
                  onNavigate(item.path);
                }
              }}
            >
              <Text style={[styles.menuIcon, isDanger && styles.menuIconDanger]}>{item.icon}</Text>
              <Text
                style={[
                  styles.menuLabel,
                  isActive && styles.menuLabelActive,
                  isDanger && styles.menuLabelDanger,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  menuSection: {
    paddingVertical: theme.spacing.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.components.drawer.itemPaddingV,
    paddingHorizontal: theme.spacing.xl,
  },
  menuItemActive: {
    backgroundColor: `${theme.colors.primary}10`,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
  },
  menuItemDanger: {
    backgroundColor: `${theme.colors.error}10`,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.error,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  menuIcon: {
    fontSize: theme.components.drawer.menuIconSize,
    marginRight: theme.spacing.lg,
    width: theme.components.drawer.menuIconWidth,
  },
  menuIconDanger: {
    fontSize: theme.typography.fontSize['2xl'],
  },
  menuLabel: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontSansMedium,
    color: theme.colors.gray700,
  },
  menuLabelActive: {
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.primary,
  },
  menuLabelDanger: {
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.error,
  },
}));
