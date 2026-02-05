/**
 * MainCardReadyToComplete - Content for ready-to-complete state
 */

import { Ionicons } from '@expo/vector-icons';
import React, { memo } from 'react';
import { View } from 'react-native';

import { Text } from '@/design-system';
import { useUnistyles } from '@/utils/styles';

import { styles } from '../MainCard.styles';
import { formatElapsedTime, filterRealStops, calculateSuccessRate } from './MainCard.utils';

import type { Parada, Rota } from './MainCard.types';

interface MainCardReadyToCompleteProps {
  route: Rota | null;
  paradas: Parada[];
}

export const MainCardReadyToComplete = memo(function MainCardReadyToComplete({
  route,
  paradas,
}: MainCardReadyToCompleteProps) {
  const { theme } = useUnistyles();

  const paradasReais = filterRealStops(paradas);

  // Calcular tempo real baseado em iniciada_em
  const elapsedTime = route?.iniciada_em
    ? formatElapsedTime(new Date(route.iniciada_em).getTime())
    : '--';

  // Calcular resumo das paradas
  const { concluidas: paradasConcluidas, puladas: paradasPuladas, taxa: taxaSucesso } =
    calculateSuccessRate(paradasReais);

  return (
    <View style={styles.content}>
      <Text style={styles.icon}>🎉</Text>
      <Text style={styles.title}>Todas as paradas concluídas!</Text>
      <Text style={styles.subtitle}>Você pode finalizar a rota agora</Text>

      {/* Resumo Executivo */}
      <View style={styles.executiveSummary}>
        <View style={styles.executiveRow}>
          <View style={styles.executiveItem}>
            <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} />
            <Text style={styles.executiveValue}>{paradasConcluidas}</Text>
            <Text style={styles.executiveLabel}>concluídas</Text>
          </View>
          {paradasPuladas > 0 && (
            <View style={styles.executiveItem}>
              <Ionicons name="arrow-forward-circle" size={20} color={theme.colors.warning} />
              <Text style={styles.executiveValue}>{paradasPuladas}</Text>
              <Text style={styles.executiveLabel}>puladas</Text>
            </View>
          )}
          <View style={styles.executiveItem}>
            <Ionicons name="trophy" size={20} color={theme.colors.primary} />
            <Text style={styles.executiveValue}>{taxaSucesso}%</Text>
            <Text style={styles.executiveLabel}>sucesso</Text>
          </View>
        </View>
      </View>

      <View style={styles.summaryBox}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Tempo total</Text>
          <Text style={styles.summaryValue}>{elapsedTime}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Distância</Text>
          <Text style={styles.summaryValue}>{route?.distancia_total || 0} km</Text>
        </View>
      </View>

      {/* Indicador de finalização */}
      <View style={styles.readyIndicator}>
        <Ionicons name="checkmark-done-circle" size={16} color={theme.colors.success} />
        <Text style={styles.readyText}>Pronto para finalizar a rota</Text>
      </View>
    </View>
  );
});
