/**
 * StepIndicator - Componente reutilizável para indicar progresso em wizards
 *
 * Exibe círculos numerados com linhas conectoras, mostrando o passo atual,
 * passos completados e passos pendentes.
 *
 * @example
 * ```tsx
 * const steps = [
 *   { id: 'category', title: 'Categoria' },
 *   { id: 'photo', title: 'Foto' },
 *   { id: 'description', title: 'Descrição' },
 *   { id: 'review', title: 'Revisar' },
 * ];
 *
 * <StepIndicator
 *   steps={steps}
 *   currentStep={1}
 *   showTitles={false}
 * />
 * ```
 */

import { Ionicons } from '@expo/vector-icons';
import React, { memo } from 'react';
import { View, Text } from 'react-native';

import { useResponsive } from '@/hooks/useResponsive';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

export interface Step {
  id: string;
  title: string;
}

interface StepIndicatorProps {
  /** Array de passos do wizard */
  steps: Step[];
  /** Índice do passo atual (0-based) */
  currentStep: number;
  /** Mostrar títulos abaixo dos círculos (default: false) */
  showTitles?: boolean;
  /** Tamanho do círculo (default: 30) */
  circleSize?: number;
  /** Espessura da linha conectora (default: 2) */
  lineHeight?: number;
  /** Acessibilidade: label para leitores de tela */
  accessibilityLabel?: string;
}

function StepIndicatorComponent({
  steps,
  currentStep,
  showTitles = false,
  circleSize = 30,
  lineHeight = 2,
  accessibilityLabel,
}: StepIndicatorProps) {
  const { theme } = useUnistyles();
  const { isDesktop } = useResponsive();

  const dynamicStyles = {
    circle: {
      width: circleSize,
      height: circleSize,
      borderRadius: circleSize / 2,
    },
    line: {
      height: lineHeight,
    },
  };

  return (
    <View
      style={[styles.container, isDesktop && styles.containerDesktop]}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel || `Passo ${currentStep + 1} de ${steps.length}`}
      accessibilityValue={{
        min: 0,
        max: steps.length - 1,
        now: currentStep,
        text: `${steps[currentStep]?.title}`,
      }}
    >
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isActive = index === currentStep;
        const isPending = index > currentStep;

        return (
          <View key={step.id} style={styles.stepItem}>
            <View style={styles.stepRow}>
              {/* Círculo do passo */}
              <View
                style={[
                  styles.stepCircle,
                  dynamicStyles.circle,
                  isCompleted && styles.stepCircleCompleted,
                  isActive && styles.stepCircleActive,
                  isPending && styles.stepCirclePending,
                ]}
              >
                {isCompleted ? (
                  <Ionicons name="checkmark" size={circleSize * 0.53} color={theme.colors.white} />
                ) : (
                  <Text
                    style={[
                      styles.stepNumber,
                      (isCompleted || isActive) && styles.stepNumberActive,
                    ]}
                  >
                    {index + 1}
                  </Text>
                )}
              </View>

              {/* Linha conectora (não mostrar após o último) */}
              {index < steps.length - 1 && (
                <View
                  style={[
                    styles.stepLine,
                    dynamicStyles.line,
                    isCompleted && styles.stepLineCompleted,
                  ]}
                />
              )}
            </View>

            {/* Título do passo (opcional) */}
            {showTitles && (
              <Text
                style={[
                  styles.stepTitle,
                  (isCompleted || isActive) && styles.stepTitleActive,
                ]}
                numberOfLines={1}
              >
                {step.title}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

export const StepIndicator = memo(StepIndicatorComponent);

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    flexDirection: 'row',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
  },
  containerDesktop: {
    paddingHorizontal: theme.spacing.lg,
  },
  stepItem: {
    flex: 1,
    alignItems: 'flex-start',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  stepCircle: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepCirclePending: {
    backgroundColor: theme.colors.gray200,
  },
  stepCircleActive: {
    backgroundColor: theme.colors.primary,
  },
  stepCircleCompleted: {
    backgroundColor: theme.colors.primary,
  },
  stepNumber: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray500,
  },
  stepNumberActive: {
    color: theme.colors.white,
  },
  stepLine: {
    flex: 1,
    backgroundColor: theme.colors.gray200,
    marginHorizontal: theme.spacing.xs,
  },
  stepLineCompleted: {
    backgroundColor: theme.colors.primary,
  },
  stepTitle: {
    fontSize: theme.typography.xs,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray500,
    marginTop: theme.spacing.xs,
    textAlign: 'center',
    alignSelf: 'flex-start',
    maxWidth: 60,
  },
  stepTitleActive: {
    color: theme.colors.primary,
    fontFamily: theme.typography.fontSansSemiBold,
  },
}));
