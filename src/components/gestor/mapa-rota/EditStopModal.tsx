/**
 * EditStopModal - Modal para editar uma parada existente
 * Permite editar: endereço, destinatário, telefone, observações, tipo
 * Recalcula a rota se o endereço (coordenadas) mudar
 *
 * Desktop:
 * - Densidade compacta (inputs 36px, spacing 12px)
 * - Grid 2 colunas para campos curtos (Destinatário + Telefone)
 *
 * Mobile:
 * - Bottom sheet
 * - Layout single-column
 * - Densidade confortável (44px inputs)
 */

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';

import { DesktopModal } from '@/design-system';
import { useResponsive } from '@/hooks/useResponsive';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

import { CamposParadaModal } from './CamposParadaModal';
import { useEditStopForm } from './useEditStopForm';

import type { Parada } from './types';

interface EnderecoUnidade {
  latitude: number;
  longitude: number;
}

export interface EditStopModalProps {
  visible: boolean;
  parada: Parada | null;
  rotaId: string;
  enderecoUnidade: EnderecoUnidade | null;
  allParadas: Parada[];
  onSave: (result: {
    routeRecalculationFailed: boolean;
    /** Só presente (true) quando o vínculo das entregas dependentes não foi solto. */
    vinculoNaoDesfeito?: boolean;
  }) => void;
  /** O banco mostrou que a tela estava velha (parada já finalizada): recarregue. */
  onDesatualizada?: () => void;
  onCancel: () => void;
  usuarioId?: string;
  motoristaId?: string | null;
}

export function EditStopModal({
  visible,
  parada,
  rotaId,
  enderecoUnidade,
  allParadas,
  onSave,
  onDesatualizada,
  onCancel,
  usuarioId,
  motoristaId,
}: EditStopModalProps) {
  const { theme } = useUnistyles();
  const { isDesktop } = useResponsive();

  // Hook centralizado para gerenciamento do formulário
  const {
    control,
    errors,
    handleAddressSelect,
    handleAddressChange,
    handlePhoneChange,
    handleSave,
    confirmarSalvarComVinculo,
    cancelarConfirmacaoVinculo,
    confirmacaoVinculo,
    coordinatesChanged,
    isSaving,
    error,
  } = useEditStopForm({
    visible,
    parada,
    rotaId,
    enderecoUnidade,
    allParadas,
    onSave,
    onDesatualizada,
    usuarioId,
    motoristaId,
  });

  if (!parada) return null;

  return (
    <DesktopModal
      visible={visible}
      onClose={onCancel}
      title="Editar Parada"
      maxWidth={500}
      primaryButton={{
        text: 'Salvar',
        onPress: handleSave,
        loading: isSaving,
      }}
      secondaryButton={{
        text: 'Cancelar',
        onPress: onCancel,
        disabled: isSaving,
      }}
    >
      {/* Body */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <CamposParadaModal
          control={control}
          errors={errors}
          isDesktop={isDesktop}
          handleAddressChange={handleAddressChange}
          handleAddressSelect={handleAddressSelect}
          handlePhoneChange={handlePhoneChange}
          rotuloEndereco="Endereço"
          notaEndereco={
            coordinatesChanged ? 'A rota será recalculada após salvar' : null
          }
          rotuloObservacoes="Observações"
        />

        {/* Trocar o tipo solta o vínculo retirada -> entrega: confirma antes */}
        {confirmacaoVinculo && (
          <View style={styles.confirmacaoContainer} accessibilityRole="alert">
            <Ionicons name="warning" size={16} color={theme.colors.warning} />
            <View style={styles.confirmacaoCorpo}>
              <Text style={styles.confirmacaoTexto}>{confirmacaoVinculo}</Text>
              <View style={styles.confirmacaoAcoes}>
                <TouchableOpacity
                  style={styles.confirmacaoBotao}
                  onPress={cancelarConfirmacaoVinculo}
                  disabled={isSaving}
                >
                  <Text style={styles.confirmacaoBotaoTexto}>Voltar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.confirmacaoBotao,
                    styles.confirmacaoBotaoPrimario,
                  ]}
                  onPress={confirmarSalvarComVinculo}
                  disabled={isSaving}
                >
                  <Text
                    style={[
                      styles.confirmacaoBotaoTexto,
                      styles.confirmacaoBotaoTextoPrimario,
                    ]}
                  >
                    Confirmar e salvar
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Error message */}
        {error && (
          <View style={styles.errorContainer}>
            <Ionicons
              name="alert-circle"
              size={16}
              color={theme.colors.error}
            />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </ScrollView>
    </DesktopModal>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  confirmacaoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.warningBg,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.sm,
  },
  confirmacaoCorpo: {
    flex: 1,
    gap: theme.spacing.sm,
  },
  confirmacaoTexto: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray700,
  },
  confirmacaoAcoes: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    justifyContent: 'flex-end',
  },
  confirmacaoBotao: {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.warning,
  },
  confirmacaoBotaoPrimario: {
    backgroundColor: theme.colors.warning,
  },
  confirmacaoBotaoTexto: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.warning,
  },
  confirmacaoBotaoTextoPrimario: {
    color: theme.colors.white,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    backgroundColor: `${theme.colors.error}10`,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.sm,
  },
  errorText: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.error,
    flex: 1,
  },
}));
