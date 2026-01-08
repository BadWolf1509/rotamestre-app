/**
 * TimelineFilters - Filter chips for timeline events
 */

import { Ionicons } from '@expo/vector-icons';
import React, { memo } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';

import { withOpacity } from '@/utils/color';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

import { FILTER_OPTIONS, type FilterType } from './types';

interface TimelineFiltersProps {
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  filterCounts: Record<FilterType, number>;
}

function TimelineFiltersComponent({
  activeFilter,
  onFilterChange,
  filterCounts,
}: TimelineFiltersProps) {
  const { theme } = useUnistyles();

  return (
    <View style={styles.filtersContainer}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersContent}
      >
        {FILTER_OPTIONS.map((option) => {
          const isActive = activeFilter === option.key;
          const count = filterCounts[option.key];

          return (
            <TouchableOpacity
              key={option.key}
              style={[
                styles.filterChip,
                isActive && styles.filterChipActive,
              ]}
              onPress={() => onFilterChange(option.key)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`Filtrar por ${option.label}. ${count} evento${count !== 1 ? 's' : ''}`}
            >
              <Ionicons
                name={option.icon}
                size={14}
                color={isActive ? theme.colors.white : theme.colors.gray500}
              />
              <Text style={[
                styles.filterChipText,
                isActive && styles.filterChipTextActive,
              ]}>
                {option.label}
              </Text>
              {count > 0 && (
                <View style={[
                  styles.filterBadge,
                  isActive && styles.filterBadgeActive,
                ]}>
                  <Text style={[
                    styles.filterBadgeText,
                    isActive && styles.filterBadgeTextActive,
                  ]}>
                    {count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

export const TimelineFilters = memo(TimelineFiltersComponent);

const styles = StyleSheet.create((theme: Theme) => ({
  filtersContainer: {
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
  },
  filtersContent: {
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs + 2,
    borderRadius: theme.borderRadius.xl,
    backgroundColor: theme.colors.gray100,
    marginRight: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  filterChipActive: {
    backgroundColor: theme.colors.info,
  },
  filterChipText: {
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontSansMedium,
    color: theme.colors.gray500,
  },
  filterChipTextActive: {
    color: theme.colors.white,
  },
  filterBadge: {
    backgroundColor: theme.colors.gray200,
    paddingHorizontal: theme.spacing.xs + 2,
    paddingVertical: 1,
    borderRadius: theme.borderRadius.md,
    marginLeft: theme.spacing.xs,
  },
  filterBadgeActive: {
    backgroundColor: withOpacity(theme.colors.white, 0.3),
  },
  filterBadgeText: {
    fontSize: theme.typography.fontSize.xs - 2,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray500,
  },
  filterBadgeTextActive: {
    color: theme.colors.white,
  },
}));
