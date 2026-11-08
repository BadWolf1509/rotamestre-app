/**
 * Status Filter Section
 *
 * Filter by route status (pendente, em_andamento, concluida, cancelada).
 */

import React from 'react';
import { View, Text } from 'react-native';

import { FilterChip } from '@/components/FilterChip';
import { ROUTE_STATUS_CONFIG } from '@/constants/statusConfig';
import { StyleSheet, type Theme } from '@/utils/styles';

import type { RouteFiltersState, StatusOption } from './types';

interface StatusFilterSectionProps {
  status: RouteFiltersState['status'];
  onStatusChange: (status: RouteFiltersState['status']) => void;
}

// Os rótulos vêm da config central; "Todos" é o único que não é status.
const STATUS_OPTIONS: StatusOption[] = [
  { value: null, label: 'Todos' },
  { value: 'pendente', label: ROUTE_STATUS_CONFIG.pendente.label },
  { value: 'em_andamento', label: ROUTE_STATUS_CONFIG.em_andamento.label },
  { value: 'concluida', label: ROUTE_STATUS_CONFIG.concluida.label },
  { value: 'cancelada', label: ROUTE_STATUS_CONFIG.cancelada.label },
];

export function StatusFilterSection({
  status,
  onStatusChange,
}: StatusFilterSectionProps) {
  const handleStatusChange = (newStatus: RouteFiltersState['status']) => {
    const toggledStatus = status === newStatus ? null : newStatus;
    onStatusChange(toggledStatus);
  };

  return (
    <View style={styles.filterSection}>
      <Text style={styles.sectionTitle}>Status</Text>
      <View style={styles.statusGrid}>
        {STATUS_OPTIONS.map((option) => (
          <FilterChip
            key={option.value || 'all'}
            testID={`filter-status-${option.value || 'all'}`}
            label={option.label}
            selected={(status ?? null) === option.value}
            size="compact"
            onPress={() => handleStatusChange(option.value)}
          />
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
}));
