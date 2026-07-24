/**
 * Hook para cálculo de distâncias
 * Calcula distância real via OSRM com auto-cálculo debounced
 */

import { useState, useCallback, useEffect, useRef } from 'react';

import type {
  Parada,
  EnderecoUnidade,
  DistanciaManualReal,
  RotaOtimizadaState,
} from '@/components/gestor/nova-entrega/types';
import { googleMapsService } from '@/lib/google';
import { logger } from '@/lib/logger';

// Delay do debounce em ms (aguarda usuário terminar de reordenar)
const DEBOUNCE_DELAY_MS = 1000;

export interface UseDistanceCalculationReturn {
  distanciaManualReal: DistanciaManualReal | null;
  isCalculandoReal: boolean;
  calculationError: string | null;
  resetDistanciaReal: () => void;
}

export interface UseDistanceCalculationOptions {
  paradas: Parada[];
  enderecoUnidade: EnderecoUnidade | null;
  rotaOtimizada: RotaOtimizadaState | null;
  ordemManual: boolean;
}

export function useDistanceCalculation({
  paradas,
  enderecoUnidade,
  rotaOtimizada,
  ordemManual,
}: UseDistanceCalculationOptions): UseDistanceCalculationReturn {
  const [distanciaManualReal, setDistanciaManualReal] =
    useState<DistanciaManualReal | null>(null);
  const [isCalculandoReal, setIsCalculandoReal] = useState(false);
  const [calculationError, setCalculationError] = useState<string | null>(null);

  // Ref para controle do debounce
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref para cancelar requisições obsoletas
  const requestIdRef = useRef(0);

  // Calcula distância real via OSRM
  const calcularDistanciaReal = useCallback(
    async (requestId: number) => {
      if (!enderecoUnidade || paradas.length === 0) return;

      try {
        const pontoUnidade = {
          latitude: enderecoUnidade.latitude,
          longitude: enderecoUnidade.longitude,
        };

        const waypoints = paradas
          .filter(
            (p): p is Parada & { latitude: number; longitude: number } =>
              p.latitude != null && p.longitude != null,
          )
          .map((p) => ({
            latitude: p.latitude,
            longitude: p.longitude,
          }));

        const resultado = await googleMapsService.getDirections(
          pontoUnidade,
          pontoUnidade,
          waypoints,
          false, // Não otimizar - manter ordem manual
        );

        // Verificar se esta requisição ainda é válida
        if (requestId !== requestIdRef.current) {
          return; // Requisição obsoleta, ignorar resultado
        }

        if (resultado) {
          setDistanciaManualReal({
            metros: resultado.distancia_total_metros,
            segundos: resultado.duracao_total_segundos,
            isEstimated: resultado.is_estimated === true,
            polyline: resultado.polyline,
          });
          setCalculationError(null);
        } else {
          setDistanciaManualReal(null);
          setCalculationError(
            'Não foi possível calcular o percurso viário. Tente novamente.',
          );
        }
      } catch (error) {
        // Verificar se esta requisição ainda é válida
        if (requestId !== requestIdRef.current) {
          return;
        }
        logger.error(
          '[useDistanceCalculation] Erro ao calcular distância real',
          error,
        );
        setDistanciaManualReal(null);
        setCalculationError(
          'Não foi possível calcular o percurso viário. Tente novamente.',
        );
      } finally {
        // Só atualiza loading se a requisição ainda for válida
        if (requestId === requestIdRef.current) {
          setIsCalculandoReal(false);
        }
      }
    },
    [enderecoUnidade, paradas],
  );

  // Auto-cálculo com debounce quando ordem manual é ativada ou paradas mudam
  useEffect(() => {
    // Limpar timer anterior
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    requestIdRef.current += 1;
    const currentRequestId = requestIdRef.current;

    // Uma rota otimizada e não alterada já possui métricas confirmadas.
    if (rotaOtimizada && !ordemManual) {
      setIsCalculandoReal(false);
      setCalculationError(null);
      return;
    }

    if (!enderecoUnidade || paradas.length === 0) {
      setIsCalculandoReal(false);
      setCalculationError(null);
      return;
    }

    // Incrementar ID da requisição para invalidar requisições anteriores
    setIsCalculandoReal(true);
    setCalculationError(null);

    // Iniciar debounce
    debounceTimerRef.current = setTimeout(() => {
      calcularDistanciaReal(currentRequestId);
    }, DEBOUNCE_DELAY_MS);

    // Cleanup
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [
    ordemManual,
    rotaOtimizada,
    enderecoUnidade,
    paradas,
    calcularDistanciaReal,
  ]);

  const resetDistanciaReal = useCallback(() => {
    // Cancelar requisições pendentes
    requestIdRef.current += 1;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    setDistanciaManualReal(null);
    setIsCalculandoReal(false);
    setCalculationError(null);
  }, []);

  return {
    distanciaManualReal,
    isCalculandoReal,
    calculationError,
    resetDistanciaReal,
  };
}
