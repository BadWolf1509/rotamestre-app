/**
 * Banner exibido quando a rota foi otimizada
 */

import React, { memo } from 'react';
import { View, Text } from 'react-native';

import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

import type { RotaOtimizadaState, EnderecoUnidade } from './types';

export interface RotaOtimizadaBannerProps {
  rotaOtimizada: RotaOtimizadaState;
  enderecoUnidade: EnderecoUnidade | null;
}

export const RotaOtimizadaBanner = memo(function RotaOtimizadaBanner({
  rotaOtimizada,
  enderecoUnidade,
}: RotaOtimizadaBannerProps) {
  const { theme } = useUnistyles();
  const styles = createStyles(theme, rotaOtimizada.isEstimated === true);

  return (
    <View
      style={styles.otimizacaoBanner}
      accessibilityRole="alert"
      accessibilityLabel={`${rotaOtimizada.isEstimated ? 'Rota apenas estimada' : 'Rota otimizada'}: ${(rotaOtimizada.distancia_total_metros / 1000).toFixed(1)} quilômetros, ${Math.round(rotaOtimizada.duracao_total_segundos / 60)} minutos`}
    >
      <Text style={styles.otimizacaoBannerTitle}>
        {rotaOtimizada.isEstimated
          ? 'Estimativa aproximada — recálculo necessário'
          : 'Rota otimizada!'}
      </Text>
      <View style={styles.otimizacaoStats}>
        <View style={styles.otimizacaoStat}>
          <Text style={styles.otimizacaoStatLabel}>Distância:</Text>
          <Text style={styles.otimizacaoStatValue}>
            {(rotaOtimizada.distancia_total_metros / 1000).toFixed(1)} km
          </Text>
        </View>
        <View style={styles.otimizacaoStat}>
          <Text style={styles.otimizacaoStatLabel}>Tempo Estimado:</Text>
          <Text style={styles.otimizacaoStatValue}>
            {Math.round(rotaOtimizada.duracao_total_segundos / 60)} min
          </Text>
        </View>
      </View>
      <Text style={styles.otimizacaoBannerHint}>
        Rota circular {rotaOtimizada.isEstimated ? 'estimada' : 'otimizada'}:{' '}
        {enderecoUnidade?.endereco || 'Unidade'} → Paradas →{' '}
        {enderecoUnidade?.endereco || 'Unidade'}
      </Text>
    </View>
  );
});

const createStyles = (theme: Theme, isEstimated: boolean) =>
  StyleSheet.create({
    otimizacaoBanner: {
      backgroundColor:
        (isEstimated ? theme.colors.warning : theme.colors.success) + '10',
      borderLeftWidth: 4,
      borderLeftColor: isEstimated
        ? theme.colors.warning
        : theme.colors.success,
      borderWidth: 1,
      borderColor:
        (isEstimated ? theme.colors.warning : theme.colors.success) + '30',
      padding: theme.spacing['2xl'],
      borderRadius: theme.borderRadius.lg,
      marginTop: theme.spacing.lg,
    },
    otimizacaoBannerTitle: {
      fontSize: theme.typography.base,
      fontFamily: theme.typography.fontSansSemiBold,
      color: isEstimated ? theme.colors.warning : theme.colors.success,
      marginBottom: theme.spacing.lg,
    },
    otimizacaoStats: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginBottom: theme.spacing.lg,
    },
    otimizacaoStat: {
      alignItems: 'center',
    },
    otimizacaoStatLabel: {
      fontSize: theme.typography.xs,
      color: isEstimated ? theme.colors.warning : theme.colors.success,
      marginBottom: theme.spacing.sm,
    },
    otimizacaoStatValue: {
      fontSize: theme.typography.lg,
      fontFamily: theme.typography.fontSansSemiBold,
      color: isEstimated ? theme.colors.warning : theme.colors.success,
    },
    otimizacaoBannerHint: {
      fontSize: theme.typography.xs,
      color: isEstimated ? theme.colors.warning : theme.colors.success,
      fontStyle: 'italic',
      textAlign: 'center',
    },
  });
