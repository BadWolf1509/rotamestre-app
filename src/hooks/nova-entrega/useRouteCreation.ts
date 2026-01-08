/**
 * Hook para criação de rotas no banco de dados
 * Gerencia inserção de rota e paradas, vínculos e logs
 */

import { useCallback, useRef, useEffect } from 'react';

import type {
  Parada,
  EnderecoUnidade,
  RotaOtimizadaState,
} from '@/components/gestor/nova-entrega/types';
import { googleMapsService } from '@/lib/google';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

import {
  prepararParadasParaInserir,
  atualizarVinculosParadas,
} from '../useNovaEntrega.helpers';

export interface UseRouteCreationReturn {
  gerarRota: () => Promise<boolean>;
}

export interface UseRouteCreationOptions {
  paradas: Parada[];
  enderecoUnidade: EnderecoUnidade | null;
  rotaOtimizada: RotaOtimizadaState | null;
  ordemManual: boolean;
  motoristaSelecionado: string;
  unidadeAtiva: string | null;
  unidadeNome: string;
  userId: string | null;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  showToast: (message: string, type: 'success' | 'error' | 'info', duration?: number) => void;
  onSuccess: () => void;
}

export function useRouteCreation({
  paradas,
  enderecoUnidade,
  rotaOtimizada,
  ordemManual,
  motoristaSelecionado,
  unidadeAtiva,
  unidadeNome,
  userId,
  isLoading,
  setIsLoading,
  showToast,
  onSuccess,
}: UseRouteCreationOptions): UseRouteCreationReturn {
  // Ref para cleanup do setTimeout
  const limparFormularioTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup do timeout ao desmontar
  useEffect(() => {
    return () => {
      if (limparFormularioTimeoutRef.current) {
        clearTimeout(limparFormularioTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Calcula distâncias e tempo da rota (usa otimização prévia ou calcula na hora)
   */
  const calcularDadosRota = useCallback(async () => {
    if (ordemManual) {
      if (paradas.length > 0 && enderecoUnidade) {
        const pontoUnidade = {
          latitude: enderecoUnidade.latitude,
          longitude: enderecoUnidade.longitude,
        };

        const paradasValidas = paradas.filter(
          (p): p is Parada & { latitude: number; longitude: number } =>
            p.latitude != null && p.longitude != null
        );

        if (paradasValidas.length > 0) {
          const waypoints = paradasValidas.map((p) => ({
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
            return {
              distanciaKm: Number((resultado.distancia_total_metros / 1000).toFixed(2)),
              tempoMin: Math.round(resultado.duracao_total_segundos / 60),
              polyline: resultado.polyline,
            };
          }
        }
      }

      return {
        distanciaKm: null as number | null,
        tempoMin: null as number | null,
        polyline: undefined as string | undefined,
      };
    }

    if (rotaOtimizada) {
      return {
        distanciaKm: Number((rotaOtimizada.distancia_total_metros / 1000).toFixed(2)),
        tempoMin: Math.round(rotaOtimizada.duracao_total_segundos / 60),
        polyline: rotaOtimizada.polyline,
      };
    }

    if (paradas.length > 0 && enderecoUnidade) {
      const pontoUnidade = {
        latitude: enderecoUnidade.latitude,
        longitude: enderecoUnidade.longitude,
      };

      const paradasValidas = paradas.filter(
        (p): p is Parada & { latitude: number; longitude: number } =>
          p.latitude != null && p.longitude != null
      );
      const waypoints = paradasValidas.map((p) => ({
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
        return {
          distanciaKm: Number((resultado.distancia_total_metros / 1000).toFixed(2)),
          tempoMin: Math.round(resultado.duracao_total_segundos / 60),
          polyline: resultado.polyline,
        };
      }
    }

    return {
      distanciaKm: null as number | null,
      tempoMin: null as number | null,
      polyline: undefined as string | undefined,
    };
  }, [enderecoUnidade, ordemManual, paradas, rotaOtimizada]);

  /**
   * Registra log de criação da rota
   */
  const registrarLogRota = useCallback(async (
    rotaId: string,
    temVinculos: boolean,
    totalVinculos: number,
    distanciaKm: number | null,
    tempoMin: number | null
  ) => {
    if (!userId) {
      logger.warn('[useRouteCreation] Não foi possível registrar log: userId não disponível');
      return;
    }

    try {
      const { error } = await supabase.from('logs').insert({
        usuario_id: userId,
        rota_id: rotaId,
        evento: 'rota_criada',
        detalhes: {
          total_paradas: paradas.length,
          motorista_id: motoristaSelecionado,
          foi_otimizada: rotaOtimizada !== null && !ordemManual,
          ordem_manual: ordemManual,
          tem_vinculos: temVinculos,
          total_vinculos: totalVinculos,
          distancia_km: distanciaKm,
          tempo_min: tempoMin,
          rota_circular: enderecoUnidade !== null,
        },
      });

      if (error) {
        logger.error('[useRouteCreation] Erro ao registrar log de criação da rota', error);
      }
    } catch (error) {
      logger.error('[useRouteCreation] Erro inesperado ao registrar log', error);
    }
  }, [enderecoUnidade, motoristaSelecionado, ordemManual, paradas.length, rotaOtimizada, userId]);

  const gerarRota = useCallback(async (): Promise<boolean> => {
    // Validações
    if (paradas.length === 0) {
      showToast('Adicione pelo menos uma parada antes de gerar a rota', 'info');
      return false;
    }
    if (!motoristaSelecionado) {
      showToast('Selecione um motorista para a rota', 'info');
      return false;
    }
    if (isLoading) return false;

    setIsLoading(true);
    try {
      // 1. Calcular dados da rota
      const { distanciaKm, tempoMin, polyline } = await calcularDadosRota();

      // 2. Criar payload da rota
      const hoje = new Date();
      const dataHoje = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;

      const rotaPayload: Record<string, unknown> = {
        unidade_id: unidadeAtiva,
        motorista_id: motoristaSelecionado,
        status: 'pendente',
        data: dataHoje,
      };
      if (distanciaKm !== null) rotaPayload.distancia_total = distanciaKm;
      if (tempoMin !== null) rotaPayload.tempo_total = tempoMin;
      if (polyline) rotaPayload.polyline = polyline;

      // 3. Inserir rota no banco
      const { data: rotaData, error: rotaError } = await supabase
        .from('rotas')
        .insert(rotaPayload)
        .select()
        .single();
      if (rotaError) throw rotaError;

      // 4. Preparar paradas para inserção
      const paradasPreparadas = prepararParadasParaInserir({
        rotaId: rotaData.id,
        paradas,
        enderecoUnidade,
        nomeUnidade: unidadeNome,
      });

      // 5. Limpar campos temporários e inserir paradas
      const paradasLimpas = paradasPreparadas.map((p) => {
        const { _temp_id, _temp_vinculo_id, ...paradaLimpa } = p;
        return paradaLimpa;
      });

      const { data: paradasInseridas, error: paradasError } = await supabase
        .from('paradas')
        .insert(paradasLimpas)
        .select('id, ordem');
      if (paradasError) throw paradasError;

      // 6. Atualizar vínculos entre paradas
      if (paradasInseridas) {
        await atualizarVinculosParadas(paradasPreparadas, paradasInseridas);
      }

      // 7. Registrar log
      const temVinculos = paradasPreparadas.some((p) => p._temp_vinculo_id);
      const totalVinculos = paradasPreparadas.filter((p) => p._temp_vinculo_id).length;
      await registrarLogRota(rotaData.id, temVinculos, totalVinculos, distanciaKm, tempoMin);

      // 8. Sucesso
      showToast(
        `Rota circular criada com sucesso! ${paradas.length} entrega(s) cadastrada(s).`,
        'success',
        4000
      );

      // Limpar timeout anterior se existir
      if (limparFormularioTimeoutRef.current) {
        clearTimeout(limparFormularioTimeoutRef.current);
      }
      limparFormularioTimeoutRef.current = setTimeout(() => onSuccess(), 1000);

      return true;
    } catch (error) {
      logger.error('[useRouteCreation] Erro ao criar rota', error);
      showToast('Não foi possível criar a rota. Tente novamente.', 'error', 5000);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [calcularDadosRota, enderecoUnidade, isLoading, motoristaSelecionado, onSuccess, paradas, registrarLogRota, setIsLoading, showToast, unidadeAtiva, unidadeNome]);

  return {
    gerarRota,
  };
}
