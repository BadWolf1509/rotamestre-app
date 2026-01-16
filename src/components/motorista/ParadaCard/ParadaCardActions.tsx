/**
 * ParadaCardActions - Action buttons (navegar, reportar, retomar)
 */

import { Ionicons } from '@expo/vector-icons';
import React, { memo } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';

import { useUnistyles } from '@/utils/styles';

import { styles } from './ParadaCard.styles';

interface PrimaryActionsProps {
  onNavegar: () => void;
  onReportar: () => void;
}

export const PrimaryActions = memo(function PrimaryActions({
  onNavegar,
  onReportar,
}: PrimaryActionsProps) {
  const { theme } = useUnistyles();

  return (
    <View style={styles.primaryActionsContainer}>
      <TouchableOpacity
        style={styles.botaoNavegar}
        onPress={onNavegar}
        activeOpacity={0.7}
        accessibilityLabel="Como chegar"
        accessibilityRole="button"
        accessibilityHint="Abre o aplicativo de navegação"
      >
        <Text style={styles.botaoNavegarIcone}>{'\u{1F9ED}'}</Text>
        <Text style={styles.botaoNavegarTexto}>Como Chegar</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.botaoReportar}
        onPress={onReportar}
        activeOpacity={0.7}
        accessibilityLabel="Reportar problema"
        accessibilityRole="button"
        accessibilityHint="Abre formulário para reportar incidente"
      >
        <Ionicons name="warning-outline" size={20} color={theme.colors.white} />
        <Text style={styles.botaoReportarTexto}>Reportar Problema</Text>
      </TouchableOpacity>
    </View>
  );
});

interface RetomarButtonProps {
  onRetomar: () => void;
  retomando: boolean;
}

export const RetomarButton = memo(function RetomarButton({
  onRetomar,
  retomando,
}: RetomarButtonProps) {
  const { theme } = useUnistyles();

  return (
    <View style={styles.retornarContainer}>
      <TouchableOpacity
        style={[styles.botaoRetomar, retomando && styles.botaoDisabled]}
        onPress={onRetomar}
        disabled={retomando}
        activeOpacity={0.7}
        accessibilityLabel="Retomar parada"
        accessibilityRole="button"
        accessibilityHint="Volta esta parada para o status pendente"
        accessibilityState={{ disabled: retomando }}
      >
        {retomando ? (
          <ActivityIndicator color={theme.colors.white} size="small" />
        ) : (
          <>
            <Ionicons name="refresh" size={18} color={theme.colors.white} />
            <Text style={styles.botaoRetomarTexto}>Retomar Parada</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
});

export const SwipeHint = memo(function SwipeHint() {
  const { theme } = useUnistyles();

  return (
    <View style={styles.swipeHint}>
      <Ionicons name="swap-horizontal" size={16} color={theme.colors.gray400} />
      <Text style={styles.swipeHintText}>Deslize para ações</Text>
    </View>
  );
});
