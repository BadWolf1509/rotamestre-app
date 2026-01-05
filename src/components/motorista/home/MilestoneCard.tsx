/**
 * Card de progresso para próximo milestone
 * Mostra visualmente o progresso do motorista para a próxima conquista
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';

import { MilestoneData } from '@/hooks/useMilestones';
import { getMilestoneMessage } from '@/utils/motivationalMessages';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

interface MilestoneCardProps {
  data: MilestoneData;
  compact?: boolean;
}

export function MilestoneCard({ data, compact = false }: MilestoneCardProps) {
  const { theme } = useUnistyles();
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Progresso proporcional para animação: totalEntregas/nextMilestone
  const displayProgress = data.nextMilestone
    ? Math.round((data.totalEntregas / data.nextMilestone) * 100)
    : 100;

  // Animar a barra de progresso
  useEffect(() => {
    const animation = Animated.spring(progressAnim, {
      toValue: displayProgress,
      useNativeDriver: false,
      tension: 50,
      friction: 7,
    });
    animation.start();
    return () => {
      animation.stop();
    };
  }, [displayProgress, progressAnim]);

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

  const milestoneMsg = data.nextMilestone ? getMilestoneMessage(data.nextMilestone) : null;

  // Cor baseada no progresso proporcional (displayProgress já calculado acima)
  const getProgressColor = (pct: number) => {
    if (pct >= 90) return { color: theme.colors.success, bg: theme.colors.successBg };
    if (pct >= 50) return { color: theme.colors.primary, bg: theme.colors.primaryBg };
    return { color: theme.colors.warning, bg: theme.colors.warningBg };
  };

  const { color: progressColor, bg: bgColor } = getProgressColor(displayProgress);

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
      </View>

      {/* Barra de progresso - proporcional ao total */}
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
          {data.totalEntregas} de {data.nextMilestone}
        </Text>
      </View>

      {/* Mensagem de incentivo - sempre visível, versão curta no compact */}
      <View style={[styles.incentiveContainer, compact && styles.incentiveContainerCompact]}>
        <Ionicons name="rocket-outline" size={14} color={theme.colors.gray500} />
        <Text style={styles.incentiveText}>
          {data.remaining === 1
            ? 'Falta apenas 1!'
            : compact
              ? `Faltam ${data.remaining}`
              : `Faltam ${data.remaining} entregas`}
        </Text>
      </View>

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

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing['4'],
    marginBottom: theme.spacing['3'],
    ...theme.shadows.card, // Standardized shadow preset
  },
  containerCompact: {
    padding: theme.spacing['3'],
    marginBottom: theme.spacing['2'],
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing['2'],
  },
  loadingText: {
    fontSize: theme.typography.sm, // 14px
    color: theme.colors.gray500,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing['2.5'],
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing['2.5'],
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
  },
  subtitle: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray600,
    marginTop: theme.spacing['0.5'],
  },
  badge: {
    paddingHorizontal: theme.spacing['2.5'],
    paddingVertical: theme.spacing['1'],
    borderRadius: theme.borderRadius.lg,
  },
  badgeText: {
    fontSize: theme.typography.xs,
    fontFamily: theme.typography.fontSansBold,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing['2.5'],
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: theme.colors.gray200,
    borderRadius: theme.borderRadius.xs,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: theme.borderRadius.xs,
  },
  progressText: {
    fontSize: theme.typography.xs,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray700,
    minWidth: 50,
    textAlign: 'right',
  },
  incentiveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing['1.5'],
    marginTop: theme.spacing['2.5'],
    paddingTop: theme.spacing['2.5'],
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray100,
  },
  incentiveContainerCompact: {
    marginTop: theme.spacing['2'],
    paddingTop: theme.spacing['2'],
  },
  incentiveText: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray600,
    fontStyle: 'italic',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: theme.spacing['2.5'],
    paddingTop: theme.spacing['2.5'],
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray100,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing['1'],
  },
  statText: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray600,
  },
}));
