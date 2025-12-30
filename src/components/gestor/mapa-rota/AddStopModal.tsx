/**
 * AddStopModal - Modal para adicionar nova parada a uma rota existente
 * Permite: endereço com autocomplete, tipo, destinatário, telefone, observações
 * Recalcula a rota após inserção
 *
 * Desktop:
 * - Densidade compacta (inputs 36px, spacing 12px)
 * - Grid 2 colunas para campos curtos (destinatário/telefone)
 *
 * Mobile:
 * - Bottom sheet
 * - Layout single-column
 * - Densidade confortável (44px inputs)
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Platform,
  ScrollView,
} from 'react-native';

import { AddressAutocomplete } from '@/components/AddressAutocomplete';
import { DesktopFormGrid } from '@/components/desktop/DesktopFormGrid';
import { DesktopModal } from '@/design-system';
import { useResponsive } from '@/hooks/useResponsive';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

import { useAddStopForm } from './useAddStopForm';

import type { Parada } from './types';

interface EnderecoUnidade {
  latitude: number;
  longitude: number;
}

export interface AddStopModalProps {
  visible: boolean;
  rotaId: string;
  enderecoUnidade: EnderecoUnidade | null;
  currentParadasCount: number;
  allParadas: Parada[];
  onSave: () => void;
  onCancel: () => void;
  usuarioId?: string;
  /** ID do motorista atribuído à rota (para notificação) */
  motoristaId?: string | null;
}

export function AddStopModal({
  visible,
  rotaId,
  enderecoUnidade,
  currentParadasCount,
  allParadas,
  onSave,
  onCancel,
  usuarioId,
  motoristaId,
}: AddStopModalProps) {
  const { theme } = useUnistyles();
  const { isDesktop } = useResponsive();

  // Hook centralizado para gerenciamento do formulário
  const {
    endereco,
    destinatario,
    telefone,
    observacoes,
    tipo,
    posicaoInsercao,
    setDestinatario,
    setObservacoes,
    setTipo,
    setPosicaoInsercao,
    handleAddressSelect,
    handleAddressChange,
    handlePhoneChange,
    handleSave,
    paradasReaisParaSelecao,
    canAddMoreStops,
    hasValidCoordinates,
    isSaving,
    error,
    warning,
    MAX_PARADAS,
  } = useAddStopForm({
    visible,
    rotaId,
    enderecoUnidade,
    currentParadasCount,
    allParadas,
    onSave,
    usuarioId,
    motoristaId,
  });

  // Refs for scrolling
  const scrollViewRef = useRef<ScrollView>(null);
  const errorRef = useRef<View>(null);
  const errorYPosition = useRef<number>(0);

  // Scroll to error/warning when it appears
  useEffect(() => {
    if ((error || warning) && errorRef.current) {
      // Web: use scrollIntoView for smooth scroll
      if (Platform.OS === 'web') {
        const element = errorRef.current as unknown as HTMLElement;
        element.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      } else {
        // Native: use ScrollView scrollTo with measured position
        scrollViewRef.current?.scrollTo({
          y: errorYPosition.current,
          animated: true,
        });
      }
    }
  }, [error, warning]);

  return (
    <DesktopModal
      visible={visible}
      onClose={onCancel}
      title="Adicionar Parada"
      maxWidth={500}
      primaryButton={{
        text: 'Adicionar',
        onPress: handleSave,
        loading: isSaving,
        disabled: !canAddMoreStops,
      }}
      secondaryButton={{
        text: 'Cancelar',
        onPress: onCancel,
        disabled: isSaving,
      }}
    >
      {/* Limit warning */}
      {!canAddMoreStops && (
        <View style={styles.warningBanner}>
          <Ionicons name="warning" size={18} color={theme.colors.warning} />
          <Text style={styles.warningText}>
            Limite de {MAX_PARADAS} paradas atingido
          </Text>
        </View>
      )}

      {/* Body */}
      <ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Tipo */}
        <View style={[styles.field, isDesktop && styles.fieldCompact]}>
          <Text style={[styles.label, isDesktop && styles.labelCompact]}>Tipo</Text>
          <View style={[styles.tipoContainer, isDesktop && styles.tipoContainerCompact]}>
            <TouchableOpacity
              style={[
                styles.tipoButton,
                isDesktop && styles.tipoButtonCompact,
                tipo === 'entrega' && styles.tipoButtonActive,
              ]}
              onPress={() => setTipo('entrega')}
            >
              <Ionicons
                name="arrow-down-circle"
                size={isDesktop ? 16 : 18}
                color={tipo === 'entrega' ? theme.colors.white : theme.colors.info}
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
              onPress={() => setTipo('retirada')}
            >
              <Ionicons
                name="arrow-up-circle"
                size={isDesktop ? 16 : 18}
                color={tipo === 'retirada' ? theme.colors.white : theme.colors.warning}
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
        </View>

        {/* Endereço */}
        <View style={[styles.field, isDesktop && styles.fieldCompact]}>
          <View style={styles.labelRow}>
            <Text style={[styles.labelInRow, isDesktop && styles.labelInRowCompact]}>Endereço *</Text>
            {hasValidCoordinates && (
              <View style={styles.validatedBadge}>
                <Ionicons name="checkmark-circle" size={isDesktop ? 14 : 16} color={theme.colors.success} />
                <Text style={[styles.validatedText, isDesktop && styles.validatedTextCompact]}>Validado</Text>
              </View>
            )}
          </View>
          <AddressAutocomplete
            value={endereco}
            onChangeText={handleAddressChange}
            onSelectAddress={handleAddressSelect}
            placeholder="Digite o endereço completo"
          />
        </View>

        {/* Destinatário + Telefone em grid */}
        <DesktopFormGrid columns={2}>
          <View style={[styles.field, isDesktop && styles.fieldCompact]}>
            <Text style={[styles.label, isDesktop && styles.labelCompact]}>Destinatário</Text>
            <TextInput
              style={[styles.input, isDesktop && styles.inputCompact]}
              value={destinatario}
              onChangeText={setDestinatario}
              placeholder="Nome do destinatário"
              placeholderTextColor={theme.colors.gray400}
            />
          </View>

          <View style={[styles.field, isDesktop && styles.fieldCompact]}>
            <Text style={[styles.label, isDesktop && styles.labelCompact]}>Telefone</Text>
            <TextInput
              style={[styles.input, isDesktop && styles.inputCompact]}
              value={telefone}
              onChangeText={handlePhoneChange}
              placeholder="(00) 00000-0000"
              placeholderTextColor={theme.colors.gray400}
              keyboardType="phone-pad"
              maxLength={15}
            />
          </View>
        </DesktopFormGrid>

        {/* Observações - full width */}
        <View style={[styles.field, isDesktop && styles.fieldCompact]}>
          <Text style={[styles.label, isDesktop && styles.labelCompact]}>Observações</Text>
          <TextInput
            style={[styles.input, isDesktop && styles.inputCompact, styles.textArea, isDesktop && styles.textAreaCompact]}
            value={observacoes}
            onChangeText={setObservacoes}
            placeholder="Observações sobre a parada"
            placeholderTextColor={theme.colors.gray400}
            multiline
            numberOfLines={isDesktop ? 2 : 3}
            textAlignVertical="top"
          />
        </View>

        {/* Posição na Rota */}
        <View
          style={[styles.field, isDesktop && styles.fieldCompact]}
          accessibilityRole="radiogroup"
          accessibilityLabel="Selecione a posição na rota"
        >
          <Text style={[styles.label, isDesktop && styles.labelCompact]}>Posição na Rota</Text>

          {/* Options: Before each existing stop (badge shows final position) */}
          {paradasReaisParaSelecao.map((parada) => {
            const isSelected = posicaoInsercao === parada.ordem;
            const addressText = parada.endereco
              ? `Antes de: ${parada.endereco}`
              : 'Antes de: Endereço não definido';

            return (
              <TouchableOpacity
                key={parada.id}
                style={[
                  styles.positionOption,
                  isDesktop && styles.positionOptionCompact,
                  isSelected && styles.positionOptionSelected,
                ]}
                onPress={() => setPosicaoInsercao(parada.ordem)}
                accessibilityRole="radio"
                accessibilityLabel={`Posição ${parada.ordem}, ${addressText}`}
                accessibilityState={{ checked: isSelected }}
              >
                <View style={[
                  styles.radioCircle,
                  isDesktop && styles.radioCircleCompact,
                  isSelected && styles.radioCircleSelected,
                ]}>
                  {isSelected ? <View style={[styles.radioCircleInner, isDesktop && styles.radioCircleInnerCompact]} /> : null}
                </View>
                <View style={[styles.orderBadge, isDesktop && styles.orderBadgeCompact]}>
                  <Text style={[styles.orderText, isDesktop && styles.orderTextCompact]}>{parada.ordem}</Text>
                </View>
                <Text style={[styles.positionText, isDesktop && styles.positionTextCompact]} numberOfLines={2}>{addressText}</Text>
              </TouchableOpacity>
            );
          })}

          {/* Option: Insert at end (after all stops) */}
          {paradasReaisParaSelecao.length > 0 && (
            <TouchableOpacity
              style={[
                styles.positionOption,
                isDesktop && styles.positionOptionCompact,
                posicaoInsercao === null && styles.positionOptionSelected,
              ]}
              onPress={() => setPosicaoInsercao(null)}
              accessibilityRole="radio"
              accessibilityLabel={`Posição ${paradasReaisParaSelecao.length + 1}, Final da rota`}
              accessibilityState={{ checked: posicaoInsercao === null }}
            >
              <View style={[
                styles.radioCircle,
                isDesktop && styles.radioCircleCompact,
                posicaoInsercao === null && styles.radioCircleSelected,
              ]}>
                {posicaoInsercao === null ? <View style={[styles.radioCircleInner, isDesktop && styles.radioCircleInnerCompact]} /> : null}
              </View>
              <View style={[styles.orderBadge, isDesktop && styles.orderBadgeCompact]}>
                <Text style={[styles.orderText, isDesktop && styles.orderTextCompact]}>{paradasReaisParaSelecao.length + 1}</Text>
              </View>
              <Text style={[styles.positionText, isDesktop && styles.positionTextCompact]}>Final da rota</Text>
            </TouchableOpacity>
          )}

          {paradasReaisParaSelecao.length === 0 && (
            <Text style={styles.noStopsHint}>
              Primeira parada da rota - será inserida no início
            </Text>
          )}
        </View>

        {/* Error message */}
        {error && (
          <View
            ref={errorRef}
            style={styles.errorContainer}
            onLayout={(event) => {
              errorYPosition.current = event.nativeEvent.layout.y;
            }}
          >
            <Ionicons name="alert-circle" size={16} color={theme.colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Warning message (e.g., route recalculation failed) */}
        {warning && (
          <View
            ref={!error ? errorRef : undefined}
            style={styles.warningContainer}
            onLayout={(event) => {
              if (!error) {
                errorYPosition.current = event.nativeEvent.layout.y;
              }
            }}
          >
            <Ionicons name="warning" size={16} color={theme.colors.warning} />
            <Text style={styles.warningMessageText}>{warning}</Text>
          </View>
        )}
      </ScrollView>
    </DesktopModal>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.warningBg,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    marginHorizontal: -theme.spacing.lg,
    marginTop: -theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  warningText: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.warning,
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
    marginBottom: 4,
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
    gap: 4,
    backgroundColor: `${theme.colors.success}15`,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  validatedText: {
    fontSize: theme.typography.xs,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.success,
  },
  validatedTextCompact: {
    fontSize: 11,
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
    paddingVertical: 6,
    gap: 4,
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
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.warningBg,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.sm,
  },
  warningMessageText: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.warning,
    flex: 1,
  },
  // Position selector styles
  positionOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.xs,
    backgroundColor: theme.colors.gray50,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
  positionOptionCompact: {
    paddingVertical: 6,
    paddingHorizontal: theme.desktop.section.padding,
    marginBottom: 4,
  },
  positionOptionSelected: {
    backgroundColor: `${theme.colors.primary}10`,
    borderColor: theme.colors.primary,
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: theme.colors.gray400,
    marginRight: theme.spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioCircleCompact: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 6,
  },
  radioCircleSelected: {
    borderColor: theme.colors.primary,
  },
  radioCircleInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.primary,
  },
  radioCircleInnerCompact: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  orderBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.warning,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.sm,
  },
  orderBadgeCompact: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 6,
  },
  orderText: {
    color: theme.colors.white,
    fontSize: 11,
    fontFamily: theme.typography.fontSansBold,
  },
  orderTextCompact: {
    fontSize: 10,
  },
  positionText: {
    flex: 1,
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray700,
  },
  positionTextCompact: {
    fontSize: theme.desktop.input.fontSize,
  },
  noStopsHint: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray500,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: theme.spacing.md,
  },
}));
