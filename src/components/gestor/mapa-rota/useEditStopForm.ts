/**
 * useEditStopForm - Hook para gerenciamento do formulário de editar parada
 *
 * Encapsula:
 * - Formulário (react-hook-form + Zod: `paradaModalSchema`)
 * - Inicialização com dados da parada
 * - Detecção de mudança de endereço (para feedback visual)
 * - Confirmação ao trocar o tipo quando isso solta um vínculo retirada -> entrega
 * - Lógica de salvamento com geocoding, update e notificação
 * - Recálculo de rota apenas se coordenadas realmente mudaram
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { getErrorMessage } from '@/lib/errorMapping';
import { marcarOtimizacaoAlterada } from '@/lib/gestor/otimizacaoRota';
import { STATUS_PARADA_ALTERAVEL } from '@/lib/gestor/paradaEditavel';
import {
  avisoPerdaDeVinculoAoEditarTipo,
  entregasQueDependemDe,
} from '@/lib/gestor/vinculoParada';
import { logger } from '@/lib/logger';
import { maskPhone } from '@/lib/phone';
import { photonService } from '@/lib/photon';
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

export interface UseEditStopFormParams {
  visible: boolean;
  parada: Parada | null;
  rotaId: string;
  enderecoUnidade: EnderecoUnidade | null;
  allParadas: Parada[];
  onSave: (result: { routeRecalculationFailed: boolean }) => void;
  /** O banco mostrou que a tela estava velha (parada já finalizada): recarregue. */
  onDesatualizada?: () => void;
  usuarioId?: string;
  motoristaId?: string | null;
}

const MENSAGEM_SEM_COORDENADAS =
  'Não foi possível encontrar as coordenadas do endereço';

const VALORES_VAZIOS: ParadaModalFormData = {
  endereco: '',
  tipo: 'entrega',
  destinatario: '',
  telefone: '',
  observacoes: '',
  latitude: undefined,
  longitude: undefined,
};

function valoresDaParada(parada: Parada | null): ParadaModalFormData {
  if (!parada) return VALORES_VAZIOS;
  return {
    endereco: parada.endereco || '',
    tipo: parada.tipo,
    destinatario: parada.destinatario || '',
    telefone: parada.telefone || '',
    observacoes: parada.observacoes || '',
    latitude: parada.latitude ?? undefined,
    longitude: parada.longitude ?? undefined,
  };
}

function coordenadaValida(valor: number | undefined): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor);
}

export function useEditStopForm({
  visible,
  parada,
  rotaId,
  enderecoUnidade,
  allParadas,
  onSave,
  onDesatualizada,
  usuarioId,
  motoristaId,
}: UseEditStopFormParams) {
  const form = useForm<ParadaModalFormData>({
    resolver: zodResolver(paradaModalSchema),
    defaultValues: valoresDaParada(parada),
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

  // UI state (erro geral: parada finalizada, falha do servidor; os de campo
  // vêm do Zod)
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Trocar o tipo desfaz vínculo retirada -> entrega: o gestor confirma antes.
  const [confirmacaoVinculo, setConfirmacaoVinculo] = useState<string | null>(
    null,
  );

  // Initialize form with parada data when modal opens
  useEffect(() => {
    if (visible && parada) {
      reset(valoresDaParada(parada));
      setError(null);
      setConfirmacaoVinculo(null);
    }
  }, [visible, parada, reset]);

  const endereco = watch('endereco');
  const latitude = watch('latitude');
  const longitude = watch('longitude');
  const destinatario = watch('destinatario');
  const telefone = watch('telefone');
  const observacoes = watch('observacoes');

  // Check if form has details filled
  const hasDetails = !!(destinatario || telefone || observacoes);

  // Check if coordinates changed (for UI feedback - shows recalculation warning)
  const coordinatesChanged = parada
    ? (latitude ?? null) !== parada.latitude ||
      (longitude ?? null) !== parada.longitude
    : false;

  // Handle address selection from autocomplete
  // Photon já retorna coordenadas diretamente - não precisa de getPlaceDetails!
  const handleAddressSelect = useCallback(
    (address: string, _placeId: string, coordinates?: Coordenadas) => {
      setValue('endereco', address);
      setValue('latitude', coordinates?.latitude);
      setValue('longitude', coordinates?.longitude);
      setError(null);
      // Erro cruzado: a mensagem mora em `endereco` ("não achei as
      // coordenadas"), mas a causa era lat/long, que acabaram de chegar.
      // `setValue` não revalida e a revalidação assíncrona perde a corrida:
      // sem isto o erro ficaria preso ao lado do selo de endereço válido.
      if (coordinates) {
        clearErrors('endereco');
      }
    },
    [setValue, clearErrors],
  );

  // Handle address text change (manual typing). Outro texto invalida as
  // coordenadas (senão o endereço novo seria gravado com o ponto do antigo); o
  // salvar geocodifica. Voltar ao texto original restaura o ponto original.
  const handleAddressChange = useCallback(
    (text: string) => {
      setValue('endereco', text, { shouldValidate: isSubmitted });
      setError(null);
      if (parada && text === parada.endereco) {
        setValue('latitude', parada.latitude ?? undefined);
        setValue('longitude', parada.longitude ?? undefined);
      } else {
        setValue('latitude', undefined);
        setValue('longitude', undefined);
      }
    },
    [setValue, isSubmitted, parada],
  );

  // Handle phone formatting
  const handlePhoneChange = useCallback(
    (text: string) => {
      setValue('telefone', maskPhone(text), { shouldValidate: isSubmitted });
    },
    [setValue, isSubmitted],
  );

  // Save changes
  const salvar = useCallback(
    async (valores: ParadaModalFormData, vinculoConfirmado: boolean) => {
      if (!parada || !rotaId) return;

      const { endereco: enderecoNovo, tipo } = valores;
      const destinatarioNovo = valores.destinatario ?? '';
      const telefoneNovo = valores.telefone ?? '';
      const observacoesNovas = valores.observacoes ?? '';

      // Trocar o tipo solta o vínculo (da retirada para as entregas dela, ou da
      // entrega para a retirada). O banco não avisa: pede confirmação antes.
      const avisoVinculo = avisoPerdaDeVinculoAoEditarTipo(
        allParadas,
        parada,
        tipo,
      );
      if (avisoVinculo && !vinculoConfirmado) {
        setConfirmacaoVinculo(avisoVinculo);
        return;
      }
      const soltarProprioVinculo =
        tipo === 'retirada' && !!parada.vinculo_parada_id;
      const dependentes =
        parada.tipo === 'retirada' && tipo === 'entrega'
          ? entregasQueDependemDe(allParadas, parada.id)
          : [];

      try {
        setIsSaving(true);
        setError(null);

        // Endereço trocado sem coordenadas (digitado, sem escolher sugestão):
        // geocodifica. Endereço igual ao original mantém o ponto que a parada
        // já tem, mesmo que seja nulo.
        let finalLatitude = valores.latitude;
        let finalLongitude = valores.longitude;

        if (
          enderecoNovo !== parada.endereco &&
          (!coordenadaValida(finalLatitude) ||
            !coordenadaValida(finalLongitude))
        ) {
          // Usa Photon (gratuito!) em vez de Google Geocoding API
          const geocoded = await photonService.geocodeAddress(enderecoNovo);
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

        // Check if coordinates actually changed (more accurate than text comparison)
        const coordinatesChanged =
          (finalLatitude ?? null) !== parada.latitude ||
          (finalLongitude ?? null) !== parada.longitude;

        // Update parada in database. Condicionado a `pendente` e conferindo as
        // linhas afetadas: a tela pode estar velha (o motorista concluiu a
        // parada), e UPDATE de zero linhas não é sucesso. A trava de verdade é o
        // gatilho da Migration 53 (PARADA_CONCLUIDA_IMUTAVEL), que vale para
        // qualquer cliente.
        const { data: atualizadas, error: updateError } = await supabase
          .from('paradas')
          .update({
            endereco: enderecoNovo,
            latitude: finalLatitude ?? null,
            longitude: finalLongitude ?? null,
            destinatario: destinatarioNovo || null,
            telefone: telefoneNovo || null,
            observacoes: observacoesNovas || null,
            tipo,
            ...(soltarProprioVinculo ? { vinculo_parada_id: null } : {}),
          })
          .eq('id', parada.id)
          .eq('status', STATUS_PARADA_ALTERAVEL)
          .select('id');

        if (updateError) {
          const conhecido = getErrorMessage(updateError);
          if (
            conhecido.code === 'STOP_COMPLETED_LOCKED' ||
            conhecido.code === 'STOP_ALREADY_DONE'
          ) {
            setError(conhecido.message);
            onDesatualizada?.();
            return;
          }
          throw updateError;
        }

        if (!atualizadas || atualizadas.length === 0) {
          setError(
            'Esta parada não pode mais ser editada: o motorista já a iniciou ou finalizou, ou ela não existe mais. A tela foi atualizada.',
          );
          onDesatualizada?.();
          return;
        }

        // A retirada virou entrega: as entregas que dependiam dela perdem o
        // vínculo (confirmado acima). Falha aqui não desfaz a edição, mas fica
        // no log: o vínculo ficaria apontando para uma entrega.
        if (dependentes.length > 0) {
          const { error: vinculoError } = await supabase
            .from('paradas')
            .update({ vinculo_parada_id: null })
            .in(
              'id',
              dependentes.map((d) => d.id),
            );
          if (vinculoError) {
            logger.error(
              'Falha ao soltar o vínculo das entregas',
              vinculoError,
            );
          }
        }

        // Mudar o local ou o tipo desfaz a otimização, como reordenar. Só
        // destinatário, telefone ou observações não mexem no trajeto.
        if (coordinatesChanged || tipo !== parada.tipo) {
          await marcarOtimizacaoAlterada(rotaId);
        }

        // Only recalculate route if coordinates ACTUALLY changed
        let recalcFailed = false;
        if (coordinatesChanged) {
          const updatedParadas = allParadas.map((p) =>
            p.id === parada.id
              ? {
                  ...p,
                  latitude: finalLatitude ?? null,
                  longitude: finalLongitude ?? null,
                }
              : p,
          );

          const recalcResult = await recalcularRota(
            rotaId,
            updatedParadas,
            enderecoUnidade,
          );
          recalcFailed = !recalcResult.success;
          if (recalcFailed) {
            logger.warn(
              'Recálculo de rota falhou após editar parada:',
              recalcResult.error,
            );
          }
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
                endereco: enderecoNovo !== parada.endereco,
                destinatario: destinatarioNovo !== parada.destinatario,
                telefone: telefoneNovo !== parada.telefone,
                observacoes: observacoesNovas !== parada.observacoes,
                tipo: tipo !== parada.tipo,
              },
              coordenadas_alteradas: coordinatesChanged,
            },
          });
        }

        // Notify motorista about the edit (if assigned)
        if (motoristaId) {
          const camposEditados: string[] = [];
          if (enderecoNovo !== parada.endereco) camposEditados.push('endereço');
          if (destinatarioNovo !== parada.destinatario)
            camposEditados.push('destinatário');
          if (telefoneNovo !== parada.telefone) camposEditados.push('telefone');
          if (tipo !== parada.tipo) camposEditados.push('tipo');

          const mensagem =
            camposEditados.length > 0
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

        onSave({ routeRecalculationFailed: recalcFailed });
      } catch (err) {
        logger.error('Erro ao salvar parada:', err);
        setError('Erro ao salvar parada. Tente novamente.');
      } finally {
        setIsSaving(false);
      }
    },
    [
      parada,
      rotaId,
      setFieldError,
      enderecoUnidade,
      allParadas,
      usuarioId,
      motoristaId,
      onSave,
      onDesatualizada,
    ],
  );

  const handleSave = useCallback(
    () => handleSubmit((valores) => salvar(valores, false))(),
    [handleSubmit, salvar],
  );

  const confirmarSalvarComVinculo = useCallback(() => {
    setConfirmacaoVinculo(null);
    return handleSubmit((valores) => salvar(valores, true))();
  }, [handleSubmit, salvar]);

  const cancelarConfirmacaoVinculo = useCallback(() => {
    setConfirmacaoVinculo(null);
  }, []);

  return {
    // Formulário (Controller nos modais)
    form,
    control,
    errors,
    endereco,

    // Handlers
    handleAddressSelect,
    handleAddressChange,
    handlePhoneChange,
    handleSave,
    confirmarSalvarComVinculo,
    cancelarConfirmacaoVinculo,

    // Derived state
    coordinatesChanged,
    hasDetails,

    // UI state
    isSaving,
    error,
    confirmacaoVinculo,
  };
}
