/**
 * Status Filter Section
 *
 * Filter by route status (pendente, em_andamento, concluida, cancelada).
 */

import React, { useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';

import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

import type { RouteFiltersState, StatusOption } from './types';

interface StatusFilterSectionProps {
  status: RouteFiltersState['status'];
  onStatusChange: (status: RouteFiltersState['status']) => void;
}

export function StatusFilterSection({ status, onStatusChange }: StatusFilterSectionProps) {
  const { theme } = useUnistyles();

  const statusOptions = useMemo<StatusOption[]>(() => [
    { value: null, label: 'Todos', color: undefined },
    { value: 'pendente', label: 'Pendente', color: theme.colors.warning },
    { value: 'em_andamento', label: 'Em Andamento', color: theme.colors.info },
    { value: 'concluida', label: 'Concluída', color: theme.colors.success },
    { value: 'cancelada', label: 'Cancelada', color: theme.colors.error },
  ], [theme]);

  const handleStatusChange = (newStatus: RouteFiltersState['status']) => {
    const toggledStatus = status === newStatus ? null : newStatus;
    onStatusChange(toggledStatus);
  };

  return (
    <View style={styles.filterSection}>
      <Text style={styles.sectionTitle}>Status</Text>
      <View style={styles.statusGrid}>
        {statusOptions.map((option) => (
          <Pressable
            key={option.value || 'all'}
            testID={`filter-status-${option.value || 'all'}`}
            style={[
              styles.statusOption,
              status === option.value && styles.statusOptionActive,
              option.color && { borderColor: option.color },
              status === option.value &&
                option.color && { backgroundColor: `${option.color}15` },
            ]}
            onPress={() => handleStatusChange(option.value)}
          >
            <Text
              style={[
                styles.statusOptionText,
                status === option.value && styles.statusOptionTextActive,
                status === option.value && option.color && { color: option.color },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  filterSection: {
    marginBottom: theme.spacing['2xl'],
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray600,
    marginBottom: theme.spacing.md,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  statusOption: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.white,
  },
  statusOptionActive: {
    backgroundColor: theme.colors.primaryBg,
    borderColor: theme.colors.primary,
    borderWidth: 2,
  },
  statusOptionText: {
    fontSize: theme.typography.fontSize.sm - 1,
    color: theme.colors.gray500,
    fontFamily: theme.typography.fontSansMedium,
  },
  statusOptionTextActive: {
    color: theme.colors.primary,
    fontFamily: theme.typography.fontSansSemiBold,
  },
}));
