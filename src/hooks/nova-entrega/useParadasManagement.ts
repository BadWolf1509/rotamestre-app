/**
 * Hook para gerenciar lista de paradas
 * Adicionar, remover e reordenar paradas
 */

import { useState, useCallback, useMemo } from 'react';

import type {
  Parada,
  ParadaFormData,
  ParadaFormDataWithCoords,
  ParadasStatus,
  RotaOtimizadaState,
} from '@/components/gestor/nova-entrega/types';
import { googleMapsService } from '@/lib/google';
import { logger } from '@/lib/logger';
import { MAX_WAYPOINTS, WAYPOINTS_RECOMENDADO } from '@/lib/routeOptimization';

import { generateUniqueId } from '../useNovaEntrega.helpers';

import type React from 'react';

export interface UseParadasManagementReturn {
  paradas: Parada[];
  setParadas: React.Dispatch<React.SetStateAction<Parada[]>>;
  retiradasDisponiveis: Parada[];
  paradasStatus: ParadasStatus;
  isLoading: boolean;
  onAddParada: (data: ParadaFormData, vinculoId?: string) => Promise<void>;
  removeParada: (index: number) => void;
  moveParadaUp: (index: number) => void;
  moveParadaDown: (index: number) => void;
  clearParadas: () => void;
}

export interface UseParadasManagementOptions {
  rotaOtimizada: RotaOtimizadaState | null;
  onOrdemManualChange: (manual: boolean) => void;
  onRotaOtimizadaReset: () => void;
  onDistanciaManualRealReset: () => void;
  showToast: (message: string, type: 'success' | 'error' | 'info', duration?: number) => void;
  onFormReset: () => void;
}

export function useParadasManagement({
  rotaOtimizada,
  onOrdemManualChange,
  onRotaOtimizadaReset,
  onDistanciaManualRealReset,
  showToast,
  onFormReset,
}: UseParadasManagementOptions): UseParadasManagementReturn {
  const [paradas, setParadas] = useState<Parada[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Computed: retiradas disponíveis para vincular
  const retiradasDisponiveis = useMemo(
    () => paradas.filter((p) => p.tipo === 'retirada'),
    [paradas]
  );

  // Computed: status das paradas
  const paradasStatus = useMemo((): ParadasStatus => {
    const count = paradas.length;

    if (count > MAX_WAYPOINTS) {
      return {
        texto: `${count} paradas (excede limite de ${MAX_WAYPOINTS})`,
        cor: 'error',
        icone: 'warning',
      };
    } else if (count > WAYPOINTS_RECOMENDADO) {
      return {
        texto: `${count}/${MAX_WAYPOINTS} paradas (próximo do limite)`,
        cor: 'warning',
        icone: 'alert-circle',
      };
    } else if (count > 0) {
      return {
        texto: `${count} parada(s) na lista`,
        cor: 'default',
        icone: null,
      };
    }
    return {
      texto: 'Nenhuma parada adicionada',
      cor: 'default',
      icone: null,
    };
  }, [paradas.length]);

  const onAddParada = useCallback(async (paradaData: ParadaFormData, vinculoId?: string) => {
    setIsLoading(true);
    try {
      const extendedData = paradaData as ParadaFormDataWithCoords;

      if (!extendedData.latitude || !extendedData.longitude) {
        const result = await googleMapsService.geocodeAddress(paradaData.endereco);

        if (!result) {
          showToast('Não foi possível localizar o endereço. Use o autocomplete para selecionar um endereço válido.', 'error');
          return;
        }

        extendedData.latitude = result.coordenadas.latitude;
        extendedData.longitude = result.coordenadas.longitude;
      }

      const novaParada: Parada = {
        ...extendedData,
        id: generateUniqueId(),
        latitude: extendedData.latitude,
        longitude: extendedData.longitude,
        ordem: paradas.length + 1,
        vinculo_parada_id: vinculoId,
      };

      setParadas((prev) => [...prev, novaParada]);
      onFormReset();

      if (vinculoId) {
        const retiradaVinculada = paradas.find((p) => p.id === vinculoId);
        showToast(
          `Entrega vinculada! A retirada em "${retiradaVinculada?.destinatario || 'cliente'}" será feita primeiro.`,
          'success',
          4000
        );
      } else {
        showToast('Parada adicionada à lista!', 'success');
      }
    } catch (error) {
      logger.error('[useParadasManagement] Erro ao adicionar parada', error);
      showToast('Não foi possível adicionar a parada', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [onFormReset, paradas, showToast]);

  const removeParada = useCallback((index: number) => {
    const paradaRemovida = paradas[index];
    let novasParadas = paradas.filter((_, i) => i !== index);

    // Se removeu uma retirada, desvincular entregas associadas
    if (paradaRemovida.tipo === 'retirada') {
      novasParadas = novasParadas.map((p) => {
        if (p.vinculo_parada_id === paradaRemovida.id) {
          return { ...p, vinculo_parada_id: undefined };
        }
        return p;
      });
    }

    const reordenadas = novasParadas.map((p, i) => ({ ...p, ordem: i + 1 }));
    setParadas(reordenadas);
    onRotaOtimizadaReset();
  }, [onRotaOtimizadaReset, paradas]);

  const moveParadaUp = useCallback((index: number) => {
    if (index <= 0) return;

    const novasParadas = [...paradas];
    [novasParadas[index - 1], novasParadas[index]] = [novasParadas[index], novasParadas[index - 1]];

    const reordenadas = novasParadas.map((p, i) => ({ ...p, ordem: i + 1 }));
    setParadas(reordenadas);

    if (rotaOtimizada) {
      onOrdemManualChange(true);
      onDistanciaManualRealReset();
    }
  }, [onDistanciaManualRealReset, onOrdemManualChange, paradas, rotaOtimizada]);

  const moveParadaDown = useCallback((index: number) => {
    if (index >= paradas.length - 1) return;

    const novasParadas = [...paradas];
    [novasParadas[index], novasParadas[index + 1]] = [novasParadas[index + 1], novasParadas[index]];

    const reordenadas = novasParadas.map((p, i) => ({ ...p, ordem: i + 1 }));
    setParadas(reordenadas);

    if (rotaOtimizada) {
      onOrdemManualChange(true);
      onDistanciaManualRealReset();
    }
  }, [onDistanciaManualRealReset, onOrdemManualChange, paradas, rotaOtimizada]);

  const clearParadas = useCallback(() => {
    setParadas([]);
  }, []);

  return {
    paradas,
    setParadas,
    retiradasDisponiveis,
    paradasStatus,
    isLoading,
    onAddParada,
    removeParada,
    moveParadaUp,
    moveParadaDown,
    clearParadas,
  };
}
