/**
 * Hook to load historico data from Supabase
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

import { useAlert } from '@/hooks/useAlert';
import { useUser } from '@/hooks/useUser';
import { logger } from '@/lib/logger';
import {
  contarParadasDasRotas,
  TAMANHO_PAGINA,
} from '@/lib/paradas/contarParadasDasRotas';
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
  const { userData, loading: carregandoUsuario } = useUser();
  const { showError, AlertDialog } = useAlert();
  const [rotas, setRotas] = useState<RotaHistorico[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Só a carga mais recente escreve: refresh ou troca de conta com outra em voo
  // deixava a resposta velha, chegando por último, sobrescrever a atual.
  const requisicaoRef = useRef(0);

  const loadHistorico = useCallback(async () => {
    const minha = ++requisicaoRef.current;
    const vigente = () => minha === requisicaoRef.current;

    // Perfil ainda chegando: segue no esqueleto. Encerrar o loading aqui
    // mostrava "Nenhuma rota registrada" até o perfil chegar.
    if (carregandoUsuario) return;
    if (!userData?.id) {
      setRotas([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setLoading(true);

      // Todas as rotas, em páginas: o PostgREST corta cada resposta em 1.000
      // linhas, sem erro. O `id` desempata a ordem entre as páginas.
      type RotaSemContagem = Omit<
        RotaHistorico,
        'paradas_count' | 'paradas_concluidas'
      >;
      const rotasData: RotaSemContagem[] = [];
      for (let inicio = 0; ; inicio += TAMANHO_PAGINA) {
        const { data, error: rotasError } = await supabase
          .from('rotas')
          .select(
            'id, data, status, distancia_total, iniciada_em, concluida_em, unidades(nome)',
          )
          .eq('motorista_id', userData.id)
          .order('data', { ascending: false })
          .order('created_at', { ascending: false })
          .order('id')
          .range(inicio, inicio + TAMANHO_PAGINA - 1)
          // O `tsc` infere `unidades` como ARRAY a partir da string do select,
          // porque ela sozinha não diz a cardinalidade. Medido no banco:
          // `rotas_unidade_id_fkey` é many-to-one, e o PostgREST devolve embed
          // many-to-one como OBJETO. Ou seja o tipo abaixo é o certo e a
          // inferência é que erra — era isso que o `as unknown as` compensava,
          // sem dizer. Informar a query faz o tipo fluir da origem.
          .returns<RotaSemContagem[]>();

        if (rotasError) throw rotasError;
        rotasData.push(...(data ?? []));
        if ((data?.length ?? 0) < TAMANHO_PAGINA) break;
      }

      if (!vigente()) return;
      if (rotasData.length === 0) {
        setRotas([]);
        return;
      }

      // Paradas em lotes de ids e paginadas: o `.in` com todas as rotas
      // passava de 1.000 linhas (393 rotas, 2.235 paradas) e zerava cards.
      // Erro aqui sobe para o alerta — contador zerado em silêncio é mentira.
      const contagem = await contarParadasDasRotas(rotasData.map((r) => r.id));
      if (!vigente()) return;

      const rotasComParadas: RotaHistorico[] = rotasData.map((rota) => {
        const c = contagem.get(rota.id);
        return {
          ...rota,
          paradas_count: c?.total ?? 0,
          paradas_concluidas: c?.concluidas ?? 0,
        };
      });

      setRotas(rotasComParadas);
    } catch (error) {
      logger.error('Erro ao carregar histórico', error);
      if (!vigente()) return;
      showError({
        title: 'Erro',
        message: 'Não foi possível carregar o histórico',
      });
    } finally {
      if (vigente()) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [userData?.id, carregandoUsuario, showError]);

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
