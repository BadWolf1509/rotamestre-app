/**
 * Mini gráfico de performance semanal
 * Mostra 7 barras representando entregas de cada dia da semana
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';

import { WeeklyData } from '@/hooks/useMilestones';
import { getTodayISO } from '@/lib/dateUtils';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

interface WeeklyChartProps {
  data: WeeklyData[];
  averagePerDay: number;
  isLoading?: boolean;
  /** Modo compacto com altura reduzida */
  compact?: boolean;
}

export function WeeklyChart({
  data,
  averagePerDay,
  isLoading = false,
  compact = false,
}: WeeklyChartProps) {
  const { theme } = useUnistyles();
  const barAnims = useRef(data.map(() => new Animated.Value(0))).current;

  // Encontrar o máximo para escala
  const maxEntregas = Math.max(...data.map((d) => d.entregas), 1);
  const today = getTodayISO();

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
            <Ionicons
              name="bar-chart-outline"
              size={16}
              color={theme.colors.gray500}
            />
            <Text style={styles.title}>Semana</Text>
          </View>
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons
            name="calendar-outline"
            size={24}
            color={theme.colors.gray400}
          />
          <Text style={styles.emptyText}>Sem entregas esta semana</Text>
          <Text style={styles.emptySubtext}>
            Complete rotas para ver seu progresso
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      {/* Header com título e totais */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons
            name="bar-chart-outline"
            size={compact ? 14 : 16}
            color={theme.colors.gray500}
          />
          <Text style={[styles.title, compact && styles.titleCompact]}>
            {compact ? 'Semana' : 'Última semana'}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <Text
            style={[styles.totalValue, compact && styles.totalValueCompact]}
          >
            {totalSemana}
          </Text>
          <Text style={styles.totalLabel}>entregas</Text>
        </View>
      </View>

      {/* Gráfico de barras */}
      <View
        style={[styles.chartContainer, compact && styles.chartContainerCompact]}
      >
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
                {/* Linha de média - oculta em modo compacto */}
                {!compact && averagePerDay > 0 && (
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
              <Text
                style={[
                  styles.dayLabel,
                  isToday && styles.dayLabelToday,
                  compact && styles.dayLabelCompact,
                ]}
              >
                {item.day}
              </Text>
              {/* Valores apenas no modo normal */}
              {!compact && item.entregas > 0 && (
                <Text
                  style={[styles.barValue, isToday && styles.barValueToday]}
                >
                  {item.entregas}
                </Text>
              )}
            </View>
          );
        })}
      </View>

      {/* Legenda - oculta em modo compacto */}
      {!compact && (
        <View style={styles.legendContainer}>
          <View style={styles.legendItem}>
            <View
              style={[
                styles.legendDot,
                { backgroundColor: theme.colors.primary },
              ]}
            />
            <Text style={styles.legendText}>Hoje</Text>
          </View>
          {averagePerDay > 0 && (
            <View style={styles.legendItem}>
              <View
                style={[
                  styles.legendLine,
                  { backgroundColor: theme.colors.warning },
                ]}
              />
              <Text style={styles.legendText}>Média: {averagePerDay}/dia</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing['3'],
    marginBottom: theme.spacing['2'],
    ...theme.shadows.card, // Standardized shadow preset
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing['6'],
  },
  loadingText: {
    fontSize: theme.typography.sm, // 14px
    color: theme.colors.gray500,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing['2.5'],
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing['1.5'],
  },
  title: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray700,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: theme.spacing['1'],
  },
  totalValue: {
    fontSize: theme.typography.lg,
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.primary,
  },
  totalLabel: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray500,
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 60,
    paddingHorizontal: theme.spacing['1'],
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    gap: theme.spacing['1'],
  },
  barWrapper: {
    flex: 1,
    width: '80%',
    justifyContent: 'flex-end',
    position: 'relative',
  },
  bar: {
    width: '100%',
    borderRadius: theme.borderRadius.xs,
    minHeight: 4,
  },
  averageLine: {
    position: 'absolute',
    left: theme.spacing['1'],
    right: theme.spacing['1'],
    height: 2,
    backgroundColor: theme.colors.warning,
    borderRadius: 1,
  },
  dayLabel: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray500,
    fontFamily: theme.typography.fontSansMedium,
  },
  dayLabelToday: {
    color: theme.colors.primary,
    fontFamily: theme.typography.fontSansBold,
  },
  barValue: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray600,
    fontFamily: theme.typography.fontSansSemiBold,
    position: 'absolute',
    top: -16,
  },
  barValueToday: {
    color: theme.colors.primary,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing['4'],
    gap: theme.spacing['1'],
  },
  emptyText: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray600,
    fontFamily: theme.typography.fontSansMedium,
    marginTop: theme.spacing.sm,
  },
  emptySubtext: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray500,
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing['4'],
    marginTop: theme.spacing['2'],
    paddingTop: theme.spacing['2'],
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray100,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing['1'],
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
    fontSize: theme.typography.xs,
    color: theme.colors.gray500,
  },
  // Estilos para modo compacto
  containerCompact: {
    padding: theme.spacing['2.5'],
    marginBottom: theme.spacing['1.5'],
  },
  titleCompact: {
    fontSize: theme.typography.fontSize.xs,
  },
  totalValueCompact: {
    fontSize: theme.typography.fontSize.base,
  },
  chartContainerCompact: {
    height: 40,
  },
  dayLabelCompact: {
    fontSize: theme.typography.fontSize.xs, // Min readable (WCAG AA)
  },
}));
