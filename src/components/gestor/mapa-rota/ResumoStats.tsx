/**
 * ResumoStats - Estatísticas resumidas da rota
 * Versões mobile e desktop
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { View, Text } from 'react-native';

import { useUnistyles } from '@/utils/styles';

import { styles } from './styles';

import type { ResumoParadas } from './types';

interface ResumoStatsProps {
  resumoParadas: ResumoParadas;
  variant?: 'mobile' | 'desktop';
}

export function ResumoStats({ resumoParadas, variant = 'mobile' }: ResumoStatsProps) {
  const { theme } = useUnistyles();

  const resumoItems = useMemo(
    () => {
      const items = [
        {
          label: 'Paradas Totais',
          value: resumoParadas.total,
          color: theme.colors.gray900,
          icon: 'flag-outline' as keyof typeof Ionicons.glyphMap,
          bg: theme.colors.primaryBg,
        },
        {
          label: 'Concluidas',
          value: resumoParadas.concluidas,
          color: theme.colors.success,
          icon: 'checkmark-done-outline' as keyof typeof Ionicons.glyphMap,
          bg: theme.colors.successBg,
        },
        {
          label: 'Pendentes',
          value: resumoParadas.pendentes,
          color: theme.colors.warning,
          icon: 'time-outline' as keyof typeof Ionicons.glyphMap,
          bg: theme.colors.warningBg,
        },
      ];

      if (resumoParadas.puladas > 0) {
        items.push({
          label: 'Puladas',
          value: resumoParadas.puladas,
          color: theme.colors.error,
          icon: 'close-circle-outline' as keyof typeof Ionicons.glyphMap,
          bg: theme.colors.errorBg,
        });
      }

      return items;
    },
    [resumoParadas, theme]
  );

  if (variant === 'desktop') {
    return (
      <View style={styles.resumoDesktopGrid}>
        {resumoItems.map((item) => (
          <View key={item.label} style={styles.resumoDesktopItem}>
            <View
              style={[
                styles.resumoIconWrapper,
                { backgroundColor: item.bg, borderColor: `${item.color}33` },
              ]}
            >
              <Ionicons name={item.icon} size={16} color={item.color} />
            </View>
            <Text style={[styles.resumoDesktopValue, { color: item.color }]}>{item.value}</Text>
            <Text style={styles.resumoDesktopLabel}>{item.label}</Text>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.resumoStats}>
      {resumoItems.map((item) => (
        <View key={item.label} style={styles.resumoStat}>
          <Text
            style={[
              styles.resumoStatValue,
              item.color === theme.colors.success && styles.resumoStatValueSuccess,
              item.color === theme.colors.warning && styles.resumoStatValueWarning,
            ]}
          >
            {item.value}
          </Text>
          <Text style={styles.resumoStatLabel}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}
