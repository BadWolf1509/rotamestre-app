/**
 * Motorista Filter Section
 *
 * Filtro por motorista: chips (`FilterChip`) lado a lado, que quebram linha.
 */

import React from 'react';
import { View, Text } from 'react-native';

import { FilterChip } from '@/components/FilterChip';
import { StyleSheet, type Theme } from '@/utils/styles';

import type { Motorista } from './types';

interface MotoristaFilterSectionProps {
  motoristaId: string | null | undefined;
  motoristas: Motorista[];
  onMotoristaChange: (motoristaId: string | null) => void;
}

export function MotoristaFilterSection({
  motoristaId,
  motoristas,
  onMotoristaChange,
}: MotoristaFilterSectionProps) {
  if (motoristas.length === 0) {
    return null;
  }

  const handleMotoristaChange = (newMotoristaId: string | null) => {
    const toggledId = motoristaId === newMotoristaId ? null : newMotoristaId;
    onMotoristaChange(toggledId);
  };

  return (
    <View style={styles.filterSection}>
      <Text style={styles.sectionTitle}>Motorista</Text>
      <View style={styles.motoristaList} testID="filter-motorista-lista">
        <FilterChip
          testID="filter-motorista-all"
          label="Todos"
          selected={!motoristaId}
          size="compact"
          onPress={() => handleMotoristaChange(null)}
        />

        {motoristas.map((motorista) => (
          <FilterChip
            key={motorista.id}
            testID={`filter-motorista-${motorista.id}`}
            label={motorista.nome}
            selected={motoristaId === motorista.id}
            size="compact"
            onPress={() => handleMotoristaChange(motorista.id)}
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
  motoristaList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
}));
