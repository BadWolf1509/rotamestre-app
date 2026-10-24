/**
 * useAddStopForm - Hook para gerenciamento do formulário de adicionar parada
 *
 * Encapsula:
 * - Formulário (react-hook-form + Zod: `paradaModalSchema`)
 * - Lógica de reset ao abrir modal
 * - Erro cruzado do endereço (a causa é lat/long, a mensagem mora em endereço)
 * - Lógica de salvamento com geocoding, RPC, recálculo e notificação
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';

import { marcarOtimizacaoAlterada } from '@/lib/gestor/otimizacaoRota';
import { logger } from '@/lib/logger';
import { maskPhone } from '@/lib/phone';
import { photonService } from '@/lib/photon';
import { MAX_ROUTE_STOPS } from '@/lib/routeOptimization';
import {
  recalcularRota,
  notificarMotoristaRotaEditada,
} from '@/lib/routeUtils';
import {
  paradaModalSchema,
  type ParadaModalFormData,
} from '@/lib/schemas/parada';
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
  onSave: (result: { routeRecalculationFailed: boolean }) => void;
  usuarioId?: string;
  motoristaId?: string | null;
}

type ParadaDeRota = {
  id: string;
  ordem: number;
  latitude: number | null;
  longitude: number | null;
  is_checkpoint?: boolean;
};

/**
 * Paradas da rota como o banco as deixou depois do `inserir_parada`.
 *
 * A RPC devolve só o id e a ordem da nova parada, não a lista. Reler é a fonte
 * de verdade (também pega mudança feita por outro cliente). Se a leitura
 * falhar, projeta a mesma regra da RPC: as reais a partir da ordem inserida
 * sobem uma casa. Sem isso o recálculo ficaria sem lista, e a rota, com a
 * geometria já invalidada.
 */
async function paradasAposInsercao({
  rotaId,
  antes,
  nova,
}: {
  rotaId: string;
  antes: Parada[];
  nova: ParadaDeRota;
}): Promise<ParadaDeRota[]> {
  try {
    const { data, error } = await supabase
      .from('paradas')
      .select('id, ordem, latitude, longitude, is_checkpoint')
      .eq('rota_id', rotaId)
      .returns<ParadaDeRota[]>();
    if (error) throw error;
    if (data?.some((p) => p.id === nova.id)) return data;
  } catch (err) {
    logger.warn('Releitura das paradas falhou; projetando a ordem nova', err);
  }

  const deslocadas = antes.map((p) =>
    p.is_checkpoint !== false && p.ordem >= nova.ordem
      ? { ...p, ordem: p.ordem + 1 }
      : p,
  );
  return [...deslocadas, nova];
}

// Fonte única do limite: o mesmo da Nova Entrega (OSRM próprio). O 23 antigo
// era da Google Directions, já removida.
const MAX_PARADAS = MAX_ROUTE_STOPS;

const VALORES_INICIAIS: ParadaModalFormData = {
  endereco: '',
  tipo: 'entrega',
  destinatario: '',
  telefone: '',
  observacoes: '',
  latitude: undefined,
  longitude: undefined,
};

const MENSAGEM_SEM_COORDENADAS =
  'Não foi possível encontrar as coordenadas do endereço';

function coordenadaValida(valor: number | undefined): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor);
}

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
  const form = useForm<ParadaModalFormData>({
    resolver: zodResolver(paradaModalSchema),
    defaultValues: VALORES_INICIAIS,
  });
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    setError: setFieldError,
    clearErrors,
    watch,
    formState: { errors, isSubmitted },
  } = form;

  // Position selection state
  // null = insert at end (default behavior)
  // number = insert AT this position (before the stop currently at this ordem)
  const [posicaoInsercao, setPosicaoInsercao] = useState<number | null>(null);

  // UI state (erro geral: limite, falha do servidor; os de campo vêm do Zod)
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
        .filter(
          (p) =>
            p.is_checkpoint !== false &&
            p.status !== 'concluida' &&
            p.status !== 'pulada',
        )
        .sort((a, b) => a.ordem - b.ordem),
    [allParadas],
  );

  // Reset form only when modal OPENS (transition from false to true)
  useEffect(() => {
    const wasVisible = prevVisibleRef.current;
    prevVisibleRef.current = visible;

    // Only reset when modal opens (false -> true), not on every render
    if (visible && !wasVisible) {
      reset(VALORES_INICIAIS);
      // Default to null (insert at end of route)
      setPosicaoInsercao(null);
      setError(null);
      setWarning(null);
    }
  }, [visible, reset]);

  // Check if can add more stops
  const canAddMoreStops = currentParadasCount < MAX_PARADAS;

  // Coordinates validation
  const latitude = watch('latitude');
  const longitude = watch('longitude');
  const hasValidCoordinates =
    coordenadaValida(latitude) && coordenadaValida(longitude);

  // Handle address selection from autocomplete
  // Photon já retorna coordenadas diretamente - não precisa de getPlaceDetails!
  const handleAddressSelect = useCallback(
    (address: string, _placeId: string, coordinates?: Coordenadas) => {
      setValue('endereco', address);
      setValue('latitude', coordinates?.latitude);
      setValue('longitude', coordinates?.longitude);
      setError(null);
      // Erro cruzado: a mensagem mora em `endereco` ("não achei as coordenadas"),
      // mas a causa era lat/long, que acabaram de chegar. `setValue` não
      // revalida e a revalidação assíncrona perde a corrida: o erro ficaria
      // preso ao lado do selo "Validado". Limpar explicitamente é o caminho
      // determinístico (ver FormularioParada).
      if (coordinates) {
        clearErrors('endereco');
      }
    },
    [setValue, clearErrors],
  );

  // Handle address text change
  const handleAddressChange = useCallback(
    (text: string) => {
      setValue('endereco', text, { shouldValidate: isSubmitted });
      setError(null);
      // Clear coordinates when manually typing
      setValue('latitude', undefined);
      setValue('longitude', undefined);
    },
    [setValue, isSubmitted],
  );

  // Handle phone formatting
  const handlePhoneChange = useCallback(
    (text: string) => {
      setValue('telefone', maskPhone(text), { shouldValidate: isSubmitted });
    },
    [setValue, isSubmitted],
  );

  // Save new stop using atomic RPC
  const salvar = useCallback(
    async (valores: ParadaModalFormData) => {
      if (!rotaId) return;
      if (!canAddMoreStops) {
        setError(`Limite de ${MAX_PARADAS} paradas atingido`);
        return;
      }

      const { endereco, tipo } = valores;
      const destinatario = valores.destinatario ?? '';
      const telefone = valores.telefone ?? '';
      const observacoes = valores.observacoes ?? '';

      try {
        setIsSaving(true);
        setError(null);

        // Get coordinates if not already set (fallback para digitação manual)
        let finalLatitude = valores.latitude;
        let finalLongitude = valores.longitude;

        if (
          !coordenadaValida(finalLatitude) ||
          !coordenadaValida(finalLongitude)
        ) {
          // Usa Photon (gratuito!) em vez de Google Geocoding API
          const geocoded = await photonService.geocodeAddress(endereco);
          if (geocoded?.coordenadas) {
            finalLatitude = geocoded.coordenadas.latitude;
            finalLongitude = geocoded.coordenadas.longitude;
          } else {
            setFieldError('endereco', {
              type: 'custom',
              message: MENSAGEM_SEM_COORDENADAS,
            });
            return;
          }
        }

        // Use atomic RPC to insert parada (handles order adjustments in single transaction)
        const { data: rpcResult, error: rpcError } = await supabase.rpc(
          'inserir_parada',
          {
            p_rota_id: rotaId,
            p_tipo: tipo,
            p_endereco: endereco,
            p_latitude: finalLatitude,
            p_longitude: finalLongitude,
            p_posicao_insercao: posicaoInsercao,
            p_destinatario: destinatario || null,
            p_telefone: telefone || null,
            p_observacoes: observacoes || null,
          },
        );

        if (rpcError) {
          throw rpcError;
        }

        if (!rpcResult?.success) {
          throw new Error(
            rpcResult?.error || 'Erro desconhecido ao inserir parada',
          );
        }

        const newParadaId = rpcResult.parada_id;
        const newStopOrdem = rpcResult.ordem;

        // Inserir à mão desfaz a otimização, como reordenar. Antes do recálculo:
        // a ordem já mudou no banco, mesmo que o trajeto falhe depois.
        await marcarOtimizacaoAlterada(rotaId);

        // Recalcula com a ordem de DEPOIS da RPC. A lista da tela é de antes dela:
        // a RPC empurra uma casa as paradas a partir da posição inserida, e usar
        // a lista antiga montava o trajeto na ordem errada.
        const updatedParadas = await paradasAposInsercao({
          rotaId,
          antes: allParadas,
          nova: {
            id: newParadaId,
            ordem: newStopOrdem,
            latitude: finalLatitude,
            longitude: finalLongitude,
            is_checkpoint: true,
          },
        });

        const recalcResult = await recalcularRota(
          rotaId,
          updatedParadas,
          enderecoUnidade,
        );
        const recalcFailed = !recalcResult.success;
        if (recalcFailed) {
          logger.warn('Recálculo de rota falhou:', recalcResult.error);
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
              posicao_insercao:
                posicaoInsercao === null
                  ? 'final'
                  : `posicao_${posicaoInsercao}`,
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
          setWarning(
            'Parada adicionada, mas a otimização da rota falhou. A ordem das paradas pode não estar otimizada.',
          );
        }

        onSave({ routeRecalculationFailed: recalcFailed });
      } catch (err) {
        logger.error('Erro ao adicionar parada:', err);
        setError('Erro ao adicionar parada. Tente novamente.');
      } finally {
        setIsSaving(false);
      }
    },
    [
      rotaId,
      canAddMoreStops,
      setFieldError,
      posicaoInsercao,
      allParadas,
      enderecoUnidade,
      usuarioId,
      motoristaId,
      onSave,
    ],
  );

  const handleSave = useCallback(
    () => handleSubmit(salvar)(),
    [handleSubmit, salvar],
  );

  return {
    // Formulário (Controller nos modais)
    form,
    control,
    errors,
    posicaoInsercao,

    // Setters
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
