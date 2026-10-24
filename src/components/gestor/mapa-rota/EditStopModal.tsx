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
import { Controller } from 'react-hook-form';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from 'react-native';

import { AddressAutocomplete } from '@/components/AddressAutocomplete';
import { DesktopFormGrid } from '@/components/desktop/DesktopFormGrid';
import { DesktopModal } from '@/design-system';
import { useResponsive } from '@/hooks/useResponsive';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

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
  onSave: (result: { routeRecalculationFailed: boolean }) => void;
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
        {/* Tipo */}
        <View style={[styles.field, isDesktop && styles.fieldCompact]}>
          <Text style={[styles.label, isDesktop && styles.labelCompact]}>
            Tipo
          </Text>
          <Controller
            control={control}
            name="tipo"
            render={({ field: { onChange, value: tipo } }) => (
              <View
                style={[
                  styles.tipoContainer,
                  isDesktop && styles.tipoContainerCompact,
                ]}
              >
                <TouchableOpacity
                  style={[
                    styles.tipoButton,
                    isDesktop && styles.tipoButtonCompact,
                    tipo === 'entrega' && styles.tipoButtonActive,
                  ]}
                  onPress={() => onChange('entrega')}
                >
                  <Ionicons
                    name="arrow-down-circle"
                    size={isDesktop ? 16 : 18}
                    color={
                      tipo === 'entrega'
                        ? theme.colors.white
                        : theme.colors.info
                    }
                  />
                  <Text
                    style={[
                      styles.tipoButtonText,
                      isDesktop && styles.tipoButtonTextCompact,
                      tipo === 'entrega' && styles.tipoButtonTextActive,
                    ]}
                  >
                    Entrega
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.tipoButton,
                    isDesktop && styles.tipoButtonCompact,
                    styles.tipoButtonRetirada,
                    tipo === 'retirada' && styles.tipoButtonRetiradaActive,
                  ]}
                  onPress={() => onChange('retirada')}
                >
                  <Ionicons
                    name="arrow-up-circle"
                    size={isDesktop ? 16 : 18}
                    color={
                      tipo === 'retirada'
                        ? theme.colors.white
                        : theme.colors.warning
                    }
                  />
                  <Text
                    style={[
                      styles.tipoButtonText,
                      isDesktop && styles.tipoButtonTextCompact,
                      styles.tipoButtonTextRetirada,
                      tipo === 'retirada' && styles.tipoButtonTextActive,
                    ]}
                  >
                    Retirada
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          />
        </View>

        {/* Endereço */}
        <View style={[styles.field, isDesktop && styles.fieldCompact]}>
          <Text style={[styles.label, isDesktop && styles.labelCompact]}>
            Endereço
          </Text>
          <Controller
            control={control}
            name="endereco"
            render={({ field: { ref, value } }) => (
              <AddressAutocomplete
                value={value}
                onChangeText={handleAddressChange}
                onSelectAddress={handleAddressSelect}
                placeholder="Digite o endereço completo"
                error={errors.endereco?.message}
                required
                inputRef={ref}
              />
            )}
          />
          {coordinatesChanged && (
            <Text style={styles.addressChangedNote}>
              A rota será recalculada após salvar
            </Text>
          )}
        </View>

        {/* Destinatário + Telefone em grid */}
        <DesktopFormGrid columns={2}>
          <View style={[styles.field, isDesktop && styles.fieldCompact]}>
            <Text style={[styles.label, isDesktop && styles.labelCompact]}>
              Destinatário
            </Text>
            <Controller
              control={control}
              name="destinatario"
              render={({ field: { onBlur, onChange, ref, value } }) => (
                <TextInput
                  style={[styles.input, isDesktop && styles.inputCompact]}
                  value={value ?? ''}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  ref={ref}
                  placeholder="Nome do destinatário"
                  placeholderTextColor={theme.colors.gray400}
                />
              )}
            />
          </View>

          <View style={[styles.field, isDesktop && styles.fieldCompact]}>
            <Text style={[styles.label, isDesktop && styles.labelCompact]}>
              Telefone
            </Text>
            <Controller
              control={control}
              name="telefone"
              render={({ field: { onBlur, ref, value } }) => (
                <TextInput
                  style={[
                    styles.input,
                    isDesktop && styles.inputCompact,
                    errors.telefone && styles.inputError,
                  ]}
                  value={value ?? ''}
                  onChangeText={handlePhoneChange}
                  onBlur={onBlur}
                  ref={ref}
                  placeholder="(00) 00000-0000"
                  placeholderTextColor={theme.colors.gray400}
                  keyboardType="phone-pad"
                  maxLength={15}
                />
              )}
            />
            {errors.telefone && (
              <Text
                style={styles.fieldErrorText}
                accessibilityLiveRegion="assertive"
              >
                {errors.telefone.message}
              </Text>
            )}
          </View>
        </DesktopFormGrid>

        {/* Observações - full width */}
        <View style={[styles.field, isDesktop && styles.fieldCompact]}>
          <Text style={[styles.label, isDesktop && styles.labelCompact]}>
            Observações
          </Text>
          <Controller
            control={control}
            name="observacoes"
            render={({ field: { onBlur, onChange, ref, value } }) => (
              <TextInput
                style={[
                  styles.input,
                  isDesktop && styles.inputCompact,
                  styles.textArea,
                  isDesktop && styles.textAreaCompact,
                ]}
                value={value ?? ''}
                onChangeText={onChange}
                onBlur={onBlur}
                ref={ref}
                placeholder="Observações sobre a parada"
                placeholderTextColor={theme.colors.gray400}
                multiline
                numberOfLines={isDesktop ? 2 : 3}
                textAlignVertical="top"
                maxLength={300}
              />
            )}
          />
          {errors.observacoes && (
            <Text
              style={styles.fieldErrorText}
              accessibilityLiveRegion="assertive"
            >
              {errors.observacoes.message}
            </Text>
          )}
        </View>

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
  field: {
    marginBottom: theme.spacing.lg,
  },
  fieldCompact: {
    marginBottom: theme.desktop.field.marginBottom,
  },
  label: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray700,
    marginBottom: theme.spacing.xs,
  },
  labelCompact: {
    fontSize: theme.desktop.input.fontSize,
    marginBottom: theme.spacing['1'],
  },
  input: {
    backgroundColor: theme.colors.gray50,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 2,
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray900,
  },
  inputError: {
    borderColor: theme.colors.error,
  },
  fieldErrorText: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.error,
    marginTop: theme.spacing.xs,
  },
  inputCompact: {
    height: theme.desktop.input.height,
    paddingHorizontal: theme.desktop.input.paddingHorizontal,
    paddingVertical: 0,
    fontSize: theme.desktop.input.fontSize,
  },
  textArea: {
    minHeight: 80,
    paddingTop: theme.spacing.sm + 2,
  },
  textAreaCompact: {
    minHeight: 60,
    height: 'auto',
    paddingTop: theme.spacing.xs,
    paddingBottom: theme.spacing.xs,
    fontSize: theme.desktop.input.fontSize,
  },
  tipoContainer: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  tipoContainerCompact: {
    gap: theme.desktop.section.gap,
  },
  tipoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.sm + 2,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.info,
    backgroundColor: theme.colors.white,
  },
  tipoButtonCompact: {
    paddingVertical: theme.spacing['1.5'],
    gap: theme.spacing['1'],
  },
  tipoButtonActive: {
    backgroundColor: theme.colors.info,
    borderColor: theme.colors.info,
  },
  tipoButtonRetirada: {
    borderColor: theme.colors.warning,
  },
  tipoButtonRetiradaActive: {
    backgroundColor: theme.colors.warning,
    borderColor: theme.colors.warning,
  },
  tipoButtonText: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.info,
  },
  tipoButtonTextCompact: {
    fontSize: theme.desktop.input.fontSize,
  },
  tipoButtonTextRetirada: {
    color: theme.colors.warning,
  },
  tipoButtonTextActive: {
    color: theme.colors.white,
  },
  addressChangedNote: {
    fontSize: theme.typography.xs,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.warning,
    marginTop: theme.spacing.xs,
    fontStyle: 'italic',
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
