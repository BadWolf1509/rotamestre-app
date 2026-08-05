import { useCallback, useRef } from 'react';

import type {
  DistanciaManualReal,
  EnderecoUnidade,
  Parada,
  RotaOtimizadaState,
} from '@/components/gestor/nova-entrega/types';
import { googleMapsService } from '@/lib/google';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import type { OtimizacaoEstado } from '@/types/rota';

import {
  generateRequestId,
  prepararParadasParaInserir,
  validarRascunhoRota,
} from '../useNovaEntrega.helpers';

export interface UseRouteCreationReturn {
  gerarRota: () => Promise<boolean>;
}

export interface UseRouteCreationOptions {
  paradas: Parada[];
  enderecoUnidade: EnderecoUnidade | null;
  rotaOtimizada: RotaOtimizadaState | null;
  distanciaManualReal: DistanciaManualReal | null;
  ordemManual: boolean;
  motoristaSelecionado: string;
  unidadeAtiva: string | null;
  unidadeNome: string;
  dataRota: string;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  showToast: (
    message: string,
    type: 'success' | 'error' | 'info',
    duration?: number,
  ) => void;
  onSuccess: (rotaId: string) => void;
}

interface AtomicRouteResult {
  success: boolean;
  rota_id?: string;
  reused?: boolean;
}

interface DadosRotaCalculados {
  distanciaKm: number | null;
  tempoMin: number | null;
  polyline?: string;
  isEstimated: boolean;
  /**
   * Distância (km) da ordem em que as paradas estavam ANTES da otimização.
   * Só é preenchida quando estes dados vieram de `rotaOtimizada` (fluxo do
   * otimizador). `null` quando a otimização rodou mas a medição do "antes"
   * falhou (ainda assim é uma otimização); ausente/`undefined` quando não
   * houve otimização nenhuma. Não colapsar os dois casos.
   */
  distanciaAntesKm?: number | null;
}

export function useRouteCreation({
  paradas,
  enderecoUnidade,
  rotaOtimizada,
  distanciaManualReal,
  ordemManual,
  motoristaSelecionado,
  unidadeAtiva,
  unidadeNome,
  dataRota,
  isLoading,
  setIsLoading,
  showToast,
  onSuccess,
}: UseRouteCreationOptions): UseRouteCreationReturn {
  const requestIdRef = useRef<string | null>(null);
  const requestSignatureRef = useRef<string | null>(null);

  const calcularDadosRota = useCallback(async () => {
    if (rotaOtimizada && !ordemManual) {
      return {
        distanciaKm: Number(
          (rotaOtimizada.distancia_total_metros / 1000).toFixed(2),
        ),
        tempoMin: Math.round(rotaOtimizada.duracao_total_segundos / 60),
        polyline: rotaOtimizada.polyline,
        isEstimated: rotaOtimizada.isEstimated === true,
        distanciaAntesKm: rotaOtimizada.distanciaAntesKm,
      };
    }

    if (distanciaManualReal) {
      return {
        distanciaKm: Number((distanciaManualReal.metros / 1000).toFixed(2)),
        tempoMin: Math.round(distanciaManualReal.segundos / 60),
        polyline: distanciaManualReal.polyline,
        isEstimated: distanciaManualReal.isEstimated === true,
      };
    }

    if (!enderecoUnidade || paradas.length === 0) {
      return {
        distanciaKm: null,
        tempoMin: null,
        polyline: undefined,
        isEstimated: true,
      };
    }

    const pontoUnidade = {
      latitude: enderecoUnidade.latitude,
      longitude: enderecoUnidade.longitude,
    };
    const waypoints = paradas.map((parada) => ({
      latitude: parada.latitude as number,
      longitude: parada.longitude as number,
    }));
    const resultado = await googleMapsService.getDirections(
      pontoUnidade,
      pontoUnidade,
      waypoints,
      false,
    );

    if (!resultado) {
      return {
        distanciaKm: null,
        tempoMin: null,
        polyline: undefined,
        isEstimated: true,
      };
    }

    return {
      distanciaKm: Number((resultado.distancia_total_metros / 1000).toFixed(2)),
      tempoMin: Math.round(resultado.duracao_total_segundos / 60),
      polyline: resultado.polyline,
      isEstimated: resultado.is_estimated === true,
    };
  }, [
    distanciaManualReal,
    enderecoUnidade,
    ordemManual,
    paradas,
    rotaOtimizada,
  ]);

  const gerarRota = useCallback(async (): Promise<boolean> => {
    const validacao = validarRascunhoRota({
      paradas,
      motoristaId: motoristaSelecionado,
      dataRota,
      enderecoUnidade,
    });
    if (!validacao.valido) {
      showToast(validacao.erros[0], 'error', 5000);
      return false;
    }
    if (!unidadeAtiva || isLoading) return false;

    setIsLoading(true);
    try {
      const routeData: DadosRotaCalculados = await calcularDadosRota();
      if (routeData.isEstimated) {
        showToast(
          'Não foi possível confirmar o percurso viário. Tente calcular a rota novamente antes de criar.',
          'error',
          6000,
        );
        return false;
      }

      // Otimizou e manteve a ordem do otimizador => 'otimizada'.
      // Não otimizou, ou otimizou e depois arrastou => 'manual'.
      // `foiOtimizada` é verdadeiro quando a distância "antes" foi medida
      // (mesmo que null), o que só acontece dentro do fluxo de otimização.
      // Comparação estrita com `undefined`: não colapsar com `??`, pois
      // `null` ("antes" falhou) e `undefined` (sem otimização) têm
      // significados diferentes aqui.
      const foiOtimizada = routeData.distanciaAntesKm !== undefined;
      const otimizacaoEstado: OtimizacaoEstado =
        foiOtimizada && !ordemManual ? 'otimizada' : 'manual';

      const requestSignature = JSON.stringify({
        unidadeAtiva,
        unidadeNome,
        enderecoUnidade,
        motoristaSelecionado,
        dataRota,
        paradas,
        rotaOtimizada,
        ordemManual,
      });
      if (
        !requestIdRef.current ||
        requestSignatureRef.current !== requestSignature
      ) {
        requestIdRef.current = generateRequestId();
        requestSignatureRef.current = requestSignature;
      }
      const requestId = requestIdRef.current;
      const preparedStops = prepararParadasParaInserir({
        rotaId: requestId,
        paradas,
        enderecoUnidade,
        nomeUnidade: unidadeNome,
      });
      const rpcStops = preparedStops.map(
        ({ rota_id: _rotaId, status: _status, ...stop }) => stop,
      );

      const { data, error } = await supabase.rpc('criar_rota_com_paradas', {
        p_request_id: requestId,
        p_unidade_id: unidadeAtiva,
        p_motorista_id: motoristaSelecionado,
        p_data: dataRota,
        p_distancia_total: routeData.distanciaKm,
        p_tempo_total: routeData.tempoMin,
        p_polyline: routeData.polyline ?? null,
        p_paradas: rpcStops,
        p_otimizacao_estado: otimizacaoEstado,
        p_otimizacao_distancia_antes:
          otimizacaoEstado === 'otimizada'
            ? (routeData.distanciaAntesKm ?? null)
            : null,
        p_otimizacao_distancia_depois:
          otimizacaoEstado === 'otimizada'
            ? (routeData.distanciaKm ?? null)
            : null,
      });
      if (error) throw error;

      const result = data as AtomicRouteResult | null;
      if (!result?.success || !result.rota_id) {
        throw new Error('O banco não confirmou a criação integral da rota.');
      }

      requestIdRef.current = null;
      requestSignatureRef.current = null;
      showToast(
        result.reused
          ? 'A rota já havia sido criada e foi recuperada com segurança.'
          : `Rota criada com sucesso com ${paradas.length} parada(s).`,
        'success',
        5000,
      );
      onSuccess(result.rota_id);
      return true;
    } catch (error) {
      logger.error('[useRouteCreation] Erro ao criar rota atômica', error);
      showToast(
        'Não foi possível concluir a criação. O rascunho foi preservado para uma nova tentativa.',
        'error',
        6000,
      );
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [
    calcularDadosRota,
    dataRota,
    enderecoUnidade,
    isLoading,
    motoristaSelecionado,
    onSuccess,
    ordemManual,
    paradas,
    rotaOtimizada,
    setIsLoading,
    showToast,
    unidadeAtiva,
    unidadeNome,
  ]);

  return { gerarRota };
}
