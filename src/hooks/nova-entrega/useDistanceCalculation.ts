/**
 * Hook para cálculo de distâncias
 * Calcula distâncias aproximadas (Haversine) e reais (Google Directions API)
 */

import { useState, useCallback, useMemo } from 'react';

import type {
  Parada,
  EnderecoUnidade,
  DistanciaManualReal,
  DistanciaManualAproximada,
  RotaOtimizadaState,
} from '@/components/gestor/nova-entrega/types';
import { googleMapsService } from '@/lib/google';
import { logger } from '@/lib/logger';

import { distanceInMeters } from '../useNovaEntrega.helpers';

// Constante para fator de correção Haversine em áreas urbanas
const HAVERSINE_URBAN_CORRECTION_FACTOR = 1.3;

export interface UseDistanceCalculationReturn {
  distanciaManualReal: DistanciaManualReal | null;
  distanciaManualAproximada: DistanciaManualAproximada | null;
  isCalculandoReal: boolean;
  calcularDistanciaReal: () => Promise<void>;
  resetDistanciaReal: () => void;
}

export interface UseDistanceCalculationOptions {
  paradas: Parada[];
  enderecoUnidade: EnderecoUnidade | null;
  rotaOtimizada: RotaOtimizadaState | null;
  ordemManual: boolean;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export function useDistanceCalculation({
  paradas,
  enderecoUnidade,
  rotaOtimizada,
  ordemManual,
  showToast,
}: UseDistanceCalculationOptions): UseDistanceCalculationReturn {
  const [distanciaManualReal, setDistanciaManualReal] = useState<DistanciaManualReal | null>(null);
  const [isCalculandoReal, setIsCalculandoReal] = useState(false);

  // Calcula distância aproximada usando Haversine
  const calcularDistanciaAproximada = useCallback(() => {
    if (!enderecoUnidade || paradas.length === 0) return 0;

    let distanciaTotal = 0;
    let pontoAnterior = { latitude: enderecoUnidade.latitude, longitude: enderecoUnidade.longitude };

    for (const parada of paradas) {
      if (parada.latitude && parada.longitude) {
        const distancia = distanceInMeters(parada, pontoAnterior);
        if (distancia !== Number.POSITIVE_INFINITY) {
          distanciaTotal += distancia;
        }
        pontoAnterior = { latitude: parada.latitude, longitude: parada.longitude };
      }
    }

    const distanciaRetorno = distanceInMeters(
      { latitude: enderecoUnidade.latitude, longitude: enderecoUnidade.longitude },
      pontoAnterior
    );
    if (distanciaRetorno !== Number.POSITIVE_INFINITY) {
      distanciaTotal += distanciaRetorno;
    }

    return distanciaTotal;
  }, [enderecoUnidade, paradas]);

  // Computed: distância aproximada com correção urbana
  const distanciaManualAproximada = useMemo((): DistanciaManualAproximada | null => {
    if (!ordemManual || !rotaOtimizada) return null;
    const distanciaMetros = calcularDistanciaAproximada();
    const distanciaCorrigida = distanciaMetros * HAVERSINE_URBAN_CORRECTION_FACTOR;
    const distanciaBase = rotaOtimizada.distancia_total_metros;
    // Evita divisão por zero
    const percentual = distanciaBase > 0
      ? ((distanciaCorrigida - distanciaBase) / distanciaBase) * 100
      : 0;
    return {
      metros: distanciaCorrigida,
      diferenca: distanciaCorrigida - distanciaBase,
      percentual,
    };
  }, [ordemManual, rotaOtimizada, calcularDistanciaAproximada]);

  // Calcula distância real via Google Directions API
  const calcularDistanciaReal = useCallback(async () => {
    if (!enderecoUnidade || paradas.length === 0) return;

    setIsCalculandoReal(true);
    try {
      const pontoUnidade = {
        latitude: enderecoUnidade.latitude,
        longitude: enderecoUnidade.longitude,
      };

      const waypoints = paradas
        .filter((p): p is Parada & { latitude: number; longitude: number } =>
          p.latitude != null && p.longitude != null
        )
        .map((p) => ({
          latitude: p.latitude,
          longitude: p.longitude,
        }));

      const resultado = await googleMapsService.getDirections(
        pontoUnidade,
        pontoUnidade,
        waypoints,
        false
      );

      if (resultado) {
        setDistanciaManualReal({
          metros: resultado.distancia_total_metros,
          segundos: resultado.duracao_total_segundos,
        });
        showToast('Distância real calculada!', 'success');
      } else {
        showToast('Não foi possível calcular a distância real', 'error');
      }
    } catch (error) {
      logger.error('[useDistanceCalculation] Erro ao calcular distância real', error);
      showToast('Erro ao calcular distância', 'error');
    } finally {
      setIsCalculandoReal(false);
    }
  }, [enderecoUnidade, paradas, showToast]);

  const resetDistanciaReal = useCallback(() => {
    setDistanciaManualReal(null);
  }, []);

  return {
    distanciaManualReal,
    distanciaManualAproximada,
    isCalculandoReal,
    calcularDistanciaReal,
    resetDistanciaReal,
  };
}
