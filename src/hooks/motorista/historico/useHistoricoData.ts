/**
 * Hook to load historico data from Supabase
 */

import React, { useCallback, useEffect, useState } from 'react';

import { useAlert } from '@/hooks/useAlert';
import { useUser } from '@/hooks/useUser';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

import type { RotaHistorico } from './types';

interface UseHistoricoDataReturn {
  rotas: RotaHistorico[];
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  AlertDialog: React.ReactNode;
}

export function useHistoricoData(): UseHistoricoDataReturn {
  const { userData } = useUser();
  const { showError, AlertDialog } = useAlert();
  const [rotas, setRotas] = useState<RotaHistorico[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadHistorico = useCallback(async () => {
    if (!userData?.id) {
      setRotas([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setLoading(true);

      const { data: rotasData, error: rotasError } = await supabase
        .from('rotas')
        .select('id, data, status, distancia_total, iniciada_em, concluida_em, unidades(nome)')
        .eq('motorista_id', userData.id)
        .order('data', { ascending: false })
        .order('created_at', { ascending: false });

      if (rotasError) throw rotasError;

      if (!rotasData || rotasData.length === 0) {
        setRotas([]);
        return;
      }

      const rotaIds = rotasData.map((r) => r.id);
      const { data: todasParadas, error: paradasError } = await supabase
        .from('paradas')
        .select('rota_id, id, status, is_checkpoint')
        .in('rota_id', rotaIds);

      if (paradasError) {
        logger.error('Erro ao buscar paradas', paradasError);
      }

      type ParadaItem = { rota_id: string; id: string; status: string; is_checkpoint: boolean | null };
      const paradasPorRota: Record<string, ParadaItem[]> = {};
      (todasParadas || []).forEach((parada) => {
        if (!paradasPorRota[parada.rota_id]) {
          paradasPorRota[parada.rota_id] = [];
        }
        paradasPorRota[parada.rota_id].push(parada);
      });

      const rotasComParadas = rotasData.map((rota) => {
        const paradasDaRota = paradasPorRota[rota.id] || [];
        const paradasReais = paradasDaRota.filter(
          (parada) => parada.is_checkpoint !== false
        );

        return {
          ...rota,
          paradas_count: paradasReais.length,
          paradas_concluidas: paradasReais.filter((p) => p.status === 'concluida').length,
        };
      });

      // Safe cast: mapped shape matches RotaHistorico (enriched with paradas counts)
      setRotas(rotasComParadas as unknown as RotaHistorico[]);
    } catch (error) {
      logger.error('Erro ao carregar histórico', error);
      showError({ title: 'Erro', message: 'Não foi possível carregar o histórico' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userData?.id, showError]);

  useEffect(() => {
    loadHistorico();
  }, [loadHistorico]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadHistorico();
  }, [loadHistorico]);

  return {
    rotas,
    loading,
    refreshing,
    onRefresh,
    AlertDialog,
  };
}
