/**
 * useEditStopForm - Hook para gerenciamento do formulário de editar parada
 *
 * Encapsula:
 * - Estados do formulário (endereço, tipo, destinatário, etc.)
 * - Inicialização com dados da parada
 * - Detecção de mudança de endereço (para feedback visual)
 * - Handlers de mudança
 * - Lógica de salvamento com geocoding, update e notificação
 * - Recálculo de rota apenas se coordenadas realmente mudaram
 */

import { useCallback, useEffect, useState } from 'react';

import { googleMapsService } from '@/lib/google';
import { recalcularRota, notificarMotoristaRotaEditada } from '@/lib/routeUtils';
import { supabase } from '@/lib/supabase';
import { maskPhone } from '@/utils/phoneValidation';

import type { Parada } from './types';

interface EnderecoUnidade {
  latitude: number;
  longitude: number;
}

export interface UseEditStopFormParams {
  visible: boolean;
  parada: Parada | null;
  rotaId: string;
  enderecoUnidade: EnderecoUnidade | null;
  allParadas: Parada[];
  onSave: () => void;
  usuarioId?: string;
  motoristaId?: string | null;
}

export function useEditStopForm({
  visible,
  parada,
  rotaId,
  enderecoUnidade,
  allParadas,
  onSave,
  usuarioId,
  motoristaId,
}: UseEditStopFormParams) {
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
  const [error, setError] = useState<string | null>(null);

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
      setError(null);
    }
  }, [visible, parada]);

  // Check if form has details filled
  const hasDetails = !!(destinatario || telefone || observacoes);

  // Check if coordinates changed (for UI feedback - shows recalculation warning)
  const coordinatesChanged = parada
    ? latitude !== parada.latitude || longitude !== parada.longitude
    : false;

  // Handle address selection from autocomplete
  const handleAddressSelect = useCallback(async (address: string, placeId: string) => {
    setEndereco(address);
    setAddressChanged(true);
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

  // Handle address text change (manual typing)
  const handleAddressChange = useCallback((text: string) => {
    setEndereco(text);
    setError(null);
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

    // Validate
    if (!endereco.trim()) {
      setError('Endereço é obrigatório');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      // If address changed but no coordinates, try to geocode
      let finalLatitude = latitude;
      let finalLongitude = longitude;

      if (addressChanged && (!finalLatitude || !finalLongitude)) {
        const geocoded = await googleMapsService.geocodeAddress(endereco);
        if (geocoded?.coordenadas) {
          finalLatitude = geocoded.coordenadas.latitude;
          finalLongitude = geocoded.coordenadas.longitude;
        } else {
          setError('Não foi possível encontrar as coordenadas do endereço');
          return;
        }
      }

      // Check if coordinates actually changed (more accurate than text comparison)
      const coordinatesChanged =
        finalLatitude !== parada.latitude || finalLongitude !== parada.longitude;

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

      // Only recalculate route if coordinates ACTUALLY changed
      if (coordinatesChanged && enderecoUnidade && finalLatitude && finalLongitude) {
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
            coordenadas_alteradas: coordinatesChanged,
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
    } catch (err) {
      console.error('Erro ao salvar parada:', err);
      setError('Erro ao salvar parada. Tente novamente.');
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
    addressChanged, // Still needed for geocoding trigger
    enderecoUnidade,
    allParadas,
    usuarioId,
    motoristaId,
    onSave,
  ]);

  return {
    // Form values
    endereco,
    destinatario,
    telefone,
    observacoes,
    tipo,

    // Setters
    setDestinatario,
    setObservacoes,
    setTipo,

    // Handlers
    handleAddressSelect,
    handleAddressChange,
    handlePhoneChange,
    handleSave,

    // Derived state
    coordinatesChanged,
    hasDetails,

    // UI state
    isSaving,
    error,
  };
}
