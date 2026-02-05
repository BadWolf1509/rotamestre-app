/**
 * useAddStopForm - Hook para gerenciamento do formulário de adicionar parada
 *
 * Encapsula:
 * - Estados do formulário (endereço, tipo, destinatário, etc.)
 * - Lógica de reset ao abrir modal
 * - Validação
 * - Handlers de mudança
 * - Lógica de salvamento com geocoding, RPC, recálculo e notificação
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { logger } from '@/lib/logger';
import { maskPhone } from '@/lib/phone';
import { photonService } from '@/lib/photon';
import { recalcularRota, notificarMotoristaRotaEditada } from '@/lib/routeUtils';
import { supabase } from '@/lib/supabase';
import type { Coordenadas } from '@/types/endereco';

import type { Parada } from './types';

interface EnderecoUnidade {
  latitude: number;
  longitude: number;
}

export interface UseAddStopFormParams {
  visible: boolean;
  rotaId: string;
  enderecoUnidade: EnderecoUnidade | null;
  currentParadasCount: number;
  allParadas: Parada[];
  onSave: () => void;
  usuarioId?: string;
  motoristaId?: string | null;
}

// Limite de paradas (Google API)
const MAX_PARADAS = 23;

export function useAddStopForm({
  visible,
  rotaId,
  enderecoUnidade,
  currentParadasCount,
  allParadas,
  onSave,
  usuarioId,
  motoristaId,
}: UseAddStopFormParams) {
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
  const [warning, setWarning] = useState<string | null>(null);

  // Track previous visibility to detect modal opening (false -> true transition)
  const prevVisibleRef = useRef(false);

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
      setWarning(null);
    }
  }, [visible]);

  // Check if can add more stops
  const canAddMoreStops = currentParadasCount < MAX_PARADAS;

  // Coordinates validation
  const hasValidCoordinates = latitude !== null && longitude !== null;

  // Handle address selection from autocomplete
  // Photon já retorna coordenadas diretamente - não precisa de getPlaceDetails!
  const handleAddressSelect = useCallback((address: string, _placeId: string, coordinates?: Coordenadas) => {
    setEndereco(address);
    setError(null);

    // Photon retorna coordenadas diretamente no autocomplete
    if (coordinates) {
      setLatitude(coordinates.latitude);
      setLongitude(coordinates.longitude);
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

      // Get coordinates if not already set (fallback para digitação manual)
      let finalLatitude = latitude;
      let finalLongitude = longitude;

      if (!finalLatitude || !finalLongitude) {
        // Usa Photon (gratuito!) em vez de Google Geocoding API
        const geocoded = await photonService.geocodeAddress(endereco);
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
      let recalcFailed = false;
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
          logger.warn('Recálculo de rota falhou:', recalcResult.error);
          recalcFailed = true;
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

      // Show warning if recalculation failed (but stop was added successfully)
      if (recalcFailed) {
        setWarning('Parada adicionada, mas a otimização da rota falhou. A ordem das paradas pode não estar otimizada.');
      }

      onSave();
    } catch (err) {
      logger.error('Erro ao adicionar parada:', err);
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

  return {
    // Form values
    endereco,
    destinatario,
    telefone,
    observacoes,
    tipo,
    posicaoInsercao,

    // Setters
    setDestinatario,
    setObservacoes,
    setTipo,
    setPosicaoInsercao,

    // Handlers
    handleAddressSelect,
    handleAddressChange,
    handlePhoneChange,
    handleSave,

    // Derived state
    paradasReaisParaSelecao,
    canAddMoreStops,
    hasValidCoordinates,

    // UI state
    isSaving,
    error,
    warning,

    // Constants
    MAX_PARADAS,
  };
}
