import { Ionicons } from '@expo/vector-icons';
import React, { memo, useEffect, useRef } from 'react';
import { View, Text, Animated } from 'react-native';

import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

interface ProgressBarProps {
  completed: number;
  total: number;
  timeElapsed?: string;
  estimatedTime?: string;
  currentStopIndex?: number;
}

export const ProgressBar = memo(function ProgressBar({
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

  /**
   * Converte string de tempo para minutos totais.
   * Suporta formatos: "5min", "30min", "1h 30min", "2h", "~45min", "~1h 30min"
   */
  const parseTimeToMinutes = (timeStr: string): number => {
    if (!timeStr) return 0;

    // Remove prefixo "~" se existir
    const cleanStr = timeStr.replace(/^~/, '').trim();

    // Tenta extrair horas e minutos
    const hoursMatch = cleanStr.match(/(\d+)\s*h/i);
    const minutesMatch = cleanStr.match(/(\d+)\s*min/i);

    const hours = hoursMatch ? parseInt(hoursMatch[1], 10) : 0;
    const minutes = minutesMatch ? parseInt(minutesMatch[1], 10) : 0;

    return hours * 60 + minutes;
  };

  // Calcular tempo restante estimado
  const getTimeRemaining = () => {
    if (!timeElapsed || !estimatedTime) return null;

    const elapsedTotalMinutes = parseTimeToMinutes(timeElapsed);
    const estTotalMinutes = parseTimeToMinutes(estimatedTime);

    // Se não conseguiu parsear, retorna estimado original
    if (estTotalMinutes === 0) return null;

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
          <Ionicons name="hourglass-outline" size={12} color={theme.colors.gray500} />
          <Text style={styles.estimatedText}>{timeRemaining}</Text>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    paddingHorizontal: theme.spacing['4'],
    paddingVertical: theme.spacing['4'],
    backgroundColor: theme.colors.white,
    marginHorizontal: theme.spacing['4'],
    marginVertical: theme.spacing['4'],
    borderRadius: theme.borderRadius.xl,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing['3'],
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing['1.5'],
  },
  label: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray700,
  },
  percentage: {
    fontSize: theme.typography.lg,
    fontFamily: theme.typography.fontSansBold,
  },
  barContainer: {
    height: 10,
    backgroundColor: theme.colors.gray200,
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
    backgroundColor: theme.colors.white,
    borderRadius: 2,
    marginLeft: -2,
    borderWidth: 1,
    borderColor: theme.colors.gray300,
  },
  milestoneCompleted: {
    backgroundColor: theme.colors.success,
    borderColor: theme.colors.success,
  },
  milestoneCurrent: {
    borderColor: theme.colors.primary,
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
    marginTop: theme.spacing['4'],
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing['2'],
  },
  statIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statNumber: {
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSansBold,
  },
  statLabel: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray600,
    marginTop: -2,
  },
  estimatedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing['1'],
    marginTop: theme.spacing['3'],
    paddingTop: theme.spacing['3'],
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray100,
  },
  estimatedText: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray500,
    fontStyle: 'italic',
  },
}));
