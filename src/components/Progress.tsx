/**
 * ============================================
 * Progress - Componente de Barra de Progresso
 * ============================================
 *
 * Barra de progresso reutilizável com label e porcentagem.
 * Usa design tokens para cores, tipografia e espaçamento.
 */

import { View, Text, StyleSheet, ViewStyle, Animated } from 'react-native';
import { useEffect, useRef } from 'react';
import { colors, typography, spacing, borderRadius } from '@/lib/design-tokens';

type ProgressSize = 'small' | 'medium' | 'large';
type ProgressColor = 'primary' | 'success' | 'warning' | 'error';

interface ProgressProps {
  progress: number; // 0 a 1 (ex: 0.5 = 50%)
  label?: string;
  showPercentage?: boolean;
  size?: ProgressSize;
  color?: ProgressColor;
  animated?: boolean;
  style?: ViewStyle;
}

export function Progress({
  progress,
  label,
  showPercentage = true,
  size = 'medium',
  color = 'primary',
  animated = true,
  style,
}: ProgressProps) {
  const animatedWidth = useRef(new Animated.Value(0)).current;
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const percentage = Math.round(clampedProgress * 100);

  useEffect(() => {
    if (animated) {
      Animated.timing(animatedWidth, {
        toValue: clampedProgress,
        duration: 500,
        useNativeDriver: false,
      }).start();
    } else {
      animatedWidth.setValue(clampedProgress);
    }
  }, [clampedProgress, animated]);

  const getColorForProgress = (): string => {
    switch (color) {
      case 'primary':
        return colors.primary.main;
      case 'success':
        return colors.success;
      case 'warning':
        return colors.warning;
      case 'error':
        return colors.error;
      default:
        return colors.primary.main;
    }
  };

  const widthInterpolated = animatedWidth.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={[styles.container, style]}>
      {/* Label e Porcentagem */}
      {(label || showPercentage) && (
        <View style={styles.header}>
          {label && <Text style={styles.label}>{label}</Text>}
          {showPercentage && (
            <Text style={[styles.percentage, { color: getColorForProgress() }]}>
              {percentage}%
            </Text>
          )}
        </View>
      )}

      {/* Progress Bar */}
      <View style={[styles.progressBackground, styles[size]]}>
        <Animated.View
          style={[
            styles.progressFill,
            {
              width: widthInterpolated,
              backgroundColor: getColorForProgress(),
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },

  label: {
    ...typography.styles.caption,
    color: colors.text.primary,
    flex: 1,
  },

  percentage: {
    ...typography.styles.caption,
    fontFamily: typography.fontFamily.semibold,
    minWidth: 40,
    textAlign: 'right',
  },

  progressBackground: {
    backgroundColor: colors.gray[200],
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },

  progressFill: {
    height: '100%',
    borderRadius: borderRadius.full,
  },

  // Tamanhos
  small: {
    height: 6,
  },
  medium: {
    height: 8,
  },
  large: {
    height: 12,
  },
});

// Export default para facilitar import
export default Progress;

/**
 * ============================================
 * EXEMPLOS DE USO
 * ============================================
 *
 * import Progress from '@/components/Progress';
 *
 * // Progress bar básica
 * <Progress progress={0.65} />
 *
 * // Progress bar com label
 * <Progress
 *   progress={completedStops / totalStops}
 *   label="Paradas concluídas"
 * />
 *
 * // Progress bar sem porcentagem
 * <Progress
 *   progress={0.5}
 *   label="Carregando..."
 *   showPercentage={false}
 * />
 *
 * // Progress bar pequena
 * <Progress progress={0.3} size="small" />
 *
 * // Progress bar grande
 * <Progress progress={0.8} size="large" />
 *
 * // Progress bar verde (sucesso)
 * <Progress
 *   progress={1.0}
 *   label="Upload completo"
 *   color="success"
 * />
 *
 * // Progress bar amarela (atenção)
 * <Progress
 *   progress={0.4}
 *   label="Espaço em disco"
 *   color="warning"
 * />
 *
 * // Progress bar vermelha (erro/crítico)
 * <Progress
 *   progress={0.9}
 *   label="Limite de requisições"
 *   color="error"
 * />
 *
 * // Progress bar sem animação
 * <Progress progress={0.7} animated={false} />
 *
 * // Progress bar em card
 * <View style={{ padding: 16 }}>
 *   <Progress
 *     progress={completedTasks / totalTasks}
 *     label={`${completedTasks} de ${totalTasks} tarefas`}
 *   />
 * </View>
 */
