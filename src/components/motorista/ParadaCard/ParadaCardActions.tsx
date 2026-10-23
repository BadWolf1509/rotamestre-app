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
        <Text style={styles.botaoNavegarIcone} maxFontSizeMultiplier={1.3}>
          {'\u{1F9ED}'}
        </Text>
        <Text style={styles.botaoNavegarTexto} maxFontSizeMultiplier={1.3}>
          Como Chegar
        </Text>
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

interface ConcluirPularActionsProps {
  ordem: number;
  onConcluir: () => void;
  onPular: () => void;
  ocupado: boolean;
}

/**
 * Concluir e Pular à vista. Até aqui só existiam no gesto de deslizar, que
 * nada na tela ensinava depois da primeira vez. "Concluir" segue abrindo o
 * StopCompletionFlow (o comprovante) — quem decide é `onConcluir`.
 */
export const ConcluirPularActions = memo(function ConcluirPularActions({
  ordem,
  onConcluir,
  onPular,
  ocupado,
}: ConcluirPularActionsProps) {
  const { theme } = useUnistyles();

  return (
    <View style={styles.acoesConcluirPular} testID="acoes-concluir-pular">
      <TouchableOpacity
        style={[styles.botaoConcluir, ocupado && styles.botaoDesabilitado]}
        onPress={onConcluir}
        disabled={ocupado}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Concluir parada ${ordem}`}
        accessibilityState={{ disabled: ocupado }}
      >
        <Ionicons
          name="checkmark-circle"
          size={20}
          color={theme.colors.white}
        />
        <Text style={styles.botaoConcluirTexto} maxFontSizeMultiplier={1.3}>
          Concluir
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.botaoPular, ocupado && styles.botaoDesabilitado]}
        onPress={onPular}
        disabled={ocupado}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Pular parada ${ordem}`}
        accessibilityState={{ disabled: ocupado }}
      >
        <Ionicons
          name="arrow-forward-circle-outline"
          size={20}
          color={theme.colors.warningDark}
        />
        <Text style={styles.botaoPularTexto} maxFontSizeMultiplier={1.3}>
          Pular
        </Text>
      </TouchableOpacity>
    </View>
  );
});

export const SeloEnvioPendente = memo(function SeloEnvioPendente() {
  const { theme } = useUnistyles();
  return (
    <View style={styles.seloEnvioPendente} testID="selo-envio-pendente">
      <Ionicons
        name="cloud-upload-outline"
        size={14}
        color={theme.colors.info}
      />
      <Text style={styles.seloEnvioPendenteTexto} maxFontSizeMultiplier={1.3}>
        Aguardando envio
      </Text>
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
