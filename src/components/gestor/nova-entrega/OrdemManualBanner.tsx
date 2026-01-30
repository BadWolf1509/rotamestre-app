/**
 * Banner exibido quando a ordem das paradas foi alterada manualmente
 * Mostra comparativo entre rota otimizada e ordem atual
 * Auto-calcula distância real via OSRM com debounce
 */

import { Ionicons } from '@expo/vector-icons';
import React, { memo } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';

import { useResponsive } from '@/hooks/useResponsive';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

import type {
  RotaOtimizadaState,
  DistanciaManualReal,
} from './types';

export interface OrdemManualBannerProps {
  rotaOtimizada: RotaOtimizadaState;
  distanciaManualReal: DistanciaManualReal | null;
  isOptimizing: boolean;
  isCalculandoReal: boolean;
  onReoptimize: () => void;
}

export const OrdemManualBanner = memo(function OrdemManualBanner({
  rotaOtimizada,
  distanciaManualReal,
  isOptimizing,
  isCalculandoReal,
  onReoptimize,
}: OrdemManualBannerProps) {
  const { theme } = useUnistyles();
  const { isDesktop } = useResponsive();
  const styles = createStyles(theme, isDesktop);

  // Calcular diferença quando temos distância real
  const diferenca = distanciaManualReal
    ? distanciaManualReal.metros - rotaOtimizada.distancia_total_metros
    : 0;
  const percentual = distanciaManualReal && rotaOtimizada.distancia_total_metros > 0
    ? (diferenca / rotaOtimizada.distancia_total_metros) * 100
    : 0;
  const isPositiva = diferenca > 0;

  return (
    <View style={styles.ordemManualBanner}>
      <View style={styles.ordemManualHeader}>
        <View style={styles.ordemManualTitleRow}>
          <Ionicons name="swap-vertical" size={20} color={theme.colors.warning} />
          <Text style={styles.ordemManualTitle}>Ordem alterada manualmente</Text>
        </View>
        <TouchableOpacity
          style={styles.reotimizarButton}
          onPress={onReoptimize}
          disabled={isOptimizing}
          accessibilityLabel="Re-otimizar rota para o melhor percurso"
          accessibilityRole="button"
          accessibilityState={{ disabled: isOptimizing }}
        >
          {isOptimizing ? (
            <ActivityIndicator size="small" color={theme.colors.white} />
          ) : (
            <>
              <Ionicons name="refresh" size={14} color={theme.colors.white} />
              <Text style={styles.reotimizarButtonText}>Re-otimizar</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.comparativoContainer}>
        <View style={styles.comparativoItem}>
          <View style={styles.comparativoLabelRow}>
            <Ionicons name="checkmark-circle" size={16} color={theme.colors.success} />
            <Text style={styles.comparativoLabel}>Rota Otimizada:</Text>
          </View>
          <Text style={styles.comparativoValueSuccess}>
            {(rotaOtimizada.distancia_total_metros / 1000).toFixed(1)} km
          </Text>
          <Text style={styles.comparativoTime}>
            ~{Math.round(rotaOtimizada.duracao_total_segundos / 60)} min
          </Text>
        </View>

        <View style={styles.comparativoSeparator}>
          <Ionicons name="arrow-forward" size={16} color={theme.colors.gray400} />
        </View>

        <View style={styles.comparativoItem}>
          <View style={styles.comparativoLabelRow}>
            <Ionicons name="navigate" size={16} color={theme.colors.warning} />
            <Text style={styles.comparativoLabel}>Ordem Atual:</Text>
          </View>
          {isCalculandoReal ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={theme.colors.warning} />
              <Text style={styles.loadingText}>Calculando...</Text>
            </View>
          ) : distanciaManualReal ? (
            <>
              <Text style={[
                styles.comparativoValue,
                isPositiva && styles.comparativoValueWarning,
              ]}>
                {(distanciaManualReal.metros / 1000).toFixed(1)} km
              </Text>
              <Text style={styles.comparativoTime}>
                ~{Math.round(distanciaManualReal.segundos / 60)} min
              </Text>
            </>
          ) : (
            <Text style={styles.comparativoValue}>--</Text>
          )}
        </View>

        <View style={styles.comparativoItem}>
          <Text style={styles.comparativoLabel}>Diferença:</Text>
          {isCalculandoReal ? (
            <Text style={styles.comparativoDiferenca}>--</Text>
          ) : distanciaManualReal ? (
            <Text style={[
              styles.comparativoDiferenca,
              isPositiva ? styles.comparativoDiferencaNegativa : styles.comparativoDiferencaPositiva,
            ]}>
              {isPositiva ? '+' : ''}{(diferenca / 1000).toFixed(1)} km ({isPositiva ? '+' : ''}{percentual.toFixed(0)}%)
            </Text>
          ) : (
            <Text style={styles.comparativoDiferenca}>--</Text>
          )}
        </View>
      </View>
    </View>
  );
});

const createStyles = (theme: Theme, isDesktop: boolean) => StyleSheet.create({
  ordemManualBanner: {
    backgroundColor: theme.colors.warning + '10',
    borderWidth: 1,
    borderColor: theme.colors.warning + '40',
    borderRadius: theme.borderRadius.lg,
    padding: isDesktop ? theme.desktop.section.padding : theme.spacing.lg,
    marginTop: isDesktop ? theme.desktop.field.marginBottom : theme.spacing.lg,
    marginBottom: isDesktop ? theme.desktop.field.marginBottom : theme.spacing.lg,
  },
  ordemManualHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: isDesktop ? theme.desktop.section.gap : theme.spacing.lg,
  },
  ordemManualTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: isDesktop ? 4 : theme.spacing.sm,
  },
  ordemManualTitle: {
    fontSize: isDesktop ? theme.desktop.input.fontSize : theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.warning,
  },
  reotimizarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: isDesktop ? 4 : theme.spacing.xs,
    backgroundColor: theme.colors.warning,
    paddingVertical: isDesktop ? 4 : theme.spacing.sm,
    paddingHorizontal: isDesktop ? theme.desktop.button.paddingHorizontal : theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    minHeight: isDesktop ? 28 : 36,
  },
  reotimizarButtonText: {
    fontSize: isDesktop ? theme.desktop.button.fontSize : theme.typography.xs,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.white,
  },
  comparativoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    padding: isDesktop ? theme.desktop.section.padding : theme.spacing.lg,
    marginBottom: isDesktop ? theme.desktop.section.gap : theme.spacing.md,
  },
  comparativoItem: {
    flex: 1,
    alignItems: 'center',
  },
  comparativoLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: isDesktop ? 4 : theme.spacing.xs,
    marginBottom: isDesktop ? 4 : theme.spacing.sm,
  },
  comparativoLabel: {
    fontSize: isDesktop ? 12 : theme.typography.xs,
    color: theme.colors.gray600,
    fontFamily: theme.typography.fontSansMedium,
  },
  comparativoValue: {
    fontSize: isDesktop ? theme.typography.base : theme.typography.lg,
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.gray900,
  },
  comparativoValueSuccess: {
    fontSize: isDesktop ? theme.typography.base : theme.typography.lg,
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.success,
  },
  comparativoValueWarning: {
    color: theme.colors.warning,
  },
  comparativoTime: {
    fontSize: isDesktop ? 11 : theme.typography.xs,
    color: theme.colors.gray500,
    marginTop: isDesktop ? 2 : theme.spacing.xs,
  },
  loadingContainer: {
    alignItems: 'center',
    gap: isDesktop ? 4 : theme.spacing.xs,
  },
  loadingText: {
    fontSize: isDesktop ? 11 : theme.typography.xs,
    color: theme.colors.gray500,
    fontStyle: 'italic',
  },
  comparativoSeparator: {
    paddingHorizontal: isDesktop ? 6 : theme.spacing.sm,
    paddingTop: isDesktop ? theme.spacing.lg : theme.spacing.xl,
  },
  comparativoDiferenca: {
    fontSize: isDesktop ? theme.desktop.input.fontSize : theme.typography.base,
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.gray700,
    textAlign: 'center',
  },
  comparativoDiferencaNegativa: {
    color: theme.colors.error,
  },
  comparativoDiferencaPositiva: {
    color: theme.colors.success,
  },
});
