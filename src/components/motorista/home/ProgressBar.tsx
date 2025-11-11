import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useUnistyles } from '@/utils/styles';

interface ProgressBarProps {
  completed: number;
  total: number;
  timeElapsed?: string;
  estimatedTime?: string;
}

export function ProgressBar({ completed, total, timeElapsed, estimatedTime }: ProgressBarProps) {
  const { theme } = useUnistyles();
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>Progresso da Rota</Text>
        <Text style={styles.percentage}>{percentage}%</Text>
      </View>

      <View style={styles.barContainer}>
        <View style={[styles.barFill, { width: `${percentage}%` }]} />

        {/* Milestones */}
        <View style={[styles.milestone, { left: '25%' }]} />
        <View style={[styles.milestone, { left: '50%' }]} />
        <View style={[styles.milestone, { left: '75%' }]} />
      </View>

      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={[styles.statNumber, { color: theme.colors.success }]}>{completed}</Text>
          <Text style={styles.statLabel}>Concluídas</Text>
        </View>

        {timeElapsed && (
          <View style={styles.stat}>
            <Text style={[styles.statNumber, { color: theme.colors.primary }]}>{timeElapsed}</Text>
            <Text style={styles.statLabel}>Tempo</Text>
          </View>
        )}

        <View style={styles.stat}>
          <Text style={[styles.statNumber, { color: theme.colors.warning }]}>{total - completed}</Text>
          <Text style={styles.statLabel}>Restantes</Text>
        </View>

        {estimatedTime && (
          <View style={styles.stat}>
            <Text style={[styles.statNumber, { color: theme.colors.info }]}>{estimatedTime}</Text>
            <Text style={styles.statLabel}>Estimado</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  percentage: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  barContainer: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  barFill: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 4,
  },
  milestone: {
    position: 'absolute',
    top: 0,
    width: 2,
    height: '100%',
    backgroundColor: '#fff',
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
  },
  stat: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
});