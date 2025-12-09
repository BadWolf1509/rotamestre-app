import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

import { defaultTheme, useUnistyles } from '@/utils/styles';

interface ProgressBarProps {
  completed: number;
  total: number;
  timeElapsed?: string;
  estimatedTime?: string;
  currentStopIndex?: number;
}

export function ProgressBar({
  completed,
  total,
  timeElapsed,
  estimatedTime,
  currentStopIndex,
}: ProgressBarProps) {
  const { theme } = useUnistyles();
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  const animatedWidth = useRef(new Animated.Value(0)).current;

  // Animar a barra de progresso
  useEffect(() => {
    Animated.spring(animatedWidth, {
      toValue: percentage,
      useNativeDriver: false,
      tension: 50,
      friction: 7,
    }).start();
  }, [percentage, animatedWidth]);

  // Calcular posições dos milestones baseado no número real de paradas
  const milestones = [];
  if (total > 1) {
    for (let i = 1; i < total; i++) {
      const position = (i / total) * 100;
      const isCompleted = i <= completed;
      const isCurrent = i === currentStopIndex;
      milestones.push({ position, isCompleted, isCurrent, index: i });
    }
  }

  // Calcular tempo restante estimado
  const getTimeRemaining = () => {
    if (!timeElapsed || !estimatedTime) return null;

    // Parse timeElapsed (formato "Xh Ymin" ou "Ymin")
    const elapsedMatch = timeElapsed.match(/(\d+)h?\s*(\d+)?min?/);
    if (!elapsedMatch) return estimatedTime;

    const elapsedHours = parseInt(elapsedMatch[1]) || 0;
    const elapsedMinutes = parseInt(elapsedMatch[2]) || 0;
    const elapsedTotalMinutes = elapsedHours * 60 + elapsedMinutes;

    // Parse estimatedTime (formato "~Xh Ymin" ou "~Ymin")
    const estMatch = estimatedTime.match(/~?(\d+)h?\s*(\d+)?min?/);
    if (!estMatch) return estimatedTime;

    const estHours = parseInt(estMatch[1]) || 0;
    const estMinutes = parseInt(estMatch[2]) || 0;
    const estTotalMinutes = estHours * 60 + estMinutes;

    const remainingMinutes = Math.max(0, estTotalMinutes - elapsedTotalMinutes);

    if (remainingMinutes === 0) return 'Concluindo...';
    if (remainingMinutes < 60) return `~${remainingMinutes} min restantes`;
    const hours = Math.floor(remainingMinutes / 60);
    const mins = remainingMinutes % 60;
    return mins > 0 ? `~${hours}h ${mins}min restantes` : `~${hours}h restantes`;
  };

  const timeRemaining = getTimeRemaining();

  return (
    <View style={styles.container}>
      {/* Header com label e porcentagem */}
      <View style={styles.header}>
        <View style={styles.labelContainer}>
          <Ionicons name="flag-outline" size={14} color={theme.colors.gray600} />
          <Text style={styles.label}>Progresso da Rota</Text>
        </View>
        <Text style={[styles.percentage, { color: theme.colors.primary }]}>
          {percentage}%
        </Text>
      </View>

      {/* Barra de progresso com milestones dinâmicos */}
      <View style={styles.barContainer}>
        <Animated.View
          style={[
            styles.barFill,
            {
              width: animatedWidth.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '100%'],
              }),
              backgroundColor: percentage === 100 ? theme.colors.success : theme.colors.primary,
            },
          ]}
        />

        {/* Milestones dinâmicos - um para cada parada */}
        {milestones.map((milestone) => (
          <View
            key={milestone.index}
            style={[
              styles.milestone,
              { left: `${milestone.position}%` },
              milestone.isCompleted && styles.milestoneCompleted,
              milestone.isCurrent && styles.milestoneCurrent,
            ]}
          >
            {milestone.isCurrent && (
              <View style={[styles.currentIndicator, { backgroundColor: theme.colors.primary }]} />
            )}
          </View>
        ))}
      </View>

      {/* Estatísticas */}
      <View style={styles.stats}>
        <View style={styles.stat}>
          <View style={[styles.statIcon, { backgroundColor: theme.colors.successBg }]}>
            <Ionicons name="checkmark" size={14} color={theme.colors.successDark} />
          </View>
          <View>
            <Text style={[styles.statNumber, { color: theme.colors.successDark }]}>{completed}</Text>
            <Text style={styles.statLabel}>Concluídas</Text>
          </View>
        </View>

        {timeElapsed && (
          <View style={styles.stat}>
            <View style={[styles.statIcon, { backgroundColor: theme.colors.primaryBg }]}>
              <Ionicons name="time" size={14} color={theme.colors.primary} />
            </View>
            <View>
              <Text style={[styles.statNumber, { color: theme.colors.primary }]}>{timeElapsed}</Text>
              <Text style={styles.statLabel}>Decorrido</Text>
            </View>
          </View>
        )}

        <View style={styles.stat}>
          <View style={[styles.statIcon, { backgroundColor: theme.colors.warningBg }]}>
            <Ionicons name="location" size={14} color={theme.colors.warningText} />
          </View>
          <View>
            <Text style={[styles.statNumber, { color: theme.colors.warningText }]}>{total - completed}</Text>
            <Text style={styles.statLabel}>Restantes</Text>
          </View>
        </View>
      </View>

      {/* Tempo restante estimado */}
      {timeRemaining && (
        <View style={styles.estimatedContainer}>
          <Ionicons name="hourglass-outline" size={12} color={colors.gray500} />
          <Text style={styles.estimatedText}>{timeRemaining}</Text>
        </View>
      )}
    </View>
  );
}

const colors = defaultTheme.colors;

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: colors.white,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray700,
  },
  percentage: {
    fontSize: 18,
    fontWeight: '700',
  },
  barContainer: {
    height: 10,
    backgroundColor: colors.gray200,
    borderRadius: 5,
    overflow: 'visible',
    position: 'relative',
  },
  barFill: {
    height: '100%',
    borderRadius: 5,
  },
  milestone: {
    position: 'absolute',
    top: -2,
    width: 4,
    height: 14,
    backgroundColor: colors.white,
    borderRadius: 2,
    marginLeft: -2,
    borderWidth: 1,
    borderColor: colors.gray300,
  },
  milestoneCompleted: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  milestoneCurrent: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  currentIndicator: {
    position: 'absolute',
    top: -8,
    left: -4,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 16,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    color: colors.gray600, // Mais escuro para melhor contraste (5.74:1)
    marginTop: -2,
  },
  estimatedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
  },
  estimatedText: {
    fontSize: 12,
    color: colors.gray500,
    fontStyle: 'italic',
  },
});
