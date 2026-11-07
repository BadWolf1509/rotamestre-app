/**
 * CamposParadaModal - campos comuns dos modais de parada (adicionar e editar):
 * tipo, endereço com autocomplete, destinatário, telefone e observações.
 *
 * É componente de MÓDULO (nunca declarado dentro do render de outro): a
 * identidade estável preserva o foco do autocomplete. A posição na rota (só o
 * adicionar) e a confirmação de vínculo (só o editar) ficam nos modais.
 */

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Controller } from 'react-hook-form';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';

import { AddressAutocomplete } from '@/components/AddressAutocomplete';
import { DesktopFormGrid } from '@/components/desktop/DesktopFormGrid';
import type { ParadaModalFormData } from '@/lib/schemas/parada';
import type { Coordenadas } from '@/types/endereco';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

import type { Control, FieldErrors } from 'react-hook-form';

export interface CamposParadaModalProps {
  control: Control<ParadaModalFormData>;
  errors: FieldErrors<ParadaModalFormData>;
  isDesktop: boolean;
  handleAddressChange: (text: string) => void;
  handleAddressSelect: (
    address: string,
    placeId: string,
    coordinates?: Coordenadas,
  ) => void;
  handlePhoneChange: (text: string) => void;
  /** Texto do rótulo do endereço (o adicionar marca com `*`). */
  rotuloEndereco: string;
  /** Rótulo em linha com o selo "Validado" (o adicionar). */
  comSeloValidado?: boolean;
  /** Coordenadas válidas: acende o selo (só com `comSeloValidado`). */
  enderecoValidado?: boolean;
  /** Aviso abaixo do endereço (o editar: "a rota será recalculada"). */
  notaEndereco?: string | null;
  rotuloObservacoes: string;
}

export function CamposParadaModal({
  control,
  errors,
  isDesktop,
  handleAddressChange,
  handleAddressSelect,
  handlePhoneChange,
  rotuloEndereco,
  comSeloValidado = false,
  enderecoValidado = false,
  notaEndereco = null,
  rotuloObservacoes,
}: CamposParadaModalProps) {
  const { theme } = useUnistyles();

  return (
    <>
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
                    tipo === 'entrega' ? theme.colors.white : theme.colors.info
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
        {comSeloValidado ? (
          <View style={styles.labelRow}>
            <Text
              style={[styles.labelInRow, isDesktop && styles.labelInRowCompact]}
            >
              {rotuloEndereco}
            </Text>
            {enderecoValidado && (
              <View style={styles.validatedBadge}>
                <Ionicons
                  name="checkmark-circle"
                  size={isDesktop ? 14 : 16}
                  color={theme.colors.success}
                />
                <Text
                  style={[
                    styles.validatedText,
                    isDesktop && styles.validatedTextCompact,
                  ]}
                >
                  Validado
                </Text>
              </View>
            )}
          </View>
        ) : (
          <Text style={[styles.label, isDesktop && styles.labelCompact]}>
            {rotuloEndereco}
          </Text>
        )}
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
        {notaEndereco && (
          <Text style={styles.addressChangedNote}>{notaEndereco}</Text>
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
          {rotuloObservacoes}
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
    </>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
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
  labelInRow: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray700,
  },
  labelInRowCompact: {
    fontSize: theme.desktop.input.fontSize,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xs,
  },
  validatedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing['1'],
    backgroundColor: `${theme.colors.success}15`,
    paddingHorizontal: theme.spacing['2'],
    paddingVertical: theme.spacing['0.5'],
    borderRadius: theme.borderRadius.sm,
  },
  validatedText: {
    fontSize: theme.typography.xs,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.success,
  },
  validatedTextCompact: {
    fontSize: theme.typography.fontSize.xs, // Min readable (WCAG AA)
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
}));
