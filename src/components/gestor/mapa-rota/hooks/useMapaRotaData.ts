/**
 * Hook para carregar e processar dados da rota
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useToast } from '@/hooks/useToast';
import { logger } from '@/lib/logger';
import { normalizarOrdemParadas } from '@/lib/routeUtils';
import { supabase } from '@/lib/supabase';

import type { Parada, Rota, ResumoParadas } from '../types';

interface UseMapaRotaDataOptions {
  rotaId: string | string[] | undefined;
  onError?: () => void;
}

interface UseMapaRotaDataResult {
  loading: boolean;
  rota: Rota | null;
  paradas: Parada[];
  paradasReais: Parada[];
  pontosBase: Parada[];
  resumoParadas: ResumoParadas;
  enderecoUnidade: { latitude: number; longitude: number } | null;
  loadRotaEParadas: () => Promise<void>;
}

/**
 * Hook for loading and processing route data
 */
export function useMapaRotaData({
  rotaId,
  onError,
}: UseMapaRotaDataOptions): UseMapaRotaDataResult {
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [rota, setRota] = useState<Rota | null>(null);
  const [paradas, setParadas] = useState<Parada[]>([]);

  // Computed values
  const paradasReais = useMemo(
    () => paradas.filter((parada) => parada.is_checkpoint !== false),
    [paradas],
  );

  const pontosBase = useMemo(
    () => paradas.filter((parada) => parada.is_checkpoint === false),
    [paradas],
  );

  const resumoParadas: ResumoParadas = useMemo(() => {
    const total = paradasReais.length;
    const concluidas = paradasReais.filter(
      (p) => p.status === 'concluida',
    ).length;
    const pendentes = paradasReais.filter(
      (p) => p.status === 'pendente',
    ).length;
    const emAndamento = paradasReais.filter(
      (p) => p.status === 'em_andamento',
    ).length;
    const puladas = paradasReais.filter((p) => p.status === 'pulada').length;
    return { total, concluidas, pendentes, emAndamento, puladas };
  }, [paradasReais]);

  const enderecoUnidade = useMemo(() => {
    const pontoBase = paradas.find((p) => p.is_checkpoint === false);
    if (pontoBase?.latitude && pontoBase?.longitude) {
      return {
        latitude: pontoBase.latitude,
        longitude: pontoBase.longitude,
      };
    }
    return null;
  }, [paradas]);

  // Load route and stops
  const loadRotaEParadas = useCallback(async () => {
    const id = rotaId;
    if (!id) return;

    try {
      setLoading(true);

      const { data: rotaData, error: rotaError } = await supabase
        .from('rotas')
        .select(
          'id, data, status, distancia_total, tempo_total, polyline, created_at, updated_at, motorista_id, unidade_id, otimizacao_estado, usuarios!rotas_motorista_id_fkey(nome), unidades(nome)',
        )
        .eq('id', id)
        .single();

      if (rotaError) throw rotaError;

      setRota({
        ...rotaData,
        motorista: Array.isArray(rotaData.usuarios)
          ? rotaData.usuarios[0]
          : rotaData.usuarios,
        unidade: Array.isArray(rotaData.unidades)
          ? rotaData.unidades[0]
          : rotaData.unidades,
      });

      const { data: paradasData, error: paradasError } = await supabase
        .from('paradas')
        .select('*')
        .eq('rota_id', id)
        .order('ordem');

      if (paradasError) throw paradasError;

      // Check if order needs normalization (arrival checkpoint not at end)
      if (paradasData && paradasData.length > 0) {
        const chegada = paradasData.find(
          (p) => p.is_checkpoint === false && p.ordem > 0,
        );
        const paradasReaisArr = paradasData.filter(
          (p) => p.is_checkpoint !== false,
        );
        const expectedChegadaOrdem = paradasReaisArr.length + 1;

        if (chegada && chegada.ordem !== expectedChegadaOrdem) {
          logger.debug('[useMapaRotaData] Normalizing order', {
            chegadaOrdem: chegada.ordem,
            expectedChegadaOrdem,
          });
          await normalizarOrdemParadas(String(id));
          // Reload paradas after normalization
          const { data: reloadedParadas } = await supabase
            .from('paradas')
            .select('*')
            .eq('rota_id', id)
            .order('ordem');
          setParadas(reloadedParadas || []);
          return;
        }
      }

      setParadas(paradasData || []);
    } catch (error) {
      logger.error('[useMapaRotaData] Erro ao carregar rota', error);
      showToast('Não foi possível carregar os dados da rota', 'error');
      onError?.();
    } finally {
      setLoading(false);
    }
  }, [rotaId, showToast, onError]);

  // Load on mount/id change
  useEffect(() => {
    if (rotaId) {
      loadRotaEParadas();
    } else {
      setLoading(false);
    }
  }, [rotaId, loadRotaEParadas]);

  return {
    loading,
    rota,
    paradas,
    paradasReais,
    pontosBase,
    resumoParadas,
    enderecoUnidade,
    loadRotaEParadas,
  };
}
