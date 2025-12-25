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
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from 'react-native';

import { AddressAutocomplete } from '@/components/AddressAutocomplete';
import { DesktopFormGrid } from '@/components/desktop/DesktopFormGrid';
import { DesktopModal } from '@/components/desktop/DesktopModal';
import { useResponsive } from '@/hooks/useResponsive';
import { googleMapsService } from '@/lib/google';
import { recalcularRota, notificarMotoristaRotaEditada } from '@/lib/routeUtils';
import { supabase } from '@/lib/supabase';
import { maskPhone } from '@/utils/phoneValidation';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

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

// Limite de paradas (Google API)
const MAX_PARADAS = 23;

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

  // Form state
  const [endereco, setEndereco] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [destinatario, setDestinatario] = useState('');
  const [telefone, setTelefone] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [tipo, setTipo] = useState<'entrega' | 'retirada'>('entrega');

  // Position selection state
  // null = insert at end (default behavior)
  // number = insert AT this position (before the stop currently at this ordem)
  const [posicaoInsercao, setPosicaoInsercao] = useState<number | null>(null);

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track previous visibility to detect modal opening (false -> true transition)
  const prevVisibleRef = useRef(false);

  // Ref for error container (scroll to error)
  const errorRef = useRef<View>(null);

  // Get only real stops (exclude partida/chegada) for position selection
  // Memoized to prevent useEffect from triggering on every render
  const paradasReaisParaSelecao = useMemo(
    () =>
      allParadas
        .filter((p) => p.is_checkpoint !== false && p.status !== 'concluida' && p.status !== 'pulada')
        .sort((a, b) => a.ordem - b.ordem),
    [allParadas]
  );

  // Reset form only when modal OPENS (transition from false to true)
  useEffect(() => {
    const wasVisible = prevVisibleRef.current;
    prevVisibleRef.current = visible;

    // Only reset when modal opens (false -> true), not on every render
    if (visible && !wasVisible) {
      setEndereco('');
      setLatitude(null);
      setLongitude(null);
      setDestinatario('');
      setTelefone('');
      setObservacoes('');
      setTipo('entrega');
      // Default to null (insert at end of route)
      setPosicaoInsercao(null);
      setError(null);
    }
  }, [visible, paradasReaisParaSelecao]);

  // Scroll to error when it appears
  useEffect(() => {
    if (error && errorRef.current) {
      // Web: use scrollIntoView for smooth scroll
      if (Platform.OS === 'web') {
        const element = errorRef.current as unknown as HTMLElement;
        element.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      }
      // Native: would require ScrollView ref - modal content is typically short enough
    }
  }, [error]);

  // Check if can add more stops
  const canAddMoreStops = currentParadasCount < MAX_PARADAS;

  // Handle address selection from autocomplete
  const handleAddressSelect = useCallback(async (address: string, placeId: string) => {
    setEndereco(address);
    setError(null);

    // Get coordinates from place details
    try {
      const details = await googleMapsService.getPlaceDetails(placeId);
      if (details?.coordenadas) {
        setLatitude(details.coordenadas.latitude);
        setLongitude(details.coordenadas.longitude);
      }
    } catch (err) {
      console.error('Erro ao obter coordenadas:', err);
    }
  }, []);

  // Handle address text change
  const handleAddressChange = useCallback((text: string) => {
    setEndereco(text);
    setError(null);
    // Clear coordinates when manually typing
    setLatitude(null);
    setLongitude(null);
  }, []);

  // Handle phone formatting
  const handlePhoneChange = useCallback((text: string) => {
    setTelefone(maskPhone(text));
  }, []);

  // Validate form
  const validateForm = useCallback((): boolean => {
    if (!endereco.trim()) {
      setError('Endereço é obrigatório');
      return false;
    }
    if (!canAddMoreStops) {
      setError(`Limite de ${MAX_PARADAS} paradas atingido`);
      return false;
    }
    return true;
  }, [endereco, canAddMoreStops]);

  // Save new stop using atomic RPC
  const handleSave = useCallback(async () => {
    if (!validateForm() || !rotaId) return;

    try {
      setIsSaving(true);
      setError(null);

      // Get coordinates if not already set
      let finalLatitude = latitude;
      let finalLongitude = longitude;

      if (!finalLatitude || !finalLongitude) {
        const geocoded = await googleMapsService.geocodeAddress(endereco);
        if (geocoded?.coordenadas) {
          finalLatitude = geocoded.coordenadas.latitude;
          finalLongitude = geocoded.coordenadas.longitude;
        } else {
          setError('Não foi possível encontrar as coordenadas do endereço');
          return;
        }
      }

      // Use atomic RPC to insert parada (handles order adjustments in single transaction)
      const { data: rpcResult, error: rpcError } = await supabase.rpc('inserir_parada', {
        p_rota_id: rotaId,
        p_tipo: tipo,
        p_endereco: endereco,
        p_latitude: finalLatitude,
        p_longitude: finalLongitude,
        p_posicao_insercao: posicaoInsercao,
        p_destinatario: destinatario || null,
        p_telefone: telefone || null,
        p_observacoes: observacoes || null,
      });

      if (rpcError) {
        throw rpcError;
      }

      if (!rpcResult?.success) {
        throw new Error(rpcResult?.error || 'Erro desconhecido ao inserir parada');
      }

      const newParadaId = rpcResult.parada_id;
      const newStopOrdem = rpcResult.ordem;

      // Recalculate route
      if (enderecoUnidade) {
        const updatedParadas = [
          ...allParadas,
          {
            id: newParadaId,
            ordem: newStopOrdem,
            latitude: finalLatitude,
            longitude: finalLongitude,
            is_checkpoint: true,
          },
        ];

        const recalcResult = await recalcularRota(rotaId, updatedParadas, enderecoUnidade);
        if (!recalcResult.success) {
          console.warn('Recálculo de rota falhou:', recalcResult.error);
          // Continue anyway - the stop was added
        }
      }

      // Log the addition
      if (usuarioId) {
        await supabase.from('logs').insert({
          usuario_id: usuarioId,
          rota_id: rotaId,
          evento: 'parada_adicionada',
          detalhes: {
            parada_id: newParadaId,
            endereco,
            tipo,
            ordem: newStopOrdem,
            posicao_insercao: posicaoInsercao === null ? 'final' : `posicao_${posicaoInsercao}`,
          },
        });
      }

      // Notify motorista about the new stop (if assigned)
      if (motoristaId) {
        await notificarMotoristaRotaEditada({
          rotaId,
          motoristaId,
          tipo: 'rota_parada_adicionada',
          titulo: '📍 Nova parada adicionada',
          mensagem: `Uma nova parada foi adicionada à sua rota: ${endereco.substring(0, 50)}${endereco.length > 50 ? '...' : ''}`,
          paradaId: newParadaId,
        });
      }

      onSave();
    } catch (err) {
      console.error('Erro ao adicionar parada:', err);
      setError('Erro ao adicionar parada. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  }, [
    validateForm,
    rotaId,
    endereco,
    latitude,
    longitude,
    tipo,
    destinatario,
    telefone,
    observacoes,
    posicaoInsercao,
    allParadas,
    enderecoUnidade,
    usuarioId,
    motoristaId,
    onSave,
  ]);

  return (
    <DesktopModal
      visible={visible}
      onClose={onCancel}
      title="Adicionar Parada"
      maxWidth={500}
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
      <View style={[styles.body, isDesktop && styles.bodyCompact]}>
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
            {latitude && longitude && (
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
          <View ref={errorRef} style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={16} color={theme.colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </View>

      {/* Footer */}
      <View style={[styles.footer, isDesktop && styles.footerCompact]}>
        <TouchableOpacity
          style={[styles.cancelButton, isDesktop && styles.cancelButtonCompact]}
          onPress={onCancel}
          disabled={isSaving}
        >
          <Text style={[styles.cancelButtonText, isDesktop && styles.cancelButtonTextCompact]}>Cancelar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.saveButton,
            isDesktop && styles.saveButtonCompact,
            (isSaving || !canAddMoreStops) && styles.saveButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={isSaving || !canAddMoreStops}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={theme.colors.white} />
          ) : (
            <>
              <Ionicons name="add" size={isDesktop ? 16 : 18} color={theme.colors.white} />
              <Text style={[styles.saveButtonText, isDesktop && styles.saveButtonTextCompact]}>Adicionar</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
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
  body: {
    // No maxHeight - let content expand naturally
  },
  bodyCompact: {
    // No maxHeight - let content expand naturally
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
  },
  footer: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    paddingTop: theme.spacing.lg,
    paddingHorizontal: 0,
    backgroundColor: theme.colors.gray50,
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray200,
    marginHorizontal: -theme.spacing.lg,
    marginBottom: -theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    paddingLeft: theme.spacing.lg,
    paddingRight: theme.spacing.lg,
  },
  footerCompact: {
    gap: theme.desktop.section.gap,
    paddingTop: theme.desktop.section.padding,
    paddingBottom: theme.desktop.section.padding,
    paddingLeft: theme.desktop.section.padding,
    paddingRight: theme.desktop.section.padding,
    // Margins devem corresponder ao padding do DesktopModal (12px, não 16px)
    marginHorizontal: -theme.desktop.section.padding,
    marginBottom: -theme.desktop.section.padding,
  },
  cancelButton: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    minWidth: 100,
    alignItems: 'center',
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
      transitionProperty: 'all',
      transitionDuration: '0.2s',
    }),
  },
  cancelButtonCompact: {
    paddingHorizontal: theme.desktop.button.paddingHorizontal,
    paddingVertical: 6,
    minWidth: 80,
  },
  cancelButtonText: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray700,
  },
  cancelButtonTextCompact: {
    fontSize: theme.desktop.button.fontSize,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    minWidth: 100,
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
      transitionProperty: 'all',
      transitionDuration: '0.2s',
    }),
  },
  saveButtonCompact: {
    paddingHorizontal: theme.desktop.button.paddingHorizontal,
    paddingVertical: 6,
    minWidth: 80,
    gap: 4,
  },
  saveButtonDisabled: {
    backgroundColor: theme.colors.gray300,
  },
  saveButtonText: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.white,
  },
  saveButtonTextCompact: {
    fontSize: theme.desktop.button.fontSize,
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
