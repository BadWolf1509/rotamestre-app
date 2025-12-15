/**
 * BaseInfoContent - Informações de partida/chegada da unidade
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { View, Text } from 'react-native';

import { useUnistyles } from '@/utils/styles';

import { styles } from './styles';

import type { Parada } from './types';

interface BaseInfoContentProps {
  pontosBase: Parada[];
}

export function BaseInfoContent({ pontosBase }: BaseInfoContentProps) {
  const { theme } = useUnistyles();

  const baseInicio = useMemo(() => {
    if (pontosBase.length === 0) return null;
    return pontosBase.reduce((prev, curr) => (curr.ordem < prev.ordem ? curr : prev));
  }, [pontosBase]);

  const baseFim = useMemo(() => {
    if (pontosBase.length === 0) return null;
    return pontosBase.reduce((prev, curr) => (curr.ordem > prev.ordem ? curr : prev));
  }, [pontosBase]);

  const hasBaseInfo = Boolean(baseInicio || baseFim);

  if (!hasBaseInfo) {
    return (
      <Text style={styles.baseInfoEmpty}>Nenhum endereco da unidade foi cadastrado.</Text>
    );
  }

  const entries = [
    baseInicio
      ? {
          label: 'Partida',
          value: baseInicio.endereco,
          icon: 'log-out-outline' as keyof typeof Ionicons.glyphMap,
          color: theme.colors.primary,
        }
      : null,
    baseFim && (!baseInicio || baseFim.id !== baseInicio.id)
      ? {
          label: 'Chegada',
          value: baseFim.endereco,
          icon: 'log-in-outline' as keyof typeof Ionicons.glyphMap,
          color: theme.colors.secondary,
        }
      : null,
  ].filter(Boolean) as Array<{
    label: string;
    value: string;
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
  }>;

  return (
    <View style={styles.baseInfoList}>
      {entries.map((entry, index) => (
        <View key={`${entry.label}-${index}`} style={styles.baseInfoItemRow}>
          <View
            style={[styles.baseInfoIcon, { backgroundColor: `${entry.color}22` }]}
          >
            <Ionicons name={entry.icon} size={18} color={entry.color} />
          </View>
          <View style={styles.baseInfoTexts}>
            <Text style={styles.baseInfoLabel}>{entry.label}</Text>
            <Text style={styles.baseInfoValue}>{entry.value}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// Hook para verificar se tem info de base
export function useHasBaseInfo(pontosBase: Parada[]): boolean {
  return useMemo(() => {
    if (pontosBase.length === 0) return false;
    const baseInicio = pontosBase.reduce((prev, curr) =>
      curr.ordem < prev.ordem ? curr : prev
    );
    return Boolean(baseInicio);
  }, [pontosBase]);
}
