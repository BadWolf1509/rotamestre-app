/**
 * Mini gráfico de performance semanal
 * Mostra 7 barras representando entregas de cada dia da semana
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { WeeklyData } from '@/hooks/useMilestones';
import { defaultTheme, useUnistyles } from '@/utils/styles';

interface WeeklyChartProps {
  data: WeeklyData[];
  averagePerDay: number;
  isLoading?: boolean;
}

export function WeeklyChart({ data, averagePerDay, isLoading = false }: WeeklyChartProps) {
  const { theme } = useUnistyles();
  const barAnims = useRef(data.map(() => new Animated.Value(0))).current;

  // Encontrar o máximo para escala
  const maxEntregas = Math.max(...data.map(d => d.entregas), 1);
  const today = new Date().toISOString().split('T')[0];

  // Calcular total da semana
  const totalSemana = data.reduce((sum, d) => sum + d.entregas, 0);

  // Animar as barras
  useEffect(() => {
    if (isLoading) return;

    const animations = data.map((item, index) => {
      const height = (item.entregas / maxEntregas) * 100;
      return Animated.spring(barAnims[index], {
        toValue: height,
        useNativeDriver: false,
        tension: 50,
        friction: 8,
        delay: index * 50,
      });
    });

    Animated.stagger(50, animations).start();
  }, [data, maxEntregas, isLoading, barAnims]);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Carregando dados...</Text>
        </View>
      </View>
    );
  }

  // Verificar se há dados
  const hasData = totalSemana > 0;

  if (!hasData) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="bar-chart-outline" size={16} color={theme.colors.gray500} />
            <Text style={styles.title}>Semana</Text>
          </View>
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons name="calendar-outline" size={24} color={theme.colors.gray400} />
          <Text style={styles.emptyText}>Sem entregas esta semana</Text>
          <Text style={styles.emptySubtext}>Complete rotas para ver seu progresso</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header com título e totais */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="bar-chart-outline" size={16} color={theme.colors.gray500} />
          <Text style={styles.title}>Última semana</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.totalValue}>{totalSemana}</Text>
          <Text style={styles.totalLabel}>entregas</Text>
        </View>
      </View>

      {/* Gráfico de barras */}
      <View style={styles.chartContainer}>
        {data.map((item, index) => {
          const isToday = item.date === today;
          const barColor = isToday
            ? theme.colors.primary
            : item.entregas > 0
              ? theme.colors.primaryLight
              : theme.colors.gray200;

          return (
            <View key={item.date} style={styles.barColumn}>
              <View style={styles.barWrapper}>
                <Animated.View
                  style={[
                    styles.bar,
                    {
                      backgroundColor: barColor,
                      height: barAnims[index].interpolate({
                        inputRange: [0, 100],
                        outputRange: ['0%', '100%'],
                      }),
                    },
                  ]}
                />
                {/* Linha de média */}
                {averagePerDay > 0 && (
                  <View
                    style={[
                      styles.averageLine,
                      {
                        bottom: `${(averagePerDay / maxEntregas) * 100}%`,
                      },
                    ]}
                  />
                )}
              </View>
              <Text style={[
                styles.dayLabel,
                isToday && styles.dayLabelToday
              ]}>
                {item.day}
              </Text>
              {item.entregas > 0 && (
                <Text style={[
                  styles.barValue,
                  isToday && styles.barValueToday
                ]}>
                  {item.entregas}
                </Text>
              )}
            </View>
          );
        })}
      </View>

      {/* Legenda */}
      <View style={styles.legendContainer}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: theme.colors.primary }]} />
          <Text style={styles.legendText}>Hoje</Text>
        </View>
        {averagePerDay > 0 && (
          <View style={styles.legendItem}>
            <View style={[styles.legendLine, { backgroundColor: theme.colors.warning }]} />
            <Text style={styles.legendText}>Média: {averagePerDay}/dia</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const colors = defaultTheme.colors;

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  loadingText: {
    fontSize: 13,
    color: colors.gray500,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray700,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  totalLabel: {
    fontSize: 12,
    color: colors.gray500,
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 60,
    paddingHorizontal: 4,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  barWrapper: {
    flex: 1,
    width: '80%',
    justifyContent: 'flex-end',
    position: 'relative',
  },
  bar: {
    width: '100%',
    borderRadius: 4,
    minHeight: 4,
  },
  averageLine: {
    position: 'absolute',
    left: -4,
    right: -4,
    height: 2,
    backgroundColor: colors.warning,
    borderRadius: 1,
  },
  dayLabel: {
    fontSize: 10,
    color: colors.gray500,
    fontWeight: '500',
  },
  dayLabelToday: {
    color: colors.primary,
    fontWeight: '700',
  },
  barValue: {
    fontSize: 10,
    color: colors.gray600,
    fontWeight: '600',
    position: 'absolute',
    top: -16,
  },
  barValueToday: {
    color: colors.primary,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 4,
  },
  emptyText: {
    fontSize: 13,
    color: colors.gray600,
    fontWeight: '500',
    marginTop: 8,
  },
  emptySubtext: {
    fontSize: 12,
    color: colors.gray500,
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLine: {
    width: 12,
    height: 2,
    borderRadius: 1,
  },
  legendText: {
    fontSize: 11,
    color: colors.gray500,
  },
});
