/**
 * SkipReasonModal - Modal for capturing structured skip reason
 * when a driver cannot complete a delivery/pickup.
 *
 * Follows CategoryStep grid pattern + DesktopModal.
 */

import { Ionicons } from '@expo/vector-icons';
import React, { memo, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, TextInput, Switch } from 'react-native';

import { DesktopModal } from '@/components/desktop/DesktopModal';
import { SKIP_REASONS, type MotivoSkip } from '@/constants/skipReasons';
import type { ParadaData } from '@/context/RouteStatusContext';
import { rotuloTipoParada } from '@/lib/motorista/rotuloTipoParada';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

interface SkipReasonModalProps {
  visible: boolean;
  parada: ParadaData;
  /** Demais serviços da mesma visita; com eles, oferece pular tudo junto. */
  outrosServicosNoLocal?: ParadaData[];
  onConfirm: (
    motivo: MotivoSkip,
    observacoes?: string,
    incluirOutros?: boolean,
  ) => void;
  onCancel: () => void;
}

const MIN_OUTRO_LENGTH = 10;

function SkipReasonModalComponent({
  visible,
  parada,
  outrosServicosNoLocal,
  onConfirm,
  onCancel,
}: SkipReasonModalProps) {
  const { theme } = useUnistyles();
  const [selectedReason, setSelectedReason] = useState<MotivoSkip | null>(null);
  const [outroText, setOutroText] = useState('');
  const [incluirOutros, setIncluirOutros] = useState(true);

  const temOutros = !!outrosServicosNoLocal && outrosServicosNoLocal.length > 0;
  const rotuloOutros = temOutros
    ? `Pular também: ${outrosServicosNoLocal
        .map((p) => rotuloTipoParada(p.tipo).titulo)
        .join(' + ')}`
    : '';

  const isOutro = selectedReason === 'outro';
  const canConfirm =
    selectedReason !== null &&
    (!isOutro || outroText.trim().length >= MIN_OUTRO_LENGTH);

  const handleConfirm = useCallback(() => {
    if (!selectedReason || !canConfirm) return;
    onConfirm(
      selectedReason,
      isOutro ? outroText.trim() : undefined,
      temOutros ? incluirOutros : undefined,
    );
  }, [
    selectedReason,
    canConfirm,
    isOutro,
    outroText,
    temOutros,
    incluirOutros,
    onConfirm,
  ]);

  const handleClose = useCallback(() => {
    setSelectedReason(null);
    setOutroText('');
    setIncluirOutros(true);
    onCancel();
  }, [onCancel]);

  return (
    <DesktopModal
      visible={visible}
      onClose={handleClose}
      title="Por que não foi possível concluir?"
      maxWidth={480}
      primaryButton={{
        text: 'Confirmar',
        onPress: handleConfirm,
        disabled: !canConfirm,
        color: theme.colors.warning,
      }}
      secondaryButton={{
        text: 'Cancelar',
        onPress: handleClose,
      }}
    >
      <View style={styles.content}>
        <Text style={styles.subtitle} numberOfLines={2}>
          {parada.endereco}
        </Text>

        <View style={styles.reasonsContainer}>
          {SKIP_REASONS.map((reason) => (
            <TouchableOpacity
              key={reason.value}
              style={[
                styles.reasonCard,
                selectedReason === reason.value && styles.reasonCardSelected,
              ]}
              onPress={() => setSelectedReason(reason.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selectedReason === reason.value }}
              accessibilityLabel={reason.label}
            >
              <View
                style={[
                  styles.reasonIcon,
                  { backgroundColor: theme.colors.warning + '20' },
                ]}
              >
                <Ionicons
                  name={reason.icon as keyof typeof Ionicons.glyphMap}
                  size={22}
                  color={theme.colors.warning}
                />
              </View>
              <Text
                style={[
                  styles.reasonLabel,
                  selectedReason === reason.value && styles.reasonLabelSelected,
                ]}
              >
                {reason.label}
              </Text>
              {selectedReason === reason.value && (
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={theme.colors.primary}
                />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {temOutros && (
          <View style={styles.outrosRow}>
            <Text style={styles.outrosLabel}>{rotuloOutros}</Text>
            <Switch
              value={incluirOutros}
              onValueChange={setIncluirOutros}
              accessibilityLabel={rotuloOutros}
            />
          </View>
        )}

        {isOutro && (
          <View style={styles.outroContainer}>
            <TextInput
              style={styles.outroInput}
              placeholder="Descreva o motivo (mínimo 10 caracteres)"
              placeholderTextColor={theme.colors.gray400}
              value={outroText}
              onChangeText={setOutroText}
              multiline
              maxLength={200}
              autoFocus
            />
            <Text style={styles.outroCounter}>
              {outroText.trim().length}/{MIN_OUTRO_LENGTH} mín.
            </Text>
          </View>
        )}
      </View>
    </DesktopModal>
  );
}

export const SkipReasonModal = memo(SkipReasonModalComponent);

const styles = StyleSheet.create((theme: Theme) => ({
  content: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  subtitle: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray500,
    marginBottom: theme.spacing.lg,
  },
  reasonsContainer: {
    gap: theme.spacing.xs,
  },
  reasonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.gray50,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  reasonCardSelected: {
    borderColor: theme.colors.warning,
    backgroundColor: theme.colors.warningBg,
  },
  reasonIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.sm,
  },
  reasonLabel: {
    flex: 1,
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray700,
  },
  reasonLabelSelected: {
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
  },
  outrosRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing.md,
  },
  outrosLabel: {
    flex: 1,
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
    marginRight: theme.spacing.sm,
  },
  outroContainer: {
    marginTop: theme.spacing.md,
  },
  outroInput: {
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    minHeight: 80,
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray900,
    textAlignVertical: 'top',
  },
  outroCounter: {
    fontSize: theme.typography.xs,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray400,
    textAlign: 'right',
    marginTop: theme.spacing.xs,
  },
}));
