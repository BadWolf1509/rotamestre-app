/**
 * Motorista Filter Section
 *
 * Filter by driver.
 */

import React from 'react';
import { View, Text, Pressable } from 'react-native';

import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

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
  useUnistyles();

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
      <View style={styles.motoristaList}>
        <Pressable
          style={[
            styles.motoristaOption,
            !motoristaId && styles.motoristaOptionActive,
          ]}
          onPress={() => handleMotoristaChange(null)}
        >
          <Text
            style={[
              styles.motoristaOptionText,
              !motoristaId && styles.motoristaOptionTextActive,
            ]}
          >
            Todos
          </Text>
        </Pressable>

        {motoristas.map((motorista) => (
          <Pressable
            key={motorista.id}
            testID={`filter-motorista-${motorista.id}`}
            style={[
              styles.motoristaOption,
              motoristaId === motorista.id && styles.motoristaOptionActive,
            ]}
            onPress={() => handleMotoristaChange(motorista.id)}
          >
            <Text
              style={[
                styles.motoristaOptionText,
                motoristaId === motorista.id && styles.motoristaOptionTextActive,
              ]}
            >
              {motorista.nome}
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
  motoristaList: {
    gap: theme.spacing.sm,
  },
  motoristaOption: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.white,
  },
  motoristaOptionActive: {
    backgroundColor: theme.colors.primaryBg,
    borderColor: theme.colors.primary,
    borderWidth: 2,
  },
  motoristaOptionText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray500,
    fontFamily: theme.typography.fontSansMedium,
  },
  motoristaOptionTextActive: {
    color: theme.colors.primary,
    fontFamily: theme.typography.fontSansSemiBold,
  },
}));
