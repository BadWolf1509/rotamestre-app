/**
 * Tabs - Standalone tab navigation
 *
 * Horizontal tab bar for switching between views.
 * Not tied to routing - for route-based tabs use Expo Router.
 *
 * @example
 * ```tsx
 * const [tab, setTab] = useState('today');
 *
 * <Tabs
 *   value={tab}
 *   onChange={setTab}
 *   items={[
 *     { value: 'today', label: 'Hoje' },
 *     { value: 'week', label: 'Semana' },
 *     { value: 'month', label: 'Mês' },
 *   ]}
 * />
 *
 * {tab === 'today' && <TodayView />}
 * {tab === 'week' && <WeekView />}
 * {tab === 'month' && <MonthView />}
 * ```
 */

import React from 'react';
import {
  View,
  Text,
  Pressable,
  ViewStyle,
  Platform,
  ScrollView,
} from 'react-native';

import type { PressableStateWithHover } from '@/types';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

type TabSize = 'small' | 'medium' | 'large';

export interface TabItem<T extends string = string> {
  /** Unique value for this tab */
  value: T;
  /** Display label */
  label: string;
  /** Optional badge count */
  badge?: number;
  /** Disabled state */
  disabled?: boolean;
}

export interface TabsProps<T extends string = string> {
  /** Currently selected tab value */
  value: T;
  /** Callback when tab selection changes */
  onChange: (value: T) => void;
  /** Tab items */
  items: TabItem<T>[];
  /** Size variant */
  size?: TabSize;
  /** Full width tabs (stretch to fill container) */
  fullWidth?: boolean;
  /** Allow horizontal scrolling when tabs overflow */
  scrollable?: boolean;
  /** Container style */
  style?: ViewStyle;
  /** Test ID prefix */
  testID?: string;
}

const SIZE_MAP: Record<TabSize, { paddingH: number; paddingV: number; fontSize: number }> = {
  small: { paddingH: 12, paddingV: 6, fontSize: 12 },
  medium: { paddingH: 16, paddingV: 10, fontSize: 14 },
  large: { paddingH: 20, paddingV: 12, fontSize: 16 },
};

export function Tabs<T extends string = string>({
  value,
  onChange,
  items,
  size = 'medium',
  fullWidth = false,
  scrollable = false,
  style,
  testID,
}: TabsProps<T>) {
  const { theme: _theme } = useUnistyles();
  const sizeTokens = SIZE_MAP[size];

  const renderTabs = () => (
    <View
      style={[styles.container, fullWidth && styles.fullWidth, style]}
      accessibilityRole="tablist"
    >
      {items.map((item) => {
        const isActive = item.value === value;
        const isDisabled = !!item.disabled;

        return (
          <Pressable
            key={item.value}
            testID={testID ? `${testID}-${item.value}` : undefined}
            onPress={() => !isDisabled && onChange(item.value)}
            disabled={isDisabled}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive, disabled: isDisabled }}
            style={(state) => {
              const { hovered } = state as PressableStateWithHover;
              return [
                styles.tab,
                {
                  paddingHorizontal: sizeTokens.paddingH,
                  paddingVertical: sizeTokens.paddingV,
                },
                fullWidth && styles.tabFullWidth,
                isActive && styles.tabActive,
                isDisabled && styles.tabDisabled,
                hovered && !isActive && !isDisabled && styles.tabHovered,
              ];
            }}
          >
            <Text
              style={[
                styles.tabText,
                { fontSize: sizeTokens.fontSize },
                isActive && styles.tabTextActive,
                isDisabled && styles.tabTextDisabled,
              ]}
            >
              {item.label}
            </Text>
            {item.badge != null && item.badge > 0 && (
              <View style={[styles.badge, isActive && styles.badgeActive]}>
                <Text style={[styles.badgeText, isActive && styles.badgeTextActive]}>
                  {item.badge > 99 ? '99+' : item.badge}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );

  if (scrollable) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={style}>
        {renderTabs()}
      </ScrollView>
    );
  }

  return renderTabs();
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    flexDirection: 'row',
    backgroundColor: theme.colors.gray100,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing['0.5'],
    gap: theme.spacing['0.5'],
  },
  fullWidth: {
    width: '100%',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.sm,
    gap: theme.spacing['1.5'],
    ...(Platform.OS === 'web' && {
      cursor: 'pointer' as any,
      transition: 'all 150ms ease' as any,
    }),
  },
  tabFullWidth: {
    flex: 1,
  },
  tabActive: {
    backgroundColor: theme.colors.white,
    ...theme.shadows.sm,
  },
  tabDisabled: {
    opacity: 0.5,
    ...(Platform.OS === 'web' && { cursor: 'default' as any }),
  },
  tabHovered: {
    backgroundColor: theme.colors.gray200,
  },
  tabText: {
    fontFamily: theme.typography.fontSansMedium,
    color: theme.colors.gray600,
    textAlign: 'center',
  },
  tabTextActive: {
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.gray900,
  },
  tabTextDisabled: {
    color: theme.colors.gray400,
  },
  badge: {
    backgroundColor: theme.colors.gray300,
    borderRadius: theme.borderRadius.full,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing['1'],
  },
  badgeActive: {
    backgroundColor: theme.colors.primary,
  },
  badgeText: {
    fontFamily: theme.typography.fontSansBold,
    fontSize: 10,
    color: theme.colors.gray700,
  },
  badgeTextActive: {
    color: theme.colors.white,
  },
}));

export default Tabs;
