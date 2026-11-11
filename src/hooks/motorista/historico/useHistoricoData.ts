/**
 * Lista do Histórico: o período e o status vão ao banco, em páginas de 50.
 *
 * Antes baixava todas as rotas do motorista (e contava as paradas de todas) e
 * filtrava no aparelho. Agora cada página traz só as suas rotas, ordenadas por
 * `data` desc e `id` desc (índice `idx_rotas_unidade_data_id`), e as paradas
 * contadas são as da página. "Carregar mais" pede a página seguinte.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

import { useAlert } from '@/hooks/useAlert';
import { useUser } from '@/hooks/useUser';
import { logger } from '@/lib/logger';
import { contarParadasDasRotas } from '@/lib/paradas/contarParadasDasRotas';
import { supabase } from '@/lib/supabase';

import type { FiltroStatus, RotaHistorico } from './types';

export const TAMANHO_PAGINA_HISTORICO = 50;

interface Entrada {
  /** Período lembrado já lido do aparelho. */
  carregado: boolean;
  de: string | null;
  ate: string | null;
  status: FiltroStatus;
}

interface UseHistoricoDataReturn {
  rotas: RotaHistorico[];
  /** Total de rotas que a consulta devolve (período + status). */
  total: number;
  /** Há mais páginas a pedir. */
  temMais: boolean;
  loading: boolean;
  carregandoMais: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  carregarMais: () => void;
  AlertDialog: React.ReactNode;
}

type RotaSemContagem = Omit<
  RotaHistorico,
  'paradas_count' | 'paradas_concluidas'
>;

export function useHistoricoData({
  carregado,
  de,
  ate,
  status,
}: Entrada): UseHistoricoDataReturn {
  const { userData, loading: carregandoUsuario } = useUser();
  const { showError, AlertDialog } = useAlert();
  const [rotas, setRotas] = useState<RotaHistorico[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const motoristaId = userData?.id;

  // Só a carga mais recente escreve: trocar de período rápido, refresh ou troca
  // de conta com outra em voo deixava a resposta velha sobrescrever a atual.
  const requisicaoRef = useRef(0);
  const carregandoMaisRef = useRef(false);

  const buscarPagina = useCallback(
    async (inicio: number) => {
      if (!motoristaId) return { linhas: [] as RotaHistorico[], count: 0 };
      let consulta = supabase
        .from('rotas')
        .select(
          'id, data, status, distancia_total, iniciada_em, concluida_em, unidades(nome)',
          { count: 'exact' },
        )
        .eq('motorista_id', motoristaId);
      if (de) consulta = consulta.gte('data', de);
      if (ate) consulta = consulta.lte('data', ate);
      if (status !== 'todos') consulta = consulta.eq('status', status);

      const { data, error, count } = await consulta
        .order('data', { ascending: false })
        .order('id', { ascending: false })
        .range(inicio, inicio + TAMANHO_PAGINA_HISTORICO - 1)
        // O `tsc` infere `unidades` como ARRAY a partir da string do select;
        // `rotas_unidade_id_fkey` é many-to-one e o PostgREST devolve OBJETO.
        .returns<RotaSemContagem[]>();
      if (error) throw error;

      const pagina = data ?? [];
      // Paradas só das rotas da página. Erro sobe para o alerta: contador
      // zerado em silêncio é mentira.
      const contagem =
        pagina.length > 0
          ? await contarParadasDasRotas(pagina.map((r) => r.id))
          : new Map();
      const linhas = pagina.map((rota) => {
        const c = contagem.get(rota.id);
        return {
          ...rota,
          paradas_count: c?.total ?? 0,
          paradas_concluidas: c?.concluidas ?? 0,
        };
      });
      return { linhas, count: count ?? inicio + linhas.length };
    },
    [motoristaId, de, ate, status],
  );

  const carregar = useCallback(async () => {
    const minha = ++requisicaoRef.current;
    const vigente = () => minha === requisicaoRef.current;
    carregandoMaisRef.current = false;
    setCarregandoMais(false);

    // Perfil ou período lembrado ainda chegando: segue no esqueleto. Encerrar
    // o loading aqui mostrava "Nenhuma rota registrada" antes da hora.
    if (carregandoUsuario || !carregado) {
      setRefreshing(false);
      return;
    }
    if (!motoristaId) {
      setRotas([]);
      setTotal(0);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setLoading(true);
      const { linhas, count } = await buscarPagina(0);
      if (!vigente()) return;
      setRotas(linhas);
      setTotal(count);
    } catch (error) {
      logger.error('Erro ao carregar histórico', error);
      if (!vigente()) return;
      setRotas([]);
      setTotal(0);
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
  }, [motoristaId, carregandoUsuario, carregado, buscarPagina, showError]);

  useEffect(() => {
    // Disparo proposital, sem espera: o carregador trata o próprio erro (try/catch com log).
    void carregar();
  }, [carregar]);

  const carregarMais = useCallback(() => {
    if (carregandoMaisRef.current || loading) return;
    if (rotas.length === 0 || rotas.length >= total) return;
    const geracao = requisicaoRef.current;
    carregandoMaisRef.current = true;
    setCarregandoMais(true);
    const pedir = async () => {
      try {
        const { linhas, count } = await buscarPagina(rotas.length);
        // Outra carga começou (troca de período, refresh): descarta.
        if (geracao !== requisicaoRef.current) return;
        setRotas((atuais) => {
          const ids = new Set(atuais.map((r) => r.id));
          return [...atuais, ...linhas.filter((r) => !ids.has(r.id))];
        });
        setTotal(count);
      } catch (error) {
        logger.error('Erro ao carregar mais rotas do histórico', error);
        if (geracao !== requisicaoRef.current) return;
        showError({
          title: 'Erro',
          message: 'Não foi possível carregar mais rotas',
        });
      } finally {
        if (geracao === requisicaoRef.current) {
          carregandoMaisRef.current = false;
          setCarregandoMais(false);
        }
      }
    };
    void pedir();
  }, [loading, rotas.length, total, buscarPagina, showError]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // Disparo proposital, sem espera: o carregador trata o próprio erro (try/catch com log).
    void carregar();
  }, [carregar]);

  return {
    rotas,
    total,
    temMais: rotas.length < total,
    loading,
    carregandoMais,
    refreshing,
    onRefresh,
    carregarMais,
    AlertDialog,
  };
}
