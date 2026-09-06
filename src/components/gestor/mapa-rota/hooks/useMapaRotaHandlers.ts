/**
 * Hook para ações e handlers da página MapaRota
 */

import React, { useCallback, useRef, useState } from 'react';
import { FlatList } from 'react-native';

import { useToast } from '@/hooks/useToast';
import { useUser } from '@/hooks/useUser';
import { getTodayISO } from '@/lib/dateUtils';
import { logger } from '@/lib/logger';
import {
  removerParadaERecalcular,
  reordenarParadas,
  recalcularRota,
  notificarMotoristaRotaEditada,
} from '@/lib/routeUtils';
import { supabase } from '@/lib/supabase';

import type { Parada, Rota } from '../types';

/**
 * Confere se um UPDATE realmente afetou algum registro, quando algum era
 * esperado.
 *
 * RLS pode barrar um UPDATE devolvendo 204 com ZERO linhas e `error: null`
 * (o `Prefer: return=minimal` default não distingue "0 linhas" de "N linhas"
 * sem `.select()` encadeado) — checar só `error` não basta. Por isso todo
 * UPDATE nesta tela encadeia `.select('id')` e passa o resultado por aqui.
 *
 * `esperado` não é sempre 1: o UPDATE de paradas em `handleConfirmReactivate`
 * tem `.neq('status', 'concluida')`, e zero linhas é o resultado CORRETO
 * quando todas já estavam concluídas — nesse caso `esperado` também é zero.
 *
 * A checagem é "afetou ZERO quando devia afetar alguma", não "afetou MENOS
 * que o esperado". Para esse mesmo UPDATE de paradas, `esperado` vem de uma
 * contagem no CLIENTE (`paradasReais`, um snapshot que pode datar de antes
 * do clique) — se outro gestor concluir uma parada nesse meio-tempo, o
 * `.neq('status', 'concluida')` (corretamente) deixa de pegá-la, e o número
 * afetado cai abaixo do esperado sem que nada tenha dado errado. Comparar
 * com `<` alarmava falso ("Erro ao reativar rota" numa reativação que
 * funcionou) e pulava o `loadRotaEParadas()` que traria a tela pro estado
 * real. RLS bloqueia por policy — é tudo ou nada entre as linhas elegíveis
 * de uma mesma unidade — então "zero afetadas" continua sendo o sinal certo
 * de falha real; um número parcial não é.
 */
function assertUpdateAfetouLinhas(
  data: { id: string }[] | null,
  error: unknown,
  esperado: number,
  mensagem: string,
): void {
  if (error) throw error;
  if (esperado > 0 && (data?.length ?? 0) === 0) {
    throw new Error(mensagem);
  }
}

interface UseMapaRotaHandlersOptions {
  rotaId: string | string[] | undefined;
  rota: Rota | null;
  paradas: Parada[];
  paradasReais: Parada[];
  enderecoUnidade: { latitude: number; longitude: number } | null;
  loadRotaEParadas: () => Promise<void>;
}

interface UseMapaRotaHandlersResult {
  // Selection state
  selectedParadaId: string | null;
  fotoSelecionada: string | null;
  paradaToRemove: Parada | null;
  paradaToEdit: Parada | null;

  // Reorder state
  isReordering: boolean;
  hasReorderChanges: boolean;
  setHasReorderChanges: (value: boolean) => void;

  // Refs
  listaParadasRef: React.RefObject<FlatList<Parada> | null>;

  // Selection handlers
  handleMarkerPress: (paradaId: string) => void;
  handleMapPress: () => void;
  handleParadaPress: (paradaId: string) => void;
  handleImagePress: (url: string) => void;
  clearFotoSelecionada: () => void;

  // Route action handlers
  handleConfirmCancel: () => Promise<void>;
  handleConfirmReactivate: () => Promise<void>;
  handleChangeDriver: (
    newMotoristaId: string,
    newMotoristaNome: string,
  ) => Promise<void>;

  // Stop action handlers
  handleRemoveStopRequest: (parada: Parada) => void;
  handleConfirmRemoveStop: () => Promise<void>;
  clearParadaToRemove: () => void;
  handleEditStop: (parada: Parada) => void;
  handleEditStopSave: (routeRecalculationFailed?: boolean) => Promise<void>;
  clearParadaToEdit: () => void;
  handleAddStopSave: (routeRecalculationFailed?: boolean) => Promise<void>;
  handleReorderParadas: (newOrder: Parada[]) => Promise<void>;
}

/**
 * Hook for all action handlers in MapaRota page
 */
export function useMapaRotaHandlers({
  rotaId,
  rota,
  paradas: _paradas,
  paradasReais,
  enderecoUnidade,
  loadRotaEParadas,
}: UseMapaRotaHandlersOptions): UseMapaRotaHandlersResult {
  const { showToast } = useToast();
  const { userData } = useUser();

  // Selection state
  const [selectedParadaId, setSelectedParadaId] = useState<string | null>(null);
  const [fotoSelecionada, setFotoSelecionada] = useState<string | null>(null);
  const [paradaToRemove, setParadaToRemove] = useState<Parada | null>(null);
  const [paradaToEdit, setParadaToEdit] = useState<Parada | null>(null);

  // Reorder state
  const [isReordering, setIsReordering] = useState(false);
  const [hasReorderChanges, setHasReorderChanges] = useState(false);

  // Refs
  const listaParadasRef = useRef<FlatList<Parada> | null>(null);

  // Helper to get ID string
  const getIdString = useCallback(() => {
    return Array.isArray(rotaId) ? rotaId[0] : rotaId;
  }, [rotaId]);

  // Scroll to parada (FlatList: rola até o índice; onScrollToIndexFailed cobre itens não montados)
  const scrollToParada = useCallback(
    (paradaId: string) => {
      const index = paradasReais.findIndex((p) => p.id === paradaId);
      if (index >= 0 && listaParadasRef.current) {
        listaParadasRef.current.scrollToIndex({
          index,
          viewPosition: 0.3,
          animated: true,
        });
      }
    },
    [paradasReais],
  );

  // Selection handlers
  const handleMarkerPress = useCallback(
    (paradaId: string) => {
      setSelectedParadaId(paradaId);
      scrollToParada(paradaId);
    },
    [scrollToParada],
  );

  const handleMapPress = useCallback(() => {
    setSelectedParadaId(null);
  }, []);

  const handleParadaPress = useCallback((paradaId: string) => {
    setSelectedParadaId(paradaId);
  }, []);

  const handleImagePress = useCallback((url: string) => {
    setFotoSelecionada(url);
  }, []);

  const clearFotoSelecionada = useCallback(() => {
    setFotoSelecionada(null);
  }, []);

  // Route action handlers
  const handleConfirmCancel = useCallback(async () => {
    const id = getIdString();
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from('rotas')
        .update({ status: 'cancelada' })
        .eq('id', id)
        .select('id');

      assertUpdateAfetouLinhas(
        data,
        error,
        1,
        'Rota não foi cancelada (RLS ou rota inexistente)',
      );

      showToast('Rota cancelada com sucesso', 'success');
      await loadRotaEParadas();
    } catch (error) {
      logger.error('[useMapaRotaHandlers] Erro ao cancelar rota', error);
      showToast('Erro ao cancelar rota', 'error');
    }
  }, [getIdString, loadRotaEParadas, showToast]);

  const handleConfirmReactivate = useCallback(async () => {
    const id = getIdString();
    if (!id) return;

    try {
      const todayStr = getTodayISO();

      const { data: rotaData, error: rotaError } = await supabase
        .from('rotas')
        .update({
          status: 'pendente',
          data: todayStr,
          iniciada_em: null,
          concluida_em: null,
        })
        .eq('id', id)
        .select('id');

      assertUpdateAfetouLinhas(
        rotaData,
        rotaError,
        1,
        'Rota não foi reativada (RLS ou rota inexistente)',
      );

      // `esperado` aqui é quantas paradas o filtro .neq('status','concluida')
      // DEVERIA afetar, não 1 fixo: se a rota já estava com tudo concluído,
      // zero linhas é o resultado certo, e não pode virar falso-erro.
      const paradasNaoConcluidas = paradasReais.filter(
        (p) => p.status !== 'concluida',
      ).length;

      const { data: paradasData, error: paradasError } = await supabase
        .from('paradas')
        .update({ status: 'pendente', concluida_em: null })
        .eq('rota_id', id)
        .neq('status', 'concluida')
        .select('id');

      // Duas escritas independentes: se a de rotas passou e esta falhar, a
      // rota já voltou a 'pendente' mas as paradas continuam 'concluida' —
      // estado inconsistente. Não é seguro anunciar sucesso, nem tentar
      // desfazer sozinho aqui (não há RPC atômica para isso ainda).
      assertUpdateAfetouLinhas(
        paradasData,
        paradasError,
        paradasNaoConcluidas,
        'Paradas não foram todas reativadas (RLS ou concorrência) — rota e paradas ficaram inconsistentes',
      );

      await supabase.from('logs').insert({
        usuario_id: userData?.id,
        rota_id: id,
        evento: 'rota_reativada',
        detalhes: {
          nova_data: todayStr,
          reativado_por: userData?.nome,
        },
      });

      showToast('Rota reativada com sucesso', 'success');
      await loadRotaEParadas();
    } catch (error) {
      logger.error('[useMapaRotaHandlers] Erro ao reativar rota', error);
      showToast('Erro ao reativar rota', 'error');
    }
  }, [
    getIdString,
    loadRotaEParadas,
    paradasReais,
    showToast,
    userData?.id,
    userData?.nome,
  ]);

  const handleChangeDriver = useCallback(
    async (newMotoristaId: string, newMotoristaNome: string) => {
      const id = getIdString();
      if (!id || !rota) return;

      try {
        const { data, error } = await supabase
          .from('rotas')
          .update({ motorista_id: newMotoristaId })
          .eq('id', id)
          .select('id');

        assertUpdateAfetouLinhas(
          data,
          error,
          1,
          'Motorista não foi alterado (RLS ou rota inexistente)',
        );

        await supabase.from('logs').insert({
          usuario_id: userData?.id,
          rota_id: id,
          evento: 'motorista_alterado',
          detalhes: {
            motorista_anterior_id: rota.motorista_id,
            motorista_anterior_nome: rota.motorista?.nome,
            motorista_novo_id: newMotoristaId,
            motorista_novo_nome: newMotoristaNome,
            alterado_por: userData?.nome,
          },
        });

        showToast('Motorista alterado com sucesso', 'success');
        await loadRotaEParadas();
      } catch (error) {
        logger.error('[useMapaRotaHandlers] Erro ao alterar motorista', error);
        showToast('Erro ao alterar motorista', 'error');
      }
    },
    [
      getIdString,
      rota,
      loadRotaEParadas,
      showToast,
      userData?.id,
      userData?.nome,
    ],
  );

  // Stop action handlers
  const handleRemoveStopRequest = useCallback((parada: Parada) => {
    setParadaToRemove(parada);
  }, []);

  const clearParadaToRemove = useCallback(() => {
    setParadaToRemove(null);
  }, []);

  const handleConfirmRemoveStop = useCallback(async () => {
    const id = getIdString();
    if (!paradaToRemove || !id || !rota) return;

    try {
      if (!enderecoUnidade) {
        showToast('Erro: Coordenadas da unidade não encontradas', 'error');
        return;
      }

      const paradasRestantes = paradasReais
        .filter((p) => p.id !== paradaToRemove.id)
        .map((p, idx) => ({
          ...p,
          ordem: idx + 1,
        }));

      const result = await removerParadaERecalcular(
        paradaToRemove.id,
        id,
        paradasRestantes,
        enderecoUnidade,
        userData?.id,
      );

      if (result.success) {
        if (rota.motorista_id) {
          await notificarMotoristaRotaEditada({
            rotaId: id,
            motoristaId: rota.motorista_id,
            tipo: 'rota_parada_removida',
            titulo: '🗑️ Parada removida',
            mensagem: `Uma parada foi removida da sua rota: ${paradaToRemove.endereco?.substring(0, 50)}${(paradaToRemove.endereco?.length || 0) > 50 ? '...' : ''}`,
          });
        }

        showToast(
          result.routeRecalculationFailed
            ? 'Parada removida. O trajeto será recalculado ao carregar o mapa.'
            : 'Parada removida com sucesso',
          result.routeRecalculationFailed ? 'info' : 'success',
        );
        setParadaToRemove(null);
        await loadRotaEParadas();
      } else {
        showToast(result.error || 'Erro ao remover parada', 'error');
      }
    } catch (error) {
      logger.error('[useMapaRotaHandlers] Erro ao remover parada', error);
      showToast('Erro ao remover parada', 'error');
    }
  }, [
    getIdString,
    paradaToRemove,
    rota,
    paradasReais,
    enderecoUnidade,
    loadRotaEParadas,
    showToast,
    userData?.id,
  ]);

  const handleEditStop = useCallback((parada: Parada) => {
    setParadaToEdit(parada);
  }, []);

  const clearParadaToEdit = useCallback(() => {
    setParadaToEdit(null);
  }, []);

  const handleEditStopSave = useCallback(
    async (routeRecalculationFailed = false) => {
      setParadaToEdit(null);
      showToast(
        routeRecalculationFailed
          ? 'Parada atualizada. O trajeto será recalculado ao carregar o mapa.'
          : 'Parada atualizada com sucesso',
        routeRecalculationFailed ? 'info' : 'success',
      );
      await loadRotaEParadas();
    },
    [loadRotaEParadas, showToast],
  );

  const handleAddStopSave = useCallback(
    async (routeRecalculationFailed = false) => {
      showToast(
        routeRecalculationFailed
          ? 'Parada adicionada. O trajeto será recalculado ao carregar o mapa.'
          : 'Parada adicionada com sucesso',
        routeRecalculationFailed ? 'info' : 'success',
      );
      await loadRotaEParadas();
    },
    [loadRotaEParadas, showToast],
  );

  const handleReorderParadas = useCallback(
    async (newOrder: Parada[]) => {
      const id = getIdString();
      if (!id || !rota) {
        throw new Error('Rota não encontrada');
      }

      try {
        setIsReordering(true);

        if (!enderecoUnidade) {
          const errorMsg = 'Erro: Coordenadas da unidade não encontradas';
          showToast(errorMsg, 'error');
          throw new Error(errorMsg);
        }

        // 1. Update order in database
        const reorderResult = await reordenarParadas(
          newOrder.map((p, idx) => ({
            id: p.id,
            ordem: idx + 1,
            latitude: p.latitude,
            longitude: p.longitude,
            is_checkpoint: p.is_checkpoint,
          })),
        );

        if (!reorderResult.success) {
          const errorMsg = reorderResult.error || 'Erro ao reordenar paradas';
          showToast(errorMsg, 'error');
          throw new Error(errorMsg);
        }

        // 2. Recalculate route with new order
        let recalcWarning = false;
        try {
          const recalcResult = await recalcularRota(
            id,
            newOrder.map((p, idx) => ({
              id: p.id,
              ordem: idx + 1,
              latitude: p.latitude,
              longitude: p.longitude,
              is_checkpoint: p.is_checkpoint,
            })),
            enderecoUnidade,
          );

          if (!recalcResult.success) {
            logger.warn('[useMapaRotaHandlers] Recálculo falhou', {
              error: recalcResult.error,
            });
            recalcWarning = true;
          }
        } catch (recalcError) {
          logger.warn('[useMapaRotaHandlers] Erro no recálculo', recalcError);
          recalcWarning = true;
        }

        // 3. Reordenar à mão desfaz a otimização. Rota sem registro (NULL)
        // permanece sem registro — não inventamos o passado dela.
        const desfezOtimizacao = rota.otimizacao_estado === 'otimizada';
        // Escopo elevado até o log abaixo: o log precisa saber se o UPDATE
        // realmente aconteceu, não só se ele foi tentado — mesmo motivo (e
        // mesmo helper) de `assertUpdateAfetouLinhas` acima: RLS pode barrar
        // o UPDATE devolvendo 204 com ZERO linhas e `error: null`, e checar
        // só `error` não bastava.
        let otimizacaoMarcadaComoDesfeita = false;
        if (desfezOtimizacao) {
          try {
            const { data, error } = await supabase
              .from('rotas')
              .update({ otimizacao_estado: 'otimizada_alterada' })
              .eq('id', id)
              .select('id');

            assertUpdateAfetouLinhas(
              data,
              error,
              1,
              'UPDATE de otimizacao_estado não afetou nenhuma linha (RLS ou rota inexistente)',
            );
            otimizacaoMarcadaComoDesfeita = true;
          } catch (estadoError) {
            // `error`, não `warn`: warn é __DEV__-only (src/lib/logger.ts) e em
            // produção some. Este é o único ramo em que uma escrita de auditoria
            // falha em silêncio — a coluna fica 'otimizada' e o log registra
            // desfez_otimizacao: false, então sem isto a alteração manual não
            // deixa rastro nenhum.
            logger.error(
              '[useMapaRotaHandlers] Falha ao marcar otimização desfeita',
              estadoError,
            );
          }
        }

        // 4. Log action
        await supabase.from('logs').insert({
          usuario_id: userData?.id,
          rota_id: id,
          evento: 'paradas_reordenadas',
          detalhes: {
            nova_ordem: newOrder.map((p) => ({ id: p.id, ordem: p.ordem })),
            alterado_por: userData?.nome,
            // Reflete o que de fato foi gravado: `otimizacaoMarcadaComoDesfeita`
            // só fica `true` quando o UPDATE acima passou por
            // `assertUpdateAfetouLinhas` sem lançar — ou seja, quando ele
            // realmente afetou a linha. Se falhou (erro OU zero linhas por
            // RLS), `rotas.otimizacao_estado` continua 'otimizada' no banco —
            // o log não pode afirmar que a otimização foi desfeita.
            desfez_otimizacao: otimizacaoMarcadaComoDesfeita,
          },
        });

        // 5. Notify motorista
        if (rota.motorista_id) {
          await notificarMotoristaRotaEditada({
            rotaId: id,
            motoristaId: rota.motorista_id,
            tipo: 'rota_reordenada',
            titulo: '🔄 Rota reordenada',
            mensagem: `A ordem das paradas da sua rota foi alterada. Verifique a nova sequência.`,
          });
        }

        if (recalcWarning) {
          showToast(
            'Ordem salva! Distância/tempo podem estar desatualizados.',
            'info',
          );
        } else {
          showToast('Paradas reordenadas com sucesso', 'success');
        }

        await loadRotaEParadas();
      } catch (error) {
        logger.error('[useMapaRotaHandlers] Erro ao reordenar paradas', error);
        if (error instanceof Error && !error.message.startsWith('Erro')) {
          showToast('Erro ao reordenar paradas', 'error');
        }
        throw error;
      } finally {
        setIsReordering(false);
      }
    },
    [
      getIdString,
      rota,
      enderecoUnidade,
      loadRotaEParadas,
      showToast,
      userData?.id,
      userData?.nome,
    ],
  );

  return {
    // Selection state
    selectedParadaId,
    fotoSelecionada,
    paradaToRemove,
    paradaToEdit,

    // Reorder state
    isReordering,
    hasReorderChanges,
    setHasReorderChanges,

    // Refs
    listaParadasRef,

    // Selection handlers
    handleMarkerPress,
    handleMapPress,
    handleParadaPress,
    handleImagePress,
    clearFotoSelecionada,

    // Route action handlers
    handleConfirmCancel,
    handleConfirmReactivate,
    handleChangeDriver,

    // Stop action handlers
    handleRemoveStopRequest,
    handleConfirmRemoveStop,
    clearParadaToRemove,
    handleEditStop,
    handleEditStopSave,
    clearParadaToEdit,
    handleAddStopSave,
    handleReorderParadas,
  };
}
