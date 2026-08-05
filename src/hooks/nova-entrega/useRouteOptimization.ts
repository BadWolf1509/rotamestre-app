/**
 * Hook para otimização de rotas
 * Integra com Google Directions API e algoritmo de otimização
 */

import { useState, useCallback } from 'react';

import type {
  Parada,
  EnderecoUnidade,
  RotaOtimizadaState,
} from '@/components/gestor/nova-entrega/types';
import { googleMapsService } from '@/lib/google';
import { logger } from '@/lib/logger';
import {
  otimizarRotaComDependencias,
  ParadaParaOtimizar,
  validarRotaParaOtimizacao,
} from '@/lib/routeOptimization';

import { ordenarParadasPorRota } from '../useNovaEntrega.helpers';

import type React from 'react';

export interface UseRouteOptimizationReturn {
  rotaOtimizada: RotaOtimizadaState | null;
  setRotaOtimizada: React.Dispatch<
    React.SetStateAction<RotaOtimizadaState | null>
  >;
  isOptimizing: boolean;
  ordemManual: boolean;
  setOrdemManual: (manual: boolean) => void;
  otimizarRota: () => Promise<Parada[] | null>;
  resetOptimization: () => void;
}

export interface UseRouteOptimizationOptions {
  paradas: Parada[];
  enderecoUnidade: EnderecoUnidade | null;
  showToast: (
    message: string,
    type: 'success' | 'error' | 'info',
    duration?: number,
  ) => void;
}

export function useRouteOptimization({
  paradas,
  enderecoUnidade,
  showToast,
}: UseRouteOptimizationOptions): UseRouteOptimizationReturn {
  const [rotaOtimizada, setRotaOtimizada] = useState<RotaOtimizadaState | null>(
    null,
  );
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [ordemManual, setOrdemManual] = useState(false);

  const otimizarRota = useCallback(async (): Promise<Parada[] | null> => {
    if (paradas.length < 1) {
      showToast('Adicione pelo menos 1 parada para otimizar a rota', 'info');
      return null;
    }

    if (!enderecoUnidade) {
      showToast(
        'Endereço da unidade não encontrado. Verifique o cadastro da unidade.',
        'error',
      );
      return null;
    }

    // Filtrar paradas sem coordenadas válidas
    const paradasComCoordenadas = paradas.filter(
      (p) =>
        typeof p.latitude === 'number' &&
        Number.isFinite(p.latitude) &&
        p.latitude >= -90 &&
        p.latitude <= 90 &&
        typeof p.longitude === 'number' &&
        Number.isFinite(p.longitude) &&
        p.longitude >= -180 &&
        p.longitude <= 180,
    );
    if (paradasComCoordenadas.length !== paradas.length) {
      showToast(
        'Algumas paradas não têm coordenadas válidas. Remova-as e adicione novamente.',
        'error',
      );
      return null;
    }

    const paradasParaValidar: ParadaParaOtimizar[] = paradasComCoordenadas.map(
      (p) => ({
        id: p.id,
        tipo: p.tipo,
        endereco: p.endereco,
        latitude: p.latitude as number,
        longitude: p.longitude as number,
        ordem: p.ordem,
        destinatario: p.destinatario,
        telefone: p.telefone,
        observacoes: p.observacoes,
        vinculo_parada_id: p.vinculo_parada_id,
      }),
    );

    const validacao = validarRotaParaOtimizacao(paradasParaValidar);

    if (!validacao.valido) {
      showToast(validacao.erros[0], 'error');
      return null;
    }

    if (validacao.avisos.length > 0) {
      showToast(validacao.avisos[0], 'info');
    }

    setIsOptimizing(true);
    try {
      const pontoUnidade = {
        latitude: enderecoUnidade.latitude,
        longitude: enderecoUnidade.longitude,
      };

      // Distância na ordem atual, para medir o ganho da otimização.
      // Falha aqui não pode impedir a otimização: o ganho vira desconhecido.
      let distanciaAntesKm: number | null = null;
      try {
        const rotaAtual = await googleMapsService.getDirectionsSequential(
          pontoUnidade,
          pontoUnidade,
          paradasParaValidar.map((p) => ({
            latitude: p.latitude,
            longitude: p.longitude,
          })),
        );
        distanciaAntesKm = rotaAtual
          ? rotaAtual.distancia_total_metros / 1000
          : null;
      } catch (error) {
        logger.warn(
          '[useRouteOptimization] Falha ao medir a distância antes da otimização',
          error,
        );
      }

      const temVinculos = paradas.some((p) => p.vinculo_parada_id);

      if (temVinculos) {
        const resultado = await otimizarRotaComDependencias(
          pontoUnidade,
          paradasParaValidar,
          pontoUnidade,
        );

        if (!resultado) {
          showToast('Não foi possível otimizar a rota', 'error');
          return null;
        }

        const paradasAtualizadas = resultado.paradasOrdenadas
          .map((pOtimizada, i) => {
            const paradaOriginal = paradas.find((p) => p.id === pOtimizada.id);
            if (!paradaOriginal) {
              logger.warn(
                `[useRouteOptimization] Parada otimizada ${pOtimizada.id} não encontrada nas paradas originais`,
              );
              return null;
            }
            return {
              ...paradaOriginal,
              ordem: i + 1,
            };
          })
          .filter((p): p is Parada => p !== null);

        const isEstimated = resultado.isEstimated === true;
        setRotaOtimizada({
          distancia_total_metros: resultado.distanciaTotalMetros,
          duracao_total_segundos: resultado.duracaoTotalSegundos,
          legs: [],
          polyline: resultado.polyline,
          isEstimated,
          distanciaAntesKm,
        });
        setOrdemManual(false);

        showToast(
          isEstimated
            ? 'O serviço viário está indisponível. A ordem exibida é apenas uma estimativa e não pode ser confirmada ainda.'
            : `Rota otimizada com dependências! ${(resultado.distanciaTotalMetros / 1000).toFixed(1)} km - ${Math.round(resultado.duracaoTotalSegundos / 60)} min`,
          isEstimated ? 'info' : 'success',
          isEstimated ? 6000 : 4000,
        );

        return paradasAtualizadas;
      } else {
        const waypoints = paradasComCoordenadas.map((p) => ({
          latitude: p.latitude as number,
          longitude: p.longitude as number,
        }));

        const resultado = await googleMapsService.getDirections(
          pontoUnidade,
          pontoUnidade,
          waypoints,
        );

        if (!resultado) {
          showToast('Não foi possível otimizar a rota', 'error');
          return null;
        }

        const ordemOtimizada = resultado.ordem_otimizada || [];
        const paradasReordenadas = ordenarParadasPorRota(
          paradas,
          ordemOtimizada,
          resultado.legs,
        );

        const paradasComNovaOrdem = paradasReordenadas.map((p, i) => ({
          ...p,
          ordem: i + 1,
        }));

        const isEstimated = resultado.is_estimated === true;
        setRotaOtimizada({
          distancia_total_metros: resultado.distancia_total_metros,
          duracao_total_segundos: resultado.duracao_total_segundos,
          legs: resultado.legs,
          polyline: resultado.polyline,
          isEstimated,
          distanciaAntesKm,
        });
        setOrdemManual(false);

        showToast(
          isEstimated
            ? 'O serviço viário está indisponível. A ordem exibida é apenas uma estimativa e não pode ser confirmada ainda.'
            : `Rota otimizada! ${(resultado.distancia_total_metros / 1000).toFixed(1)} km - ${Math.round(resultado.duracao_total_segundos / 60)} min`,
          isEstimated ? 'info' : 'success',
          isEstimated ? 6000 : 4000,
        );

        return paradasComNovaOrdem;
      }
    } catch (error) {
      logger.error('[useRouteOptimization] Erro ao otimizar rota', error);
      showToast('Não foi possível otimizar a rota', 'error');
      return null;
    } finally {
      setIsOptimizing(false);
    }
  }, [enderecoUnidade, paradas, showToast]);

  const resetOptimization = useCallback(() => {
    setRotaOtimizada(null);
    setOrdemManual(false);
  }, []);

  return {
    rotaOtimizada,
    setRotaOtimizada,
    isOptimizing,
    ordemManual,
    setOrdemManual,
    otimizarRota,
    resetOptimization,
  };
}
