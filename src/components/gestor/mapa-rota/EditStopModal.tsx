/**
 * EditStopModal - Modal para editar uma parada existente
 * Permite editar: endereço, destinatário, telefone, observações, tipo
 * Recalcula a rota se o endereço (coordenadas) mudar
 *
 * Desktop:
 * - Densidade compacta (inputs 36px, spacing 12px)
 * - Grid 2 colunas para campos curtos
 * - Progressive disclosure para detalhes opcionais
 *
 * Mobile:
 * - Bottom sheet
 * - Layout single-column
 * - Densidade confortável (44px inputs)
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';

import { AddressAutocomplete } from '@/components/AddressAutocomplete';
import { CollapsibleSection } from '@/components/desktop/CollapsibleSection';
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

export interface EditStopModalProps {
  visible: boolean;
  parada: Parada | null;
  rotaId: string;
  enderecoUnidade: EnderecoUnidade | null;
  allParadas: Parada[];
  onSave: () => void;
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
  onCancel,
  usuarioId,
  motoristaId,
}: EditStopModalProps) {
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

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [addressChanged, setAddressChanged] = useState(false);

  // Initialize form with parada data when modal opens
  useEffect(() => {
    if (visible && parada) {
      setEndereco(parada.endereco || '');
      setLatitude(parada.latitude);
      setLongitude(parada.longitude);
      setDestinatario(parada.destinatario || '');
      setTelefone(parada.telefone || '');
      setObservacoes(parada.observacoes || '');
      setTipo(parada.tipo);
      setAddressChanged(false);
    }
  }, [visible, parada]);

  // Handle address selection from autocomplete
  const handleAddressSelect = useCallback(async (address: string, placeId: string) => {
    setEndereco(address);
    setAddressChanged(true);

    // Get coordinates from place details
    try {
      const details = await googleMapsService.getPlaceDetails(placeId);
      if (details?.coordenadas) {
        setLatitude(details.coordenadas.latitude);
        setLongitude(details.coordenadas.longitude);
      }
    } catch (error) {
      console.error('Erro ao obter coordenadas:', error);
    }
  }, []);

  // Handle address text change (manual typing)
  const handleAddressChange = useCallback((text: string) => {
    setEndereco(text);
    // Mark as changed only if different from original
    if (text !== parada?.endereco) {
      setAddressChanged(true);
    }
  }, [parada?.endereco]);

  // Handle phone formatting
  const handlePhoneChange = useCallback((text: string) => {
    setTelefone(maskPhone(text));
  }, []);

  // Save changes
  const handleSave = useCallback(async () => {
    if (!parada || !rotaId) return;

    try {
      setIsSaving(true);

      // If address changed but no coordinates, try to geocode
      let finalLatitude = latitude;
      let finalLongitude = longitude;

      if (addressChanged && (!finalLatitude || !finalLongitude)) {
        const geocoded = await googleMapsService.geocodeAddress(endereco);
        if (geocoded?.coordenadas) {
          finalLatitude = geocoded.coordenadas.latitude;
          finalLongitude = geocoded.coordenadas.longitude;
        }
      }

      // Update parada in database
      const { error: updateError } = await supabase
        .from('paradas')
        .update({
          endereco,
          latitude: finalLatitude,
          longitude: finalLongitude,
          destinatario: destinatario || null,
          telefone: telefone || null,
          observacoes: observacoes || null,
          tipo,
        })
        .eq('id', parada.id);

      if (updateError) {
        throw updateError;
      }

      // If address/coordinates changed, recalculate route
      if (addressChanged && enderecoUnidade && finalLatitude && finalLongitude) {
        const updatedParadas = allParadas.map((p) =>
          p.id === parada.id
            ? { ...p, latitude: finalLatitude, longitude: finalLongitude }
            : p
        );

        await recalcularRota(rotaId, updatedParadas, enderecoUnidade);
      }

      // Log the edit
      if (usuarioId) {
        await supabase.from('logs').insert({
          usuario_id: usuarioId,
          rota_id: rotaId,
          evento: 'parada_editada',
          detalhes: {
            parada_id: parada.id,
            campos_alterados: {
              endereco: endereco !== parada.endereco,
              destinatario: destinatario !== parada.destinatario,
              telefone: telefone !== parada.telefone,
              observacoes: observacoes !== parada.observacoes,
              tipo: tipo !== parada.tipo,
            },
            coordenadas_alteradas: addressChanged,
          },
        });
      }

      // Notify motorista about the edit (if assigned)
      if (motoristaId) {
        const camposEditados: string[] = [];
        if (endereco !== parada.endereco) camposEditados.push('endereço');
        if (destinatario !== parada.destinatario) camposEditados.push('destinatário');
        if (telefone !== parada.telefone) camposEditados.push('telefone');
        if (tipo !== parada.tipo) camposEditados.push('tipo');

        const mensagem = camposEditados.length > 0
          ? `Alterações: ${camposEditados.join(', ')}`
          : 'Uma parada da sua rota foi editada';

        await notificarMotoristaRotaEditada({
          rotaId,
          motoristaId,
          tipo: 'rota_parada_editada',
          titulo: '✏️ Parada editada',
          mensagem,
          paradaId: parada.id,
        });
      }

      onSave();
    } catch (error) {
      console.error('Erro ao salvar parada:', error);
      // Let parent handle error display
    } finally {
      setIsSaving(false);
    }
  }, [
    parada,
    rotaId,
    endereco,
    latitude,
    longitude,
    destinatario,
    telefone,
    observacoes,
    tipo,
    addressChanged,
    enderecoUnidade,
    allParadas,
    usuarioId,
    motoristaId,
    onSave,
  ]);

  if (!parada) return null;

  return (
    <DesktopModal
      visible={visible}
      onClose={onCancel}
      title="Editar Parada"
      maxWidth={500}
      maxHeight="85%"
    >
      {/* Body */}
      <ScrollView style={[styles.body, isDesktop && styles.bodyCompact]} showsVerticalScrollIndicator={false}>
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
          <Text style={[styles.label, isDesktop && styles.labelCompact]}>Endereço</Text>
          <AddressAutocomplete
            value={endereco}
            onChangeText={handleAddressChange}
            onSelectAddress={handleAddressSelect}
            placeholder="Digite o endereço completo"
          />
          {addressChanged && (
            <Text style={styles.addressChangedNote}>
              A rota será recalculada após salvar
            </Text>
          )}
        </View>

        {/* Detalhes adicionais (colapsável em desktop) */}
        <CollapsibleSection
          title="Detalhes adicionais"
          icon="document-text-outline"
          defaultExpanded={!isDesktop}
          forceExpanded={!!(destinatario || telefone || observacoes)}
        >
          {/* Destinatário + Telefone em grid */}
          <DesktopFormGrid columns={2}>
            <View style={[styles.field, isDesktop && styles.fieldCompact]}>
              <Text style={styles.label}>Destinatário</Text>
              <TextInput
                style={[styles.input, isDesktop && styles.inputCompact]}
                value={destinatario}
                onChangeText={setDestinatario}
                placeholder="Nome do destinatário"
                placeholderTextColor={theme.colors.gray400}
              />
            </View>

            <View style={[styles.field, isDesktop && styles.fieldCompact]}>
              <Text style={styles.label}>Telefone</Text>
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
            <Text style={styles.label}>Observações</Text>
            <TextInput
              style={[styles.input, styles.textArea, isDesktop && styles.textAreaCompact]}
              value={observacoes}
              onChangeText={setObservacoes}
              placeholder="Observações sobre a parada"
              placeholderTextColor={theme.colors.gray400}
              multiline
              numberOfLines={isDesktop ? 2 : 3}
              textAlignVertical="top"
            />
          </View>
        </CollapsibleSection>
      </ScrollView>

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
          style={[styles.saveButton, isDesktop && styles.saveButtonCompact, isSaving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={theme.colors.white} />
          ) : (
            <>
              <Ionicons name="checkmark" size={isDesktop ? 16 : 18} color={theme.colors.white} />
              <Text style={[styles.saveButtonText, isDesktop && styles.saveButtonTextCompact]}>Salvar</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </DesktopModal>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  body: {
    maxHeight: 400,
  },
  bodyCompact: {
    maxHeight: 350,
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
    fontSize: theme.desktop.input.fontSize - 1,
    marginBottom: 4,
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
    fontSize: theme.desktop.input.fontSize - 1,
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
    backgroundColor: theme.colors.secondary,
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
}));
