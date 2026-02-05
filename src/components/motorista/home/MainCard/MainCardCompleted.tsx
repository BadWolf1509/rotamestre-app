/**
 * MainCardCompleted - Content for completed state
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { memo } from 'react';
import { Animated, TouchableOpacity, View } from 'react-native';

import { Text } from '@/design-system';
import { MilestoneData } from '@/hooks/useMilestones';
import { getCompletedMessage, getMilestoneMessage } from '@/utils/motivationalMessages';
import { useUnistyles } from '@/utils/styles';

import { styles } from '../MainCard.styles';
import { formatElapsedTime, filterRealStops, calculateSuccessRate } from './MainCard.utils';

import type { Parada, Rota } from './MainCard.types';

interface MainCardCompletedProps {
  route: Rota | null;
  paradas: Parada[];
  streak: number;
  milestoneData: MilestoneData;
  celebrationScale: Animated.Value;
  celebrationOpacity: Animated.Value;
}

export const MainCardCompleted = memo(function MainCardCompleted({
  route,
  paradas,
  streak,
  milestoneData,
  celebrationScale,
  celebrationOpacity,
}: MainCardCompletedProps) {
  const { theme } = useUnistyles();
  const router = useRouter();

  const paradasReais = filterRealStops(paradas);

  // Calcular tempo real baseado em iniciada_em e concluida_em
  const totalTime = route?.iniciada_em && route?.concluida_em
    ? formatElapsedTime(
        new Date(route.iniciada_em).getTime(),
        new Date(route.concluida_em).getTime()
      )
    : '--';

  // Contar paradas concluídas vs total
  const { concluidas: paradasConcluidas, taxa: taxaSucesso } = calculateSuccessRate(paradasReais);

  // Mensagem motivacional
  const completedMsg = getCompletedMessage(paradasConcluidas, taxaSucesso);

  // Verificar se atingiu um milestone
  const milestoneReached = milestoneData.currentMilestone;
  const milestoneMsg = milestoneReached ? getMilestoneMessage(milestoneReached) : null;

  return (
    <View style={styles.content}>
      {/* Checkmark animado */}
      <View style={styles.celebrationContainer}>
        <Animated.View
          style={[
            styles.celebrationCircle,
            {
              backgroundColor: theme.colors.successBg,
              opacity: celebrationOpacity,
              transform: [{ scale: celebrationScale }],
            },
          ]}
        >
          <Ionicons name="checkmark-circle" size={56} color={theme.colors.success} />
        </Animated.View>
      </View>

      <Text style={styles.title}>{completedMsg.title}</Text>
      <Text style={styles.subtitle}>{completedMsg.subtitle}</Text>

      {/* Milestone Alcançado */}
      {milestoneReached && milestoneReached >= 10 && (
        <View style={[styles.milestoneBadge, { backgroundColor: theme.colors.primaryBg }]}>
          <Text style={styles.milestoneEmoji}>{milestoneMsg?.emoji}</Text>
          <View>
            <Text style={[styles.milestoneTitle, { color: theme.colors.primary }]}>
              {milestoneMsg?.title}
            </Text>
            <Text style={styles.milestoneSubtitle}>
              {milestoneData.totalEntregas} entregas no total
            </Text>
          </View>
        </View>
      )}

      {/* Streak Badge */}
      {streak > 0 && (
        <View style={[styles.streakBadge, { backgroundColor: theme.colors.warningBg }]}>
          <Ionicons name="flame" size={18} color={theme.colors.warning} />
          <Text style={[styles.streakText, { color: theme.colors.warningText }]}>
            {streak} {streak === 1 ? 'dia' : 'dias'} seguidos!
          </Text>
        </View>
      )}

      {/* Stats em 3 colunas */}
      <View style={styles.completedStatsRow}>
        <View style={styles.completedStatItem}>
          <Ionicons name="time-outline" size={20} color={theme.colors.gray500} />
          <Text style={styles.completedStatValue}>{totalTime}</Text>
          <Text style={styles.completedStatLabel}>Tempo</Text>
        </View>
        <View style={[styles.completedStatDivider, { backgroundColor: theme.colors.gray200 }]} />
        <View style={styles.completedStatItem}>
          <Ionicons name="location-outline" size={20} color={theme.colors.gray500} />
          <Text style={styles.completedStatValue}>{paradasConcluidas}/{paradasReais.length}</Text>
          <Text style={styles.completedStatLabel}>Paradas</Text>
        </View>
        <View style={[styles.completedStatDivider, { backgroundColor: theme.colors.gray200 }]} />
        <View style={styles.completedStatItem}>
          <Ionicons name="speedometer-outline" size={20} color={theme.colors.gray500} />
          <Text style={styles.completedStatValue}>{route?.distancia_total || 0} km</Text>
          <Text style={styles.completedStatLabel}>Distância</Text>
        </View>
      </View>

      {/* Botão Ver Detalhes */}
      <TouchableOpacity
        style={[styles.detailsButton, { backgroundColor: theme.colors.primary }]}
        onPress={() => router.push('/motorista/resumo')}
        activeOpacity={0.8}
      >
        <Ionicons name="document-text-outline" size={18} color={theme.colors.white} />
        <Text style={[styles.detailsButtonText, { color: theme.colors.white }]}>
          Ver Detalhes da Rota
        </Text>
      </TouchableOpacity>
    </View>
  );
});
