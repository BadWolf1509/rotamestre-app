/**
 * ResumoInline - Resumo compacto inline para sidebar
 * Exibe estatísticas em uma linha horizontal
 */

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View, Text } from 'react-native';

import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

import type { ResumoParadas } from './types';

interface ResumoInlineProps {
  resumoParadas: ResumoParadas;
}

export function ResumoInline({ resumoParadas }: ResumoInlineProps) {
  const { theme } = useUnistyles();

  return (
    <View style={styles.container}>
      {/* Total */}
      <View style={styles.stat}>
        <View style={[styles.iconWrapper, { backgroundColor: theme.colors.primaryBg }]}>
          <Ionicons name="flag" size={12} color={theme.colors.primary} />
        </View>
        <Text style={styles.value}>{resumoParadas.total}</Text>
        <Text style={styles.label}>total</Text>
      </View>

      <View style={styles.divider} />

      {/* Concluídas */}
      <View style={styles.stat}>
        <View style={[styles.iconWrapper, { backgroundColor: theme.colors.successBg }]}>
          <Ionicons name="checkmark" size={12} color={theme.colors.success} />
        </View>
        <Text style={[styles.value, { color: theme.colors.success }]}>
          {resumoParadas.concluidas}
        </Text>
        <Text style={styles.label}>concluído</Text>
      </View>

      <View style={styles.divider} />

      {/* Pendentes */}
      <View style={styles.stat}>
        <View style={[styles.iconWrapper, { backgroundColor: theme.colors.warningBg }]}>
          <Ionicons name="time" size={12} color={theme.colors.warning} />
        </View>
        <Text style={[styles.value, { color: theme.colors.warning }]}>
          {resumoParadas.pendentes}
        </Text>
        <Text style={styles.label}>pendente</Text>
      </View>

      {/* Em andamento (se houver) */}
      {resumoParadas.emAndamento > 0 && (
        <>
          <View style={styles.divider} />
          <View style={styles.stat}>
            <View style={[styles.iconWrapper, { backgroundColor: theme.colors.infoBg }]}>
              <Ionicons name="navigate" size={12} color={theme.colors.info} />
            </View>
            <Text style={[styles.value, { color: theme.colors.info }]}>
              {resumoParadas.emAndamento}
            </Text>
            <Text style={styles.label}>rota</Text>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.gray50,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing['2'],
    gap: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.gray100,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing['1'],
  },
  iconWrapper: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  value: {
    fontSize: theme.typography.fontSize.sm + 1,
    fontWeight: '700',
    color: theme.colors.gray900,
  },
  label: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray500,
  },
  divider: {
    width: 1,
    height: 16,
    backgroundColor: theme.colors.gray200,
  },
}));
