/**
 * Card de progresso para próximo milestone
 * Mostra visualmente o progresso do motorista para a próxima conquista
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { MilestoneData, getMilestoneColor } from '@/hooks/useMilestones';
import { getMilestoneMessage } from '@/utils/motivationalMessages';
import { defaultTheme, useUnistyles } from '@/utils/styles';

interface MilestoneCardProps {
  data: MilestoneData;
  compact?: boolean;
}

export function MilestoneCard({ data, compact = false }: MilestoneCardProps) {
  const { theme } = useUnistyles();
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Animar a barra de progresso
  useEffect(() => {
    Animated.spring(progressAnim, {
      toValue: data.progress,
      useNativeDriver: false,
      tension: 50,
      friction: 7,
    }).start();
  }, [data.progress, progressAnim]);

  if (data.isLoading) {
    return (
      <View style={[styles.container, compact && styles.containerCompact]}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Carregando conquistas...</Text>
        </View>
      </View>
    );
  }

  // Se não há próximo milestone (atingiu todos)
  if (!data.nextMilestone) {
    return (
      <View style={[styles.container, compact && styles.containerCompact]}>
        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: theme.colors.successBg }]}>
            <Ionicons name="trophy" size={18} color={theme.colors.success} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title}>Mestre das Entregas!</Text>
            <Text style={styles.subtitle}>{data.totalEntregas} entregas realizadas</Text>
          </View>
        </View>
      </View>
    );
  }

  const colorKey = getMilestoneColor(data.progress);
  const milestoneMsg = data.nextMilestone ? getMilestoneMessage(data.nextMilestone) : null;

  // Determinar cor baseada no progresso
  const progressColor = colorKey === 'success'
    ? theme.colors.success
    : colorKey === 'primary'
      ? theme.colors.primary
      : theme.colors.warning;

  const bgColor = colorKey === 'success'
    ? theme.colors.successBg
    : colorKey === 'primary'
      ? theme.colors.primaryBg
      : theme.colors.warningBg;

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: bgColor }]}>
          <Ionicons name="flag" size={18} color={progressColor} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>Próxima Conquista</Text>
          <Text style={styles.subtitle}>
            {milestoneMsg?.emoji} {data.nextMilestone} entregas
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: bgColor }]}>
          <Text style={[styles.badgeText, { color: progressColor }]}>
            {data.progress}%
          </Text>
        </View>
      </View>

      {/* Barra de progresso */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                backgroundColor: progressColor,
                width: progressAnim.interpolate({
                  inputRange: [0, 100],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {data.totalEntregas}/{data.nextMilestone}
        </Text>
      </View>

      {/* Mensagem de incentivo */}
      {!compact && (
        <View style={styles.incentiveContainer}>
          <Ionicons name="rocket-outline" size={14} color={theme.colors.gray500} />
          <Text style={styles.incentiveText}>
            {data.remaining === 1
              ? 'Falta apenas 1 entrega!'
              : `Faltam ${data.remaining} entregas para a conquista`}
          </Text>
        </View>
      )}

      {/* Stats rápidos (apenas no modo completo) */}
      {!compact && data.averagePerDay > 0 && (
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Ionicons name="trending-up" size={14} color={theme.colors.gray500} />
            <Text style={styles.statText}>~{data.averagePerDay}/dia</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="star" size={14} color={theme.colors.warning} />
            <Text style={styles.statText}>Melhor: {data.bestDay}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const colors = defaultTheme.colors;

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  containerCompact: {
    padding: 12,
    marginBottom: 8,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  loadingText: {
    fontSize: 13,
    color: colors.gray500,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray900,
  },
  subtitle: {
    fontSize: 12,
    color: colors.gray600,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: colors.gray200,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.gray700,
    minWidth: 50,
    textAlign: 'right',
  },
  incentiveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
  },
  incentiveText: {
    fontSize: 12,
    color: colors.gray600,
    fontStyle: 'italic',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
    color: colors.gray600,
  },
});
